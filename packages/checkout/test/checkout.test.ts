import { describe, expect, it, vi, afterEach } from "vitest";
import { Interface } from "ethers";
import {
  entityAddress,
  tokenUnits,
  maximumSpend,
  tinybarToRpcWei,
  hbarDisplay,
  networkConfig,
  invoiceId,
  paymentTransaction,
  checkoutInterface,
  verifyPaymentReceipt,
  quotePayment,
  previewConfig,
  bufferedGasLimit,
  rpcWeiToTinybar,
  readTransactionReceipt,
  verifyInvoicePayment,
} from "../src/index";
import type { Invoice, Quote } from "../src/index";

const config = networkConfig("testnet", entityAddress("0.0.1234567"));
const invoice: Invoice = {
  id: invoiceId(entityAddress("0.0.100"), "0x" + "ab".repeat(32)),
  merchant: entityAddress("0.0.100"),
  amount: "1000000",
  expiresAt: 2000,
  status: "open",
};
const quote: Quote = {
  context: {
    chainId: config.chainId,
    checkout: config.checkout,
    router: config.router,
    token: config.token,
    whbar: config.whbar,
  },
  amountOut: "1000000",
  quotedTinybar: "101",
  maximumTinybar: "102",
  validUntil: 1060,
  slippageBps: 50,
  token: { symbol: "SAUCE", name: "Sauce", decimals: 6 },
  invoice,
};
afterEach(() => vi.unstubAllGlobals());

describe("money and transaction construction", () => {
  it("adds headroom to Hedera gas estimates before wallet submission", () => {
    // createInvoice ran out of gas at exactly its 113247 estimate and
    // succeeded at 120000 on testnet; the buffer must clear that with margin.
    expect(bufferedGasLimit(113247n)).toBe(141559n);
    expect(bufferedGasLimit(113262n)).toBe(141578n); // rounds up
    expect(bufferedGasLimit(1n)).toBe(2n); // never returns the bare estimate
    expect(() => bufferedGasLimit(0n)).toThrow(/Cannot estimate/);
  });
  it("keeps token precision and rejects ambiguous/out-of-range amounts", () => {
    expect(tokenUnits("1.000001", 6)).toBe(1000001n);
    for (const input of ["1.0000001", "-1", "1e6", "0", "90000000000000000000"])
      expect(() => tokenUnits(input, 6)).toThrow();
  });
  it("rounds maximum input upward without floating-point loss", () => {
    expect(maximumSpend(101n, 50)).toBe(102n);
    expect(maximumSpend(10000n, 0)).toBe(10000n);
    expect(() => maximumSpend(1n, 501)).toThrow();
    expect(() => maximumSpend(1n, NaN)).toThrow();
  });
  it("converts tinybar only at the RPC boundary", () => {
    expect(tinybarToRpcWei(100000000n)).toBe(10n ** 18n);
    expect(hbarDisplay(123456789n)).toBe("1.23456789");
    const transaction = paymentTransaction(config, quote, 1000);
    expect(transaction.value).toBe(1020000000000n);
    expect(
      checkoutInterface.decodeFunctionData("payInvoice", transaction.data)[0],
    ).toBe(invoice.id);
  });
  it("returns the exact tinybar payable to native Hedera transactions", () => {
    const transaction = paymentTransaction(config, quote, 1000);
    expect(rpcWeiToTinybar(transaction.value)).toBe(102n);
    // A sub-tinybar remainder would silently lose value on the native path.
    expect(() => rpcWeiToTinybar(transaction.value + 1n)).toThrow(/tinybar/);
  });
  it("resolves a native Hedera transaction ID to its EVM receipt", async () => {
    const hash = `0x${"cd".repeat(32)}`;
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(new Response("{}", { status: 404 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ hash })))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            result: {
              transactionHash: hash,
              status: "0x1",
              to: null,
              logs: [],
            },
          }),
        ),
      );
    vi.stubGlobal("fetch", fetcher);
    const id = "0.0.42@1790843870.331092130";
    expect(await readTransactionReceipt(config, id)).toBeNull();
    expect((await readTransactionReceipt(config, id))?.status).toBe(1);
    expect(fetcher.mock.calls[1][0]).toBe(
      `${config.mirrorUrl}/contracts/results/0.0.42-1790843870-331092130`,
    );
    expect(JSON.parse(fetcher.mock.calls[2][1].body).params).toEqual([hash]);
    await expect(readTransactionReceipt(config, "0x12")).rejects.toThrow(
      /transaction hash/,
    );
  });
  it("rejects stale quotes, mismatched invoice amounts and mainnet writes", () => {
    expect(() => paymentTransaction(config, quote, 1060)).toThrow(/Refresh/);
    expect(() =>
      paymentTransaction(config, { ...quote, amountOut: "3" }, 1000),
    ).toThrow(/terms/);
    expect(() =>
      paymentTransaction(config, { ...quote, maximumTinybar: "9999" }, 1000),
    ).toThrow(/terms/);
    expect(() =>
      paymentTransaction(
        networkConfig("mainnet", config.checkout!),
        quote,
        1000,
      ),
    ).toThrow(/testnet/);
  });
  it("validates entity numbers without coercing account aliases", () => {
    expect(entityAddress("0.0.19264").toLowerCase()).toBe(
      "0x0000000000000000000000000000000000004b40",
    );
    for (const id of ["1.0.1", "0.0.0", "0.0.-1", "abc"])
      expect(() => entityAddress(id)).toThrow();
  });
  it.each(["checkout", "router", "token", "whbar"] as const)(
    "rejects a quote produced for another %s before building a transaction",
    (field) => {
      expect(() =>
        paymentTransaction(
          config,
          {
            ...quote,
            context: { ...quote.context, [field]: entityAddress("0.0.999999") },
          },
          1000,
        ),
      ).toThrow(/another network, token or checkout/);
    },
  );
  it("rejects quotes from another chain and unbound legacy quotes", () => {
    expect(() =>
      paymentTransaction(
        config,
        {
          ...quote,
          context: { ...quote.context, chainId: 295 },
        },
        1000,
      ),
    ).toThrow(/another network/);
    const legacy = { ...quote };
    delete (legacy as Partial<Quote>).context;
    expect(() => paymentTransaction(config, legacy, 1000)).toThrow(
      /another network/,
    );
  });
  it("does not allow a read-only preview to become a payment", () => {
    const preview = { ...quote };
    delete preview.invoice;
    expect(() => paymentTransaction(config, preview, 1000)).toThrow(
      /on-chain invoice/,
    );
  });
});

describe("receipt verification", () => {
  function receipt(merchant = invoice.merchant, amount = 1000000n) {
    const event = checkoutInterface.encodeEventLog(
      checkoutInterface.getEvent("InvoicePaid")!,
      [invoice.id, entityAddress("0.0.101"), merchant, amount, 80n, 20n],
    );
    return {
      transactionHash: `0x${"ab".repeat(32)}`,
      status: 1,
      to: config.checkout,
      logs: [{ address: config.checkout!, ...event }],
    };
  }
  it("requires a matching event from the configured checkout", () => {
    expect(verifyPaymentReceipt(config, invoice, receipt()).spentTinybar).toBe(
      "80",
    );
    expect(() =>
      verifyPaymentReceipt(config, invoice, { ...receipt(), status: 0 }),
    ).toThrow();
    expect(() =>
      verifyPaymentReceipt(config, invoice, {
        ...receipt(),
        logs: [{ ...receipt().logs[0], address: entityAddress("0.0.999") }],
      }),
    ).toThrow();
    expect(() =>
      verifyPaymentReceipt(config, invoice, receipt(entityAddress("0.0.999"))),
    ).toThrow();
    expect(() =>
      verifyPaymentReceipt(config, invoice, receipt(invoice.merchant, 999n)),
    ).toThrow();
  });
});

describe("live integration boundary", () => {
  it("keeps USDC previews on the canonical mainnet token without a checkout", () => {
    const usdc = previewConfig("mainnet-usdc");
    expect(usdc.network).toBe("mainnet");
    expect(usdc.tokenId).toBe("0.0.456858");
    expect(usdc.checkout).toBeNull();
    expect(previewConfig("testnet-usdc").tokenId).toBe("0.0.5449");
    expect(previewConfig("testnet-sauce").network).toBe("testnet");
  });
  it.each(["mainnet-hbar", "__proto__", "constructor", "0.0.999"])(
    "rejects unsupported preview input %s instead of selecting an arbitrary asset",
    (preset) =>
      expect(() => previewConfig(preset)).toThrow(/supported quote asset/),
  );
  it("constructs the direct WHBAR route and uses router amounts, without invented prices", async () => {
    const abi = new Interface([
      "function getAmountsIn(uint256,address[]) view returns (uint256[])",
    ]);
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            symbol: "SAUCE",
            name: "Sauce",
            decimals: "6",
            type: "FUNGIBLE_COMMON",
            deleted: false,
            custom_fees: {},
          }),
        ),
      )
      .mockImplementationOnce(async (_url, init) => {
        const body = JSON.parse(init.body);
        const args = abi.decodeFunctionData(
          "getAmountsIn",
          body.params[0].data,
        );
        expect(args[0]).toBe(1000000n);
        expect([...args[1]]).toEqual([config.whbar, config.token]);
        return new Response(
          JSON.stringify({
            result: abi.encodeFunctionResult("getAmountsIn", [
              [101n, 1000000n],
            ]),
          }),
        );
      });
    vi.stubGlobal("fetch", fetcher);
    const result = await quotePayment(config, { amount: "1", slippageBps: 50 });
    expect(result.quotedTinybar).toBe("101");
    expect(result.maximumTinybar).toBe("102");
    expect(result.context).toEqual(quote.context);
  });
  it("fails explicitly on endpoint failure or transfer-fee tokens", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    await expect(
      quotePayment(config, { amount: "1", slippageBps: 50 }),
    ).rejects.toThrow(/unavailable/);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            symbol: "X",
            decimals: "6",
            type: "FUNGIBLE_COMMON",
            custom_fees: { fixed_fees: [{}] },
          }),
        ),
      ),
    );
    await expect(
      quotePayment(config, { amount: "1", slippageBps: 50 }),
    ).rejects.toThrow(/fees/);
  });
});

describe("invoice payment verification for fulfillment", () => {
  const reference = `0x${"cd".repeat(32)}`;
  const otherInvoice = invoiceId(invoice.merchant, "0x" + "ef".repeat(32));
  function paidReceipt(id = invoice.id, amount = 1000000n) {
    const event = checkoutInterface.encodeEventLog(
      checkoutInterface.getEvent("InvoicePaid")!,
      [id, entityAddress("0.0.101"), invoice.merchant, amount, 80n, 20n],
    );
    return {
      transactionHash: reference,
      status: "0x1",
      to: config.checkout,
      logs: [{ address: config.checkout, ...event }],
    };
  }
  /** Stubs Hashio: deployment immutables, the invoice record and one receipt. */
  function stubChain(invoiceStatus: 1 | 2, receipt: unknown) {
    const immutables: Record<string, string> = {
      router: config.router,
      whbar: config.whbar,
      token: config.token,
    };
    const fetcher = vi.fn(async (_url: string, init: RequestInit) => {
      const { method, params } = JSON.parse(String(init.body));
      if (method === "eth_getTransactionReceipt")
        return Response.json({ result: receipt });
      const call = checkoutInterface.parseTransaction({
        data: params[0].data,
      })!;
      const values =
        call.name === "invoices"
          ? [
              invoice.merchant,
              BigInt(invoice.amount),
              4_000_000_000n,
              invoiceStatus,
            ]
          : [immutables[call.name]];
      return Response.json({
        result: checkoutInterface.encodeFunctionResult(call.name, values),
      });
    });
    vi.stubGlobal("fetch", fetcher);
    return fetcher;
  }
  const verify = () =>
    verifyInvoicePayment(config, { invoiceId: invoice.id, reference });

  it("stays pending until the receipt is indexed and the invoice reads paid", async () => {
    stubChain(1, null);
    expect((await verify()).status).toBe("pending");
    stubChain(1, paidReceipt());
    expect((await verify()).status).toBe("pending");
  });
  it("returns the verified payment once the invoice is paid", async () => {
    stubChain(2, paidReceipt());
    const result = await verify();
    expect(result.status).toBe("paid");
    expect(result.status === "paid" && result.payment).toMatchObject({
      transactionHash: reference,
      amountOut: "1000000",
      spentTinybar: "80",
    });
  });
  it("rejects a receipt for another invoice or amount", async () => {
    stubChain(2, paidReceipt(otherInvoice));
    await expect(verify()).rejects.toThrow(/No matching InvoicePaid/);
    stubChain(2, paidReceipt(invoice.id, 999n));
    await expect(verify()).rejects.toThrow(/invoice terms/);
  });
  it("rejects a malformed reference before any network call", async () => {
    const fetcher = stubChain(2, paidReceipt());
    await expect(
      verifyInvoicePayment(config, {
        invoiceId: invoice.id,
        reference: "0xabc",
      }),
    ).rejects.toMatchObject({ code: "INVALID_RECEIPT" });
    expect(fetcher).not.toHaveBeenCalled();
  });
});
