import { getAddress } from "ethers";
import {
  CheckoutError,
  checkoutInterface,
  readInvoice,
  requestJson,
  validateInvoiceId,
  type CheckoutConfig,
  type Invoice,
} from "./index";

/**
 * Merchant invoice log on the Hedera Consensus Service. The chain stays the
 * source of truth for amount, merchant and status; the topic only carries
 * merchant-authored metadata. The topic has no submit key, so anyone can post:
 * a message counts only when its fee payer is the invoice's on-chain merchant
 * and it reached consensus after the invoice was created.
 *
 * Every mirror scan is capped, so topic spam cannot slow reads down without
 * limit. An invoice's creation time comes from the merchant's own calls to the
 * checkout, which nobody else can add to.
 */

export const MAX_LABEL_LENGTH = 140;
const MAX_MESSAGE_BYTES = 1024;
const PAGE_SIZE = 100;
/** Newest pages of the merchant's checkout calls searched for a creation. */
const MAX_CREATION_PAGES = 5;
/** Topic pages read after an invoice's creation when looking for its label. */
const MAX_LABEL_PAGES = 3;
/** Newest pages of merchant calls and topic messages read for the history. */
const MAX_HISTORY_PAGES = 10;
/** On-chain invoice reads in flight at once while rebuilding the history. */
const INVOICE_READ_BATCH = 10;
const CONSENSUS_TIMESTAMP = /^\d+\.\d{9}$/;

export type InvoiceMessage = {
  v: 1;
  type: "invoice";
  checkout: string;
  invoiceId: string;
  label: string;
};
export type InvoiceLabel = {
  text: string;
  consensusTimestamp: string;
  topicId: string;
};

/** True for a label the topic accepts: one trimmed line of 1 to 140 characters. */
export const isLabel = (text: string) =>
  text.length > 0 &&
  text === text.trim() &&
  [...text].length <= MAX_LABEL_LENGTH &&
  !/\p{Cc}/u.test(text);

/** Encodes the topic message a merchant publishes for its invoice. */
export function encodeInvoiceMessage(
  config: CheckoutConfig,
  id: string,
  label: string,
): string {
  if (!config.checkout)
    throw new CheckoutError("DEPLOYMENT_REQUIRED", "Checkout is not deployed.");
  const text = label.trim();
  if (!isLabel(text))
    throw new CheckoutError(
      "INVALID_LABEL",
      `Use a single line of 1 to ${MAX_LABEL_LENGTH} characters.`,
    );
  const message: InvoiceMessage = {
    v: 1,
    type: "invoice",
    checkout: config.checkout,
    invoiceId: validateInvoiceId(id).toLowerCase(),
    label: text,
  };
  return JSON.stringify(message);
}

/** Returns null for anything that is not a well-formed v1 invoice message. */
export function parseInvoiceMessage(bytes: Uint8Array): InvoiceMessage | null {
  if (bytes.length > MAX_MESSAGE_BYTES) return null;
  let value: unknown;
  try {
    value = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    return null;
  }
  const checkout = field(value, "checkout");
  const invoiceId = field(value, "invoiceId");
  const label = field(value, "label");
  if (
    field(value, "v") !== 1 ||
    field(value, "type") !== "invoice" ||
    typeof checkout !== "string" ||
    !/^0x[0-9a-fA-F]{40}$/.test(checkout) ||
    typeof invoiceId !== "string" ||
    !/^0x[0-9a-fA-F]{64}$/.test(invoiceId) ||
    typeof label !== "string" ||
    !isLabel(label)
  )
    return null;
  return {
    v: 1,
    type: "invoice",
    checkout: checkout.toLowerCase(),
    invoiceId: invoiceId.toLowerCase(),
    label,
  };
}

/**
 * The first message (consensus order) for this invoice whose fee payer is the
 * invoice's on-chain merchant and that follows the invoice's creation. Null
 * when the topic is not configured, the creation is not among the merchant's
 * recent checkout calls, or no such message is among the first messages after
 * it.
 */
export async function readInvoiceLabel(
  config: CheckoutConfig,
  invoice: Invoice,
): Promise<InvoiceLabel | null> {
  if (!config.topicId) return null;
  const merchant = await accountId(config, invoice.merchant);
  if (!merchant) return null;
  const id = invoice.id.toLowerCase();
  let createdAt: string | null = null;
  for await (const creation of invoiceCreations(
    config,
    merchant,
    MAX_CREATION_PAGES,
  ))
    if (creation.id === id) {
      createdAt = creation.timestamp;
      break;
    }
  if (createdAt === null) return null;
  for await (const entry of topicEntries(
    config,
    `timestamp=gt:${createdAt}&order=asc`,
    MAX_LABEL_PAGES,
  ))
    if (
      entry.message.invoiceId === id &&
      entry.payer === merchant &&
      consensusNanos(entry.label.consensusTimestamp) > consensusNanos(createdAt)
    )
      return entry.label;
  return null;
}

export type LabelledInvoice = { invoice: Invoice; label: InvoiceLabel };
export type MerchantHistory = {
  /** Newest invoice first. */
  invoices: LabelledInvoice[];
  /** True when older merchant calls or topic messages were not read. */
  truncated: boolean;
};

/**
 * Rebuilds a merchant's recent labelled invoices. Each label obeys the
 * readInvoiceLabel rule and each invoice is read from the chain; labels for
 * invoices owned by someone else are dropped.
 */
export async function listMerchantInvoices(
  config: CheckoutConfig,
  merchant: string,
): Promise<MerchantHistory> {
  if (!config.topicId)
    throw new CheckoutError(
      "TOPIC_REQUIRED",
      "The invoice log topic is not configured.",
    );
  const [account, address] = /^0\.0\.\d+$/.test(merchant)
    ? [merchant, await evmAddress(config, merchant)]
    : [await accountId(config, merchant), getAddress(merchant)];
  if (!account || !address)
    throw new CheckoutError("NOT_FOUND", "Merchant account not found.");
  const scan = { truncated: false };
  const created = new Map<string, string>();
  for await (const creation of invoiceCreations(
    config,
    account,
    MAX_HISTORY_PAGES,
    scan,
  ))
    created.set(creation.id, creation.timestamp);
  // Newest first: an older qualifying label overwrites a later relabel.
  const labels = new Map<string, InvoiceLabel>();
  for await (const entry of topicEntries(
    config,
    "order=desc",
    MAX_HISTORY_PAGES,
    scan,
  )) {
    const createdAt = created.get(entry.message.invoiceId);
    if (
      entry.payer === account &&
      createdAt !== undefined &&
      consensusNanos(entry.label.consensusTimestamp) > consensusNanos(createdAt)
    )
      labels.set(entry.message.invoiceId, entry.label);
  }
  const ids = [...created.keys()].filter((id) => labels.has(id));
  const invoices: LabelledInvoice[] = [];
  for (let start = 0; start < ids.length; start += INVOICE_READ_BATCH) {
    const batch = await Promise.all(
      ids.slice(start, start + INVOICE_READ_BATCH).map(async (id) => {
        try {
          return await readInvoice(config, id);
        } catch (error) {
          if (error instanceof CheckoutError && error.code === "NOT_FOUND")
            return null;
          throw error;
        }
      }),
    );
    for (const invoice of batch) {
      const label = invoice && labels.get(invoice.id);
      if (invoice && label && invoice.merchant === address)
        invoices.push({ invoice, label });
    }
  }
  return { invoices, truncated: scan.truncated };
}

type Entry = { message: InvoiceMessage; payer: string; label: InvoiceLabel };
type Scan = { truncated: boolean };

/** Parsed topic messages for the configured checkout. */
async function* topicEntries(
  config: CheckoutConfig,
  query: string,
  maxPages: number,
  scan?: Scan,
): AsyncGenerator<Entry> {
  const topicId = config.topicId;
  const checkout = config.checkout?.toLowerCase();
  if (!topicId || !checkout) return;
  for await (const item of mirrorItems(
    config,
    `/topics/${topicId}/messages?${query}&limit=${PAGE_SIZE}`,
    "messages",
    maxPages,
    scan,
  )) {
    const payer = field(item, "payer_account_id");
    const consensusTimestamp = field(item, "consensus_timestamp");
    const data = field(item, "message");
    const chunks = field(field(item, "chunk_info"), "total");
    if (
      typeof payer !== "string" ||
      typeof consensusTimestamp !== "string" ||
      !CONSENSUS_TIMESTAMP.test(consensusTimestamp) ||
      typeof data !== "string" ||
      (chunks !== undefined && chunks !== 1)
    )
      continue;
    let bytes: Uint8Array;
    try {
      bytes = Uint8Array.from(atob(data), (char) => char.charCodeAt(0));
    } catch {
      continue;
    }
    const message = parseInvoiceMessage(bytes);
    if (message?.checkout === checkout)
      yield {
        message,
        payer,
        label: { text: message.label, consensusTimestamp, topicId },
      };
  }
}

/**
 * The account's successful createInvoice calls to the checkout, newest first.
 * The call result is the new invoice ID.
 */
async function* invoiceCreations(
  config: CheckoutConfig,
  account: string,
  maxPages: number,
  scan?: Scan,
): AsyncGenerator<{ id: string; timestamp: string }> {
  if (!config.checkout) return;
  // Read here, not at module load: index.ts re-exports this module.
  const createInvoice = checkoutInterface.getFunction("createInvoice")?.selector;
  for await (const item of mirrorItems(
    config,
    `/contracts/${config.checkout}/results?from=${account}&order=desc&limit=${PAGE_SIZE}`,
    "results",
    maxPages,
    scan,
  )) {
    const data = field(item, "function_parameters");
    const result = field(item, "call_result");
    const error = field(item, "error_message");
    const timestamp = field(item, "timestamp");
    if (
      typeof data === "string" &&
      data.slice(0, 10).toLowerCase() === createInvoice &&
      (error === null || error === undefined) &&
      typeof result === "string" &&
      /^0x[0-9a-fA-F]{64}$/.test(result) &&
      typeof timestamp === "string" &&
      CONSENSUS_TIMESTAMP.test(timestamp)
    )
      yield { id: result.toLowerCase(), timestamp };
  }
}

/** Items of a paged mirror list, reading at most maxPages pages. */
async function* mirrorItems(
  config: CheckoutConfig,
  path: string,
  key: string,
  maxPages: number,
  scan?: Scan,
): AsyncGenerator<unknown> {
  let url: string | null = `${config.mirrorUrl}${path}`;
  for (let page = 0; url; page++) {
    if (page === maxPages) {
      if (scan) scan.truncated = true;
      return;
    }
    const body = await requestJson(url);
    const items = field(body, key);
    if (!Array.isArray(items))
      throw new CheckoutError(
        "INVALID_RESPONSE",
        "Hedera returned an invalid response.",
      );
    yield* items;
    const next = field(field(body, "links"), "next");
    url =
      typeof next === "string" ? new URL(next, config.mirrorUrl).href : null;
  }
}

/** A validated mirror consensus timestamp ("seconds.nanoseconds") in nanoseconds. */
function consensusNanos(timestamp: string): bigint {
  const [seconds, nanos] = timestamp.split(".");
  return BigInt(seconds) * 1_000_000_000n + BigInt(nanos);
}

async function accountId(config: CheckoutConfig, address: string) {
  const value = field(
    await requestJson(
      `${config.mirrorUrl}/accounts/${address}`,
      undefined,
      true,
    ),
    "account",
  );
  return typeof value === "string" ? value : null;
}

async function evmAddress(config: CheckoutConfig, account: string) {
  const value = field(
    await requestJson(
      `${config.mirrorUrl}/accounts/${account}`,
      undefined,
      true,
    ),
    "evm_address",
  );
  return typeof value === "string" ? getAddress(value) : null;
}

function field(value: unknown, key: string): unknown {
  return value && typeof value === "object"
    ? Reflect.get(value, key)
    : undefined;
}
