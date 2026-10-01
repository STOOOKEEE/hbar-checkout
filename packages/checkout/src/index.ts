import {
  AbiCoder,
  Interface,
  getAddress,
  isAddress,
  keccak256,
  parseUnits,
  formatUnits,
} from "ethers";

export type Network = "testnet" | "mainnet";
export type CheckoutConfig = {
  network: Network;
  chainId: number;
  rpcUrl: string;
  mirrorUrl: string;
  router: string;
  whbar: string;
  tokenId: string;
  token: string;
  checkout: string | null;
};

export const CHECKOUT_ABI = [
  "function router() view returns (address)",
  "function token() view returns (address)",
  "function whbar() view returns (address)",
  "function invoices(bytes32) view returns (address merchant,uint256 amount,uint64 expiresAt,uint8 status)",
  "function createInvoice(bytes32 invoiceReference,uint256 amount,uint64 expiresAt) returns (bytes32)",
  "function cancelInvoice(bytes32 id)",
  "function payInvoice(bytes32 id,uint256 deadline) payable",
  "event InvoiceCreated(bytes32 indexed id,address indexed merchant,bytes32 invoiceReference,uint256 amount,uint64 expiresAt)",
  "event InvoiceCancelled(bytes32 indexed id)",
  "event InvoicePaid(bytes32 indexed id,address indexed payer,address indexed merchant,uint256 amountOut,uint256 spentTinybar,uint256 refundedTinybar)",
] as const;
export const checkoutInterface = new Interface(CHECKOUT_ABI);
const routerInterface = new Interface([
  "function getAmountsIn(uint256 amountOut,address[] path) view returns (uint256[] amounts)",
]);
export const TINYBAR_TO_RPC_WEI = 10_000_000_000n;
const MAX_AMOUNT = (1n << 63n) - 1n;

export class CheckoutError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = "CheckoutError";
  }
}

/** Hedera mirror-node estimates may be too tight for submitted writes. */
export function bufferedGasLimit(estimate: bigint): bigint {
  if (estimate <= 0n)
    throw new CheckoutError(
      "INVALID_GAS_ESTIMATE",
      "Cannot estimate transaction gas.",
    );
  return estimate * 2n;
}

export function entityAddress(id: string): string {
  const match = /^0\.0\.(\d+)$/.exec(id);
  if (!match || BigInt(match[1]) <= 0n || BigInt(match[1]) > (1n << 64n) - 1n)
    throw new CheckoutError(
      "INVALID_ENTITY",
      "Use a positive 0.0.x Hedera entity ID.",
    );
  return getAddress("0x" + BigInt(match[1]).toString(16).padStart(40, "0"));
}

export function networkConfig(
  network: Network,
  checkout?: string,
  tokenId?: string,
): CheckoutConfig {
  if (network !== "mainnet" && network !== "testnet")
    throw new CheckoutError("INVALID_NETWORK", "Choose testnet or mainnet.");
  if (checkout && (!isAddress(checkout) || BigInt(checkout) === 0n))
    throw new CheckoutError(
      "INVALID_ADDRESS",
      "Invalid checkout contract address.",
    );
  const main = network === "mainnet";
  const selectedToken = tokenId || (main ? "0.0.456858" : "0.0.5449");
  return {
    network,
    chainId: main ? 295 : 296,
    rpcUrl: `https://${network}.hashio.io/api`,
    mirrorUrl: `https://${network}.mirrornode.hedera.com/api/v1`,
    router: entityAddress(main ? "0.0.3045981" : "0.0.19264"),
    whbar: entityAddress(main ? "0.0.1456986" : "0.0.15058"),
    tokenId: selectedToken,
    token: entityAddress(selectedToken),
    checkout: checkout ? getAddress(checkout) : null,
  };
}

export const PREVIEW_PRESETS = {
  "testnet-usdc": { network: "testnet", tokenId: "0.0.5449", symbol: "USDC" },
  "mainnet-usdc": { network: "mainnet", tokenId: "0.0.456858", symbol: "USDC" },
  "testnet-sauce": {
    network: "testnet",
    tokenId: "0.0.1183558",
    symbol: "SAUCE",
  },
  "mainnet-sauce": {
    network: "mainnet",
    tokenId: "0.0.731861",
    symbol: "SAUCE",
  },
} as const;
export type PreviewPreset = keyof typeof PREVIEW_PRESETS;

/** Read-only allowlisted assets. No preset carries an invoice deployment. */
export function previewConfig(preset: string): CheckoutConfig {
  if (!Object.hasOwn(PREVIEW_PRESETS, preset))
    throw new CheckoutError(
      "INVALID_PRESET",
      "Choose a supported quote asset.",
    );
  const selected = PREVIEW_PRESETS[preset as PreviewPreset];
  return networkConfig(selected.network, undefined, selected.tokenId);
}

export function tokenUnits(value: string, decimals: number): bigint {
  if (
    !Number.isInteger(decimals) ||
    decimals < 0 ||
    decimals > 18 ||
    !/^\d{1,20}(\.\d{1,18})?$/.test(value)
  )
    throw new CheckoutError(
      "INVALID_AMOUNT",
      "Enter a positive decimal amount without exponent notation.",
    );
  let amount: bigint;
  try {
    amount = parseUnits(value, decimals);
  } catch {
    throw new CheckoutError(
      "INVALID_AMOUNT",
      `This token supports ${decimals} decimal places.`,
    );
  }
  if (amount <= 0n || amount > MAX_AMOUNT)
    throw new CheckoutError(
      "INVALID_AMOUNT",
      "Amount is outside the supported token range.",
    );
  return amount;
}

export function maximumSpend(
  quoteTinybar: bigint,
  slippageBps: number,
): bigint {
  if (
    quoteTinybar <= 0n ||
    !Number.isInteger(slippageBps) ||
    slippageBps < 0 ||
    slippageBps > 500
  )
    throw new CheckoutError(
      "INVALID_SLIPPAGE",
      "Slippage must be 0–500 basis points (0–5%).",
    );
  const maximum =
    (quoteTinybar * BigInt(10_000 + slippageBps) + 9_999n) / 10_000n;
  if (maximum > MAX_AMOUNT)
    throw new CheckoutError(
      "INVALID_AMOUNT",
      "HBAR spend exceeds the supported range.",
    );
  return maximum;
}

export function tinybarToRpcWei(tinybar: bigint): bigint {
  if (tinybar < 0n || tinybar > MAX_AMOUNT)
    throw new CheckoutError("INVALID_AMOUNT", "Invalid tinybar value.");
  return tinybar * TINYBAR_TO_RPC_WEI;
}
/** Inverse of tinybarToRpcWei, for native Hedera transactions that take tinybar. */
export function rpcWeiToTinybar(wei: bigint): bigint {
  if (wei < 0n || wei % TINYBAR_TO_RPC_WEI !== 0n)
    throw new CheckoutError(
      "INVALID_AMOUNT",
      "RPC value is not a whole number of tinybar.",
    );
  return wei / TINYBAR_TO_RPC_WEI;
}
export const hbarDisplay = (tinybar: bigint) => formatUnits(tinybar, 8);

export function validateInvoiceId(id: string): string {
  if (!/^0x[0-9a-fA-F]{64}$/.test(id))
    throw new CheckoutError("INVALID_INVOICE", "Invalid invoice ID.");
  return id;
}
export function invoiceId(merchant: string, reference: string): string {
  validateInvoiceId(reference);
  return keccak256(
    AbiCoder.defaultAbiCoder().encode(
      ["address", "bytes32"],
      [getAddress(merchant), reference],
    ),
  );
}

async function requestJson(
  url: string,
  init?: RequestInit,
  nullOnNotFound = false,
): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      cache: "no-store",
      signal: AbortSignal.timeout(12_000),
    });
  } catch {
    throw new CheckoutError(
      "NETWORK_UNAVAILABLE",
      "The Hedera endpoint is unavailable. Try again shortly.",
    );
  }
  if (nullOnNotFound && response.status === 404) return null;
  if (!response.ok)
    throw new CheckoutError(
      "NETWORK_UNAVAILABLE",
      `Hedera returned HTTP ${response.status}. Try again shortly.`,
    );
  try {
    return await response.json();
  } catch {
    throw new CheckoutError(
      "INVALID_RESPONSE",
      "Hedera returned an invalid response.",
    );
  }
}

export async function rpc(
  config: CheckoutConfig,
  method: string,
  params: unknown[],
): Promise<unknown> {
  const data = (await requestJson(config.rpcUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  })) as { result?: unknown; error?: unknown };
  if (!data || data.error || data.result === undefined)
    throw new CheckoutError(
      "RPC_FAILED",
      "The contract call failed. Check deployment, pool liquidity and token association.",
    );
  return data.result;
}

export type TransactionReceipt = {
  transactionHash: string;
  status: number;
  to: string | null;
  logs: { address: string; topics: string[]; data: string }[];
};

/**
 * Accepts an EVM transaction hash (MetaMask path) or a Hedera transaction ID
 * (`0.0.x@s.n` or mirror `0.0.x-s-n`, native HashPack path). Returns null
 * while the transaction is not indexed yet.
 */
export async function readTransactionReceipt(
  config: CheckoutConfig,
  reference: string,
): Promise<TransactionReceipt | null> {
  let hash = reference;
  const native = /^(0\.0\.\d+)[@-](\d+)[.-](\d+)$/.exec(reference);
  if (native) {
    const result = (await requestJson(
      `${config.mirrorUrl}/contracts/results/${native[1]}-${native[2]}-${native[3]}`,
      undefined,
      true,
    )) as { hash?: string } | null;
    if (!result) return null;
    hash = String(result.hash);
  }
  if (!/^0x[0-9a-fA-F]{64}$/.test(hash))
    throw new CheckoutError(
      "INVALID_RECEIPT",
      "Use a transaction hash or Hedera transaction ID.",
    );
  const receipt = (await rpc(config, "eth_getTransactionReceipt", [hash])) as
    | (Omit<TransactionReceipt, "status"> & { status: string })
    | null;
  return receipt && { ...receipt, status: Number(receipt.status) };
}
export async function contractRead(
  config: CheckoutConfig,
  address: string,
  abi: Interface,
  method: string,
  args: unknown[] = [],
) {
  const result = await rpc(config, "eth_call", [
    { to: address, data: abi.encodeFunctionData(method, args) },
    "latest",
  ]);
  if (typeof result !== "string" || result === "0x")
    throw new CheckoutError(
      "CONTRACT_UNAVAILABLE",
      "The contract has no readable result on this network.",
    );
  return abi.decodeFunctionResult(method, result);
}

export type TokenInfo = { symbol: string; decimals: number; name: string };
export async function readToken(config: CheckoutConfig): Promise<TokenInfo> {
  const token = (await requestJson(
    `${config.mirrorUrl}/tokens/${config.tokenId}`,
  )) as {
    symbol: string;
    name: string;
    decimals: string;
    type: string;
    deleted: boolean;
    pause_status?: string;
    custom_fees?: {
      fixed_fees?: unknown[];
      fractional_fees?: unknown[];
      royalty_fees?: unknown[];
    };
  };
  const decimals = Number(token.decimals);
  if (
    token.deleted ||
    token.type !== "FUNGIBLE_COMMON" ||
    token.pause_status === "PAUSED" ||
    !Number.isInteger(decimals) ||
    decimals < 0 ||
    decimals > 18
  )
    throw new CheckoutError(
      "UNSUPPORTED_TOKEN",
      "Choose an active fungible token with at most 18 decimals.",
    );
  if (
    Object.values(token.custom_fees || {}).some(
      (value) => Array.isArray(value) && value.length > 0,
    )
  )
    throw new CheckoutError(
      "UNSUPPORTED_TOKEN",
      "Exact checkout does not support tokens with custom transfer fees.",
    );
  return { symbol: token.symbol, name: token.name, decimals };
}

export async function assertAssociated(
  config: CheckoutConfig,
  merchant: string,
): Promise<void> {
  if (!isAddress(merchant))
    throw new CheckoutError("INVALID_ADDRESS", "Invalid merchant address.");
  const result = (await requestJson(
    `${config.mirrorUrl}/accounts/${merchant}/tokens?token.id=${config.tokenId}`,
  )) as {
    tokens?: {
      token_id: string;
      freeze_status?: string;
      kyc_status?: string;
    }[];
  };
  const relation = result.tokens?.find((t) => t.token_id === config.tokenId);
  if (!relation)
    throw new CheckoutError(
      "ASSOCIATION_REQUIRED",
      "The merchant must associate the settlement token before accepting payments.",
    );
  if (relation.freeze_status === "FROZEN" || relation.kyc_status === "REVOKED")
    throw new CheckoutError(
      "TOKEN_RESTRICTED",
      "The merchant token relationship is frozen or requires KYC.",
    );
}

export async function assertDeployment(
  config: CheckoutConfig,
): Promise<string> {
  if (!config.checkout)
    throw new CheckoutError(
      "DEPLOYMENT_REQUIRED",
      "Deploy SaucerPay on testnet and configure HEDERA_CHECKOUT_ADDRESS first.",
    );
  const expected = {
    router: config.router,
    whbar: config.whbar,
    token: config.token,
  };
  const values = await Promise.all(
    Object.keys(expected).map((method) =>
      contractRead(config, config.checkout!, checkoutInterface, method),
    ),
  );
  for (const [index, key] of Object.keys(expected).entries()) {
    if (getAddress(values[index][0]) !== expected[key as keyof typeof expected])
      throw new CheckoutError(
        "DEPLOYMENT_MISMATCH",
        `Checkout ${key} does not match this configuration.`,
      );
  }
  return config.checkout;
}

export type Invoice = {
  id: string;
  merchant: string;
  amount: string;
  expiresAt: number;
  status: "open" | "paid" | "cancelled" | "expired";
};
export async function readInvoice(
  config: CheckoutConfig,
  id: string,
): Promise<Invoice> {
  validateInvoiceId(id);
  if (!config.checkout)
    throw new CheckoutError("DEPLOYMENT_REQUIRED", "Checkout is not deployed.");
  const record = await contractRead(
    config,
    config.checkout,
    checkoutInterface,
    "invoices",
    [id],
  );
  const status = Number(record.status);
  if (!status)
    throw new CheckoutError(
      "NOT_FOUND",
      "Invoice does not exist on this deployment.",
    );
  const expiresAt = Number(record.expiresAt);
  return {
    id,
    merchant: getAddress(record.merchant),
    amount: record.amount.toString(),
    expiresAt,
    status:
      status === 2
        ? "paid"
        : status === 3
          ? "cancelled"
          : expiresAt <= Math.floor(Date.now() / 1000)
            ? "expired"
            : "open",
  };
}

export type Quote = {
  context: {
    chainId: number;
    checkout: string | null;
    router: string;
    token: string;
    whbar: string;
  };
  amountOut: string;
  quotedTinybar: string;
  maximumTinybar: string;
  validUntil: number;
  slippageBps: number;
  token: TokenInfo;
  invoice?: Invoice;
};
export async function quotePayment(
  config: CheckoutConfig,
  input: { amount?: string; invoiceId?: string; slippageBps: number },
): Promise<Quote> {
  // Validate bounds before any network calls.
  maximumSpend(1n, input.slippageBps);
  const token = await readToken(config);
  let invoice: Invoice | undefined;
  if (input.invoiceId) {
    await assertDeployment(config);
    invoice = await readInvoice(config, input.invoiceId);
    if (invoice.status !== "open")
      throw new CheckoutError("NOT_OPEN", `Invoice is ${invoice.status}.`);
    await assertAssociated(config, invoice.merchant);
  }
  const amountOut = invoice
    ? BigInt(invoice.amount)
    : tokenUnits(input.amount || "", token.decimals);
  const amounts = (
    await contractRead(config, config.router, routerInterface, "getAmountsIn", [
      amountOut,
      [config.whbar, config.token],
    ])
  )[0] as bigint[];
  if (amounts.length !== 2 || amounts[1] !== amountOut)
    throw new CheckoutError(
      "INVALID_QUOTE",
      "The router returned an unexpected route or amount.",
    );
  const max = maximumSpend(amounts[0], input.slippageBps);
  const now = Math.floor(Date.now() / 1000);
  const validUntil = Math.min(now + 60, invoice?.expiresAt || now + 60);
  if (validUntil <= now)
    throw new CheckoutError(
      "EXPIRED",
      "Invoice expired while obtaining the quote.",
    );
  return {
    context: {
      chainId: config.chainId,
      checkout: config.checkout,
      router: config.router,
      token: config.token,
      whbar: config.whbar,
    },
    amountOut: amountOut.toString(),
    quotedTinybar: amounts[0].toString(),
    maximumTinybar: max.toString(),
    validUntil,
    slippageBps: input.slippageBps,
    token,
    ...(invoice ? { invoice } : {}),
  };
}

export function paymentTransaction(
  config: CheckoutConfig,
  quote: Quote,
  now = Math.floor(Date.now() / 1000),
) {
  if (config.network !== "testnet")
    throw new CheckoutError(
      "READ_ONLY",
      "The reference app signs testnet transactions only.",
    );
  if (!config.checkout || !quote.invoice)
    throw new CheckoutError(
      "INVALID_INVOICE",
      "A deployed on-chain invoice is required.",
    );
  if (
    !quote.context ||
    quote.context.chainId !== config.chainId ||
    ["checkout", "router", "token", "whbar"].some((key) => {
      const field = key as "checkout" | "router" | "token" | "whbar";
      return (
        quote.context[field]?.toLowerCase() !== config[field]?.toLowerCase()
      );
    })
  )
    throw new CheckoutError(
      "QUOTE_CONTEXT_MISMATCH",
      "This quote belongs to another network, token or checkout. Request a new quote.",
    );
  if (quote.validUntil <= now || quote.invoice.status !== "open")
    throw new CheckoutError(
      "EXPIRED",
      "Refresh the payment quote before signing.",
    );
  validateInvoiceId(quote.invoice.id);
  if (
    quote.amountOut !== quote.invoice.amount ||
    quote.validUntil > quote.invoice.expiresAt ||
    BigInt(quote.maximumTinybar) !==
      maximumSpend(BigInt(quote.quotedTinybar), quote.slippageBps)
  )
    throw new CheckoutError(
      "INVALID_QUOTE",
      "Quote terms do not match the invoice or spend limit.",
    );
  return {
    to: config.checkout,
    data: checkoutInterface.encodeFunctionData("payInvoice", [
      quote.invoice.id,
      quote.validUntil,
    ]),
    value: tinybarToRpcWei(BigInt(quote.maximumTinybar)),
    chainId: config.chainId,
  };
}

export type PaymentReceipt = {
  transactionHash: string;
  id: string;
  payer: string;
  merchant: string;
  amountOut: string;
  spentTinybar: string;
  refundedTinybar: string;
};
export function verifyPaymentReceipt(
  config: CheckoutConfig,
  invoice: Invoice,
  receipt: {
    transactionHash: string;
    status: number | null;
    to: string | null;
    logs: readonly {
      address: string;
      topics: readonly string[];
      data: string;
    }[];
  },
): PaymentReceipt {
  if (
    !config.checkout ||
    receipt.status !== 1 ||
    receipt.to?.toLowerCase() !== config.checkout.toLowerCase()
  )
    throw new CheckoutError(
      "INVALID_RECEIPT",
      "Receipt is not a successful payment to this checkout.",
    );
  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== config.checkout.toLowerCase()) continue;
    let parsed;
    try {
      parsed = checkoutInterface.parseLog({
        topics: [...log.topics],
        data: log.data,
      });
    } catch {
      continue;
    }
    if (
      parsed?.name !== "InvoicePaid" ||
      parsed.args.id.toLowerCase() !== invoice.id.toLowerCase()
    )
      continue;
    if (
      getAddress(parsed.args.merchant) !== getAddress(invoice.merchant) ||
      parsed.args.amountOut !== BigInt(invoice.amount)
    )
      throw new CheckoutError(
        "INVALID_RECEIPT",
        "Payment event does not match the invoice terms.",
      );
    return {
      transactionHash: receipt.transactionHash,
      id: parsed.args.id,
      payer: parsed.args.payer,
      merchant: parsed.args.merchant,
      amountOut: parsed.args.amountOut.toString(),
      spentTinybar: parsed.args.spentTinybar.toString(),
      refundedTinybar: parsed.args.refundedTinybar.toString(),
    };
  }
  throw new CheckoutError(
    "INVALID_RECEIPT",
    "No matching InvoicePaid event was found.",
  );
}
