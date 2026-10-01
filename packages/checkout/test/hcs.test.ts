import { afterEach, describe, expect, it, vi } from "vitest";
import {
  checkoutInterface,
  encodeInvoiceMessage,
  entityAddress,
  invoiceId,
  listMerchantInvoices,
  networkConfig,
  parseInvoiceMessage,
  readInvoiceLabel,
} from "../src/index";
import type { Invoice } from "../src/index";

const config = networkConfig(
  "testnet",
  entityAddress("0.0.1234567"),
  undefined,
  "0.0.7000",
);
const merchant = entityAddress("0.0.100");
const invoice: Invoice = {
  id: invoiceId(merchant, "0x" + "ab".repeat(32)),
  merchant,
  amount: "1000000",
  expiresAt: 4_000_000_000,
  status: "open",
};
const otherInvoice = invoiceId(merchant, "0x" + "cd".repeat(32));
const messagesPath = "/api/v1/topics/0.0.7000/messages";
const resultsPath = /^\/api\/v1\/contracts\/[^/]+\/results$/;

type Posted = { payer: string; body: string; chunks?: number; at?: string };
/** A createInvoice call by the merchant, as the mirror lists it. */
type Created = { id: string; at: string; error?: string };
const post = (label: string, overrides: Record<string, unknown> = {}) =>
  JSON.stringify({
    v: 1,
    type: "invoice",
    checkout: config.checkout,
    invoiceId: invoice.id,
    label,
    ...overrides,
  });

/**
 * Mirror stub: topic pages, the merchant's checkout calls, account lookups and
 * the invoices() eth_call. Topic message N of page P reaches consensus at
 * 1000 + 10P + N seconds unless `at` is given; the invoice exists from 900.
 */
function stubMirror(
  pages: Posted[][],
  {
    invoices = {},
    created = [{ id: invoice.id, at: "900.000000000" }],
  }: { invoices?: Record<string, string>; created?: Created[] } = {},
) {
  let inFlight = 0;
  const stats = { maxInvoiceReads: 0 };
  const fetch = vi.fn(async (input: string | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    if (url.pathname === messagesPath) {
      const page = Number(url.searchParams.get("page") ?? 0);
      return Response.json({
        messages: pages[page].map((item, index) => ({
          consensus_timestamp: item.at ?? `${1000 + page * 10 + index}.000000001`,
          payer_account_id: item.payer,
          message: btoa(
            String.fromCharCode(...new TextEncoder().encode(item.body)),
          ),
          chunk_info: { number: 1, total: item.chunks ?? 1 },
        })),
        links: {
          next:
            page + 1 < pages.length
              ? `${messagesPath}?order=asc&page=${page + 1}`
              : null,
        },
      });
    }
    if (resultsPath.test(url.pathname))
      return Response.json({
        results:
          url.searchParams.get("from") === "0.0.100"
            ? created.map(({ id, at, error }) => ({
                timestamp: at,
                function_parameters: checkoutInterface.encodeFunctionData(
                  "createInvoice",
                  ["0x" + "11".repeat(32), 1_000_000n, 4_000_000_000n],
                ),
                call_result: error ? "0x" : id,
                error_message: error ?? null,
              }))
            : [],
        links: { next: null },
      });
    const account = /^\/api\/v1\/accounts\/(.+)$/.exec(url.pathname)?.[1];
    if (account?.toLowerCase() === merchant.toLowerCase())
      return Response.json({ account: "0.0.100", evm_address: merchant });
    if (account === "0.0.100")
      return Response.json({ account: "0.0.100", evm_address: merchant });
    if (account) return new Response("{}", { status: 404 });
    const call = JSON.parse(String(init?.body)).params[0].data;
    const [id] = checkoutInterface.decodeFunctionData("invoices", call);
    stats.maxInvoiceReads = Math.max(stats.maxInvoiceReads, ++inFlight);
    await Promise.resolve(); // let the other reads of this batch start
    inFlight--;
    return Response.json({
      jsonrpc: "2.0",
      id: 1,
      result: checkoutInterface.encodeFunctionResult("invoices", [
        invoices[id] ?? entityAddress("0.0.1"),
        1_000_000n,
        4_000_000_000n,
        invoices[id] ? 1 : 0,
      ]),
    });
  });
  vi.stubGlobal("fetch", fetch);
  const topicReads = () =>
    fetch.mock.calls
      .map(([url]) => new URL(String(url)))
      .filter((url) => url.pathname === messagesPath);
  return { fetch, stats, topicReads };
}

afterEach(() => vi.unstubAllGlobals());

describe("invoice messages", () => {
  it("round-trips the encoded message and enforces the 140 character label", () => {
    const encoded = encodeInvoiceMessage(config, invoice.id, "  Logo design  ");
    expect(parseInvoiceMessage(new TextEncoder().encode(encoded))).toEqual({
      v: 1,
      type: "invoice",
      checkout: config.checkout?.toLowerCase(),
      invoiceId: invoice.id,
      label: "Logo design",
    });
    expect(() =>
      encodeInvoiceMessage(config, invoice.id, "é".repeat(141)),
    ).toThrow("1 to 140");
    expect(() => encodeInvoiceMessage(config, invoice.id, "a\nb")).toThrow(
      "single line",
    );
  });

  it("rejects malformed, oversized and other-version payloads", () => {
    const bytes = (text: string) => new TextEncoder().encode(text);
    expect(parseInvoiceMessage(bytes("{not json"))).toBeNull();
    expect(parseInvoiceMessage(new Uint8Array([0xff, 0xfe]))).toBeNull();
    expect(parseInvoiceMessage(bytes(post("x", { v: 2 })))).toBeNull();
    expect(
      parseInvoiceMessage(bytes(post("x", { invoiceId: "0x12" }))),
    ).toBeNull();
    expect(parseInvoiceMessage(bytes(post("")))).toBeNull();
    expect(
      parseInvoiceMessage(bytes(post("ok", { padding: "x".repeat(1024) }))),
    ).toBeNull();
  });
});

describe("readInvoiceLabel", () => {
  it("ignores labels posted by any account other than the on-chain merchant", async () => {
    stubMirror([
      [
        { payer: "0.0.666", body: post("Pay the attacker instead") },
        { payer: "0.0.100", body: post("Logo design") },
      ],
    ]);
    expect(await readInvoiceLabel(config, invoice)).toEqual({
      text: "Logo design",
      consensusTimestamp: "1001.000000001",
      topicId: "0.0.7000",
    });
  });

  it("skips wrong checkout, wrong invoice, malformed and chunked messages", async () => {
    stubMirror([
      [
        {
          payer: "0.0.100",
          body: post("other checkout", { checkout: entityAddress("0.0.9") }),
        },
        {
          payer: "0.0.100",
          body: post("other invoice", { invoiceId: otherInvoice }),
        },
        { payer: "0.0.100", body: "{" },
        { payer: "0.0.100", body: post("chunked"), chunks: 2 },
      ],
    ]);
    expect(await readInvoiceLabel(config, invoice)).toBeNull();
  });

  it("keeps the first valid label in consensus order across pages", async () => {
    const { topicReads } = stubMirror([
      [{ payer: "0.0.666", body: post("spam") }],
      [{ payer: "0.0.100", body: post("first") }],
      [{ payer: "0.0.100", body: post("later edit") }],
    ]);
    expect((await readInvoiceLabel(config, invoice))?.text).toBe("first");
    expect(topicReads()).toHaveLength(2); // stops once the label is found
  });

  it("starts at the invoice's creation and ignores labels posted before it", async () => {
    const { topicReads } = stubMirror(
      [
        [
          { payer: "0.0.100", body: post("posted before creation") },
          { payer: "0.0.666", body: post("spam") },
        ],
        [{ payer: "0.0.100", body: post("after creation") }],
      ],
      {
        created: [
          { id: otherInvoice, at: "1007.000000000" },
          { id: invoice.id, at: "1005.000000000" },
        ],
      },
    );
    expect((await readInvoiceLabel(config, invoice))?.text).toBe(
      "after creation",
    );
    const [first] = topicReads();
    expect(first.searchParams.get("timestamp")).toBe("gt:1005.000000000");
    expect(first.searchParams.get("order")).toBe("asc");
  });

  it("gives up after a few pages past the creation", async () => {
    const spam = { payer: "0.0.666", body: post("spam") };
    const { topicReads } = stubMirror([
      ...Array.from({ length: 5 }, () => [spam]),
      [{ payer: "0.0.100", body: post("buried") }],
    ]);
    expect(await readInvoiceLabel(config, invoice)).toBeNull();
    expect(topicReads()).toHaveLength(3);
  });

  it("returns null without reading the topic when the merchant never created the invoice", async () => {
    const { topicReads } = stubMirror(
      [[{ payer: "0.0.100", body: post("pre-registered") }]],
      {
        created: [
          { id: invoice.id, at: "900.000000000", error: "CONTRACT_REVERT_EXECUTED" },
        ],
      },
    );
    expect(await readInvoiceLabel(config, invoice)).toBeNull();
    expect(topicReads()).toHaveLength(0);
  });

  it("returns null without reading the mirror when no topic is configured", async () => {
    const { fetch } = stubMirror([[]]);
    const unlogged = networkConfig("testnet", config.checkout ?? undefined);
    expect(await readInvoiceLabel(unlogged, invoice)).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe("listMerchantInvoices", () => {
  it("rebuilds the merchant's own labelled invoices only", async () => {
    const someoneElse = invoiceId(
      entityAddress("0.0.200"),
      "0x" + "ef".repeat(32),
    );
    const { topicReads } = stubMirror(
      [
        [
          { payer: "0.0.100", body: post("relabel ignored"), at: "1003.000000000" },
          {
            payer: "0.0.100",
            body: post("not my invoice", { invoiceId: someoneElse }),
            at: "1002.000000000",
          },
          {
            payer: "0.0.100",
            body: post("never created", { invoiceId: otherInvoice }),
            at: "1001.500000000",
          },
          {
            payer: "0.0.666",
            body: post("spam", { invoiceId: someoneElse }),
            at: "1001.200000000",
          },
          { payer: "0.0.100", body: post("mine"), at: "1001.000000000" },
          { payer: "0.0.100", body: post("before creation"), at: "800.000000000" },
        ],
      ],
      {
        invoices: { [invoice.id]: merchant, [someoneElse]: entityAddress("0.0.200") },
      },
    );
    const history = await listMerchantInvoices(config, "0.0.100");
    expect(
      history.invoices.map(({ invoice, label }) => [invoice.id, label.text]),
    ).toEqual([[invoice.id, "mine"]]);
    expect(history.truncated).toBe(false);
    expect(topicReads()[0].searchParams.get("order")).toBe("desc");
  });

  it("reads only the newest topic pages and flags the history as truncated", async () => {
    const spam = { payer: "0.0.666", body: post("spam") };
    const { topicReads } = stubMirror(
      [
        [{ payer: "0.0.100", body: post("recent") }],
        ...Array.from({ length: 10 }, () => [spam]),
      ],
      { invoices: { [invoice.id]: merchant } },
    );
    const history = await listMerchantInvoices(config, "0.0.100");
    expect(history.invoices.map(({ label }) => label.text)).toEqual(["recent"]);
    expect(history.truncated).toBe(true);
    expect(topicReads()).toHaveLength(10);
  });

  it("reads labelled invoices from the chain a few at a time, newest first", async () => {
    const ids = Array.from({ length: 25 }, (_, index) =>
      invoiceId(merchant, "0x" + (index + 1).toString(16).padStart(64, "0")),
    );
    const { stats } = stubMirror(
      [ids.map((id) => ({ payer: "0.0.100", body: post("label", { invoiceId: id }) }))],
      {
        invoices: Object.fromEntries(ids.map((id) => [id, merchant])),
        created: ids.map((id, index) => ({ id, at: `${900 - index}.000000000` })),
      },
    );
    const history = await listMerchantInvoices(config, "0.0.100");
    expect(history.invoices.map(({ invoice }) => invoice.id)).toEqual(ids);
    expect(stats.maxInvoiceReads).toBeLessThanOrEqual(10);
  });
});
