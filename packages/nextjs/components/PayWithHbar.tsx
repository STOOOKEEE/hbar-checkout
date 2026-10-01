"use client";

import { useCallback, useEffect, useEffectEvent, useState } from "react";
import { formatUnits } from "ethers";
import {
  checkoutInterface,
  hbarDisplay,
  paymentTransaction,
  verifyPaymentReceipt,
  type CheckoutConfig,
  type Invoice,
  type InvoiceLabel,
  type TokenInfo,
  type Quote,
  type PaymentReceipt,
} from "@hbar-checkout/checkout";
import {
  api,
  confirm,
  connectWallet,
  message,
  shortAddress,
  type WalletKind,
} from "@/lib/wallet";

/** Response of `GET /api/invoices/[id]`. */
export type InvoiceData = {
  config: CheckoutConfig;
  invoice: Invoice;
  token: TokenInfo;
  payment?: PaymentReceipt;
  /** Merchant-authored HCS description; not part of the on-chain terms. */
  label?: InvoiceLabel;
};
/** `reference` is the transaction hash or Hedera transaction ID to verify server-side. */
export type VerifiedPayment = PaymentReceipt & { reference: string };

type PayWithHbarProps = {
  invoiceId: string;
  /**
   * Called once the receipt matches the invoice, including after recovery.
   * Browser state is not proof: fulfill on your server with verifyInvoicePayment.
   */
  onPaid?: (payment: VerifiedPayment) => void;
  /** Hosted payment page actions: copy its link and merchant cancellation. */
  hosted?: boolean;
};

/** sessionStorage prefix: which invoice a `?tx=` written in this tab pays. */
const TX_INVOICE = "hbar-checkout:tx:";

/**
 * Pays an on-chain invoice in HBAR. The reference is kept in `?tx=` so a
 * refresh reconciles a submitted payment instead of paying twice. A new
 * `invoiceId` starts from a fresh state, and a `?tx=` this tab wrote for
 * another invoice is removed from the URL instead of being verified.
 */
export function PayWithHbar(props: PayWithHbarProps) {
  return <InvoicePayment key={props.invoiceId.toLowerCase()} {...props} />;
}

function InvoicePayment({
  invoiceId,
  onPaid,
  hosted = false,
}: PayWithHbarProps) {
  const [data, setData] = useState<InvoiceData | null>(null);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [slippage, setSlippage] = useState("50");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState("");
  const [now, setNow] = useState(0);
  const [reference, setReference] = useState("");
  const [walletKind, setWalletKind] = useState<WalletKind>("hashpack");
  const [payment, setPayment] = useState<VerifiedPayment | null>(null);

  const reportPaid = useEffectEvent((paid: VerifiedPayment) => onPaid?.(paid));
  useEffect(() => {
    if (payment) reportPaid(payment);
  }, [payment]);

  const load = useCallback(async () => {
    setError("");
    try {
      const url = new URL(window.location.href);
      let submitted = url.searchParams.get("tx");
      const owner = submitted && sessionStorage.getItem(TX_INVOICE + submitted);
      if (owner && owner !== invoiceId.toLowerCase()) {
        url.searchParams.delete("tx");
        window.history.replaceState(null, "", url);
        submitted = null;
      }
      const endpoint = `/api/invoices/${encodeURIComponent(invoiceId)}`;
      setData(await api<InvoiceData>(endpoint));
      if (submitted) {
        setReference(submitted);
        const verified = await api<InvoiceData>(
          `${endpoint}?tx=${encodeURIComponent(submitted)}`,
        );
        setData(verified);
        if (verified.payment)
          setPayment({ ...verified.payment, reference: submitted });
      }
    } catch (error) {
      setError(message(error));
    }
  }, [invoiceId]);
  useEffect(() => {
    void load();
    const timer = setInterval(
      () => setNow(Math.floor(Date.now() / 1000)),
      1000,
    );
    return () => clearInterval(timer);
  }, [load]);

  async function run(action: string, work: () => Promise<void>) {
    setBusy(action);
    setError("");
    setNotice("");
    try {
      await work();
    } catch (error) {
      setError(message(error));
    } finally {
      setBusy("");
    }
  }
  async function refreshQuote() {
    setQuote(null);
    const result = await api<{ quote: Quote }>(
      `/api/quote?invoiceId=${encodeURIComponent(invoiceId)}&slippageBps=${slippage}`,
    );
    setQuote(result.quote);
    setNow(Math.floor(Date.now() / 1000));
  }
  async function pay() {
    if (!data || !quote) return;
    const wallet = await connectWallet(data.config, walletKind);
    const sent = await wallet.send(paymentTransaction(data.config, quote));
    setReference(sent);
    // Persist the hash/transaction ID before waiting so refreshing can reconcile a submitted payment.
    sessionStorage.setItem(TX_INVOICE + sent, invoiceId.toLowerCase());
    const url = new URL(window.location.href);
    url.searchParams.set("tx", sent);
    window.history.replaceState(null, "", url);
    setNotice("Payment submitted. Waiting for its receipt…");
    const receipt = await confirm(data.config, sent);
    const verified = verifyPaymentReceipt(data.config, data.invoice, receipt);
    setPayment({ ...verified, reference: sent });
    setData({ ...data, invoice: { ...data.invoice, status: "paid" } });
    setQuote(null);
    setNotice("Payment confirmed and matched to this invoice.");
  }
  async function cancel() {
    if (!data?.config.checkout) return;
    const wallet = await connectWallet(data.config, walletKind);
    if (wallet.address.toLowerCase() !== data.invoice.merchant.toLowerCase())
      throw new Error("Only the merchant wallet can cancel this invoice.");
    await confirm(
      data.config,
      await wallet.send({
        to: data.config.checkout,
        data: checkoutInterface.encodeFunctionData("cancelInvoice", [
          invoiceId,
        ]),
      }),
    );
    setData({ ...data, invoice: { ...data.invoice, status: "cancelled" } });
    setQuote(null);
    setNotice("Invoice cancelled.");
  }

  function downloadReceipt() {
    if (!data || !payment) return;
    const evidence = {
      network: data.config.network,
      chainId: data.config.chainId,
      checkout: data.config.checkout,
      invoiceId: data.invoice.id,
      tokenId: data.config.tokenId,
      amountOut: payment.amountOut,
      merchant: payment.merchant,
      payer: payment.payer,
      spentTinybar: payment.spentTinybar,
      refundedTinybar: payment.refundedTinybar,
      paymentHash: payment.transactionHash,
      hashscan: `https://hashscan.io/${data.config.network}/transaction/${payment.transactionHash}`,
    };
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(evidence, null, 2)], {
        type: "application/json",
      }),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `hbar-checkout-${data.invoice.id.slice(0, 10)}.json`;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  const status =
    data?.invoice.status === "open" && now >= data.invoice.expiresAt
      ? "expired"
      : data?.invoice.status;
  return (
    <section className="panel payment-card">
      <div className="section-heading">
        <h2>Payment request</h2>
        <span className={`status-pill ${status === "paid" ? "paid" : ""}`}>
          {status || "Loading"}
        </span>
      </div>
      {data && (
        <>
          <div className="invoice-total">
            <span className="small-label">MERCHANT RECEIVES</span>
            <strong>
              {formatUnits(BigInt(data.invoice.amount), data.token.decimals)}{" "}
              <small>{data.token.symbol}</small>
            </strong>
          </div>
          {data.label && (
            <figure className="invoice-label">
              <span className="small-label">DESCRIPTION FROM THE MERCHANT</span>
              <blockquote>{data.label.text}</blockquote>
              <figcaption>
                Published on HCS topic{" "}
                <a
                  href={`https://hashscan.io/${data.config.network}/topic/${data.label.topicId}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  {data.label.topicId} ↗
                </a>
                . Not part of the amount or recipient enforced by the contract.
              </figcaption>
            </figure>
          )}
          <dl className="payment-details">
            <div>
              <dt>Recipient</dt>
              <dd>
                <a
                  title={data.invoice.merchant}
                  href={`https://hashscan.io/${data.config.network}/account/${data.invoice.merchant}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  {shortAddress(data.invoice.merchant)} ↗
                </a>
              </dd>
            </div>
            <div>
              <dt>Expires</dt>
              <dd>
                {new Date(data.invoice.expiresAt * 1000).toLocaleString()}
              </dd>
            </div>
            <div>
              <dt>Network</dt>
              <dd>Hedera {data.config.network}</dd>
            </div>
            <div>
              <dt>Invoice</dt>
              <dd title={invoiceId}>{shortAddress(invoiceId)}</dd>
            </div>
          </dl>
          {status === "open" && !payment && (
            <>
              <label htmlFor="slippage">Maximum price movement</label>
              <select
                id="slippage"
                value={slippage}
                disabled={!!busy}
                onChange={(event) => {
                  setSlippage(event.target.value);
                  setQuote(null);
                }}
              >
                <option value="10">0.1%</option>
                <option value="50">0.5%</option>
                <option value="100">1%</option>
              </select>
              <label htmlFor="wallet-kind">Wallet</label>
              <select
                id="wallet-kind"
                value={walletKind}
                disabled={!!busy}
                onChange={(event) =>
                  setWalletKind(event.target.value as WalletKind)
                }
              >
                <option value="hashpack">HashPack</option>
                <option value="evm">MetaMask (ECDSA account)</option>
              </select>
              <button
                className="button secondary full spaced"
                disabled={!!busy}
                onClick={() => void run("quote", refreshQuote)}
              >
                {busy === "quote"
                  ? "Checking invoice and liquidity…"
                  : "Get payment quote"}
              </button>
              {quote && (
                <div className="payment-quote">
                  <div>
                    <span>Estimated conversion</span>
                    <strong>
                      {hbarDisplay(BigInt(quote.quotedTinybar))} HBAR
                    </strong>
                  </div>
                  <div>
                    <span>Maximum spend</span>
                    <strong>
                      {hbarDisplay(BigInt(quote.maximumTinybar))} HBAR
                    </strong>
                  </div>
                  <p>
                    Network fees are additional. Unused conversion funds return
                    to your wallet.
                  </p>
                  <span className="quote-expiry">
                    {quote.validUntil > now
                      ? `Quote expires in ${quote.validUntil - now}s`
                      : "Quote expired — request a new one."}
                  </span>
                </div>
              )}
              <button
                className="button primary full"
                disabled={
                  !!busy ||
                  !!reference ||
                  !quote ||
                  quote.validUntil <= now ||
                  data.config.network !== "testnet"
                }
                onClick={() => void run("pay", pay)}
              >
                {busy === "pay"
                  ? "Confirming payment…"
                  : reference
                    ? "Refresh the submitted payment status"
                    : "Connect wallet & pay"}{" "}
                <span>→</span>
              </button>
            </>
          )}
          {payment && (
            <div className="payment-confirmed">
              <span className="check-circle">✓</span>
              <h2>Settled and verified</h2>
              <p>
                {hbarDisplay(BigInt(payment.spentTinybar))} HBAR converted
                <br />
                {hbarDisplay(BigInt(payment.refundedTinybar))} HBAR returned
              </p>
              <a
                href={`${data.config.mirrorUrl}/contracts/results/${payment.transactionHash}`}
                target="_blank"
                rel="noreferrer"
              >
                View verified mirror-node result ↗
              </a>
            </div>
          )}
          <div className="payment-actions">
            {payment && (
              <button className="text-button" onClick={downloadReceipt}>
                Download verified receipt
              </button>
            )}
            {hosted && (
              <button
                className="text-button"
                onClick={() =>
                  void run("copy", async () => {
                    await navigator.clipboard.writeText(window.location.href);
                    setNotice("Payment link copied.");
                  })
                }
              >
                Copy payment link
              </button>
            )}
            <button
              className="text-button"
              disabled={!!busy}
              onClick={() => void load()}
            >
              Refresh status
            </button>
            {hosted && status === "open" && (
              <button
                className="text-button"
                disabled={!!busy}
                onClick={() => void run("cancel", cancel)}
              >
                Cancel as merchant
              </button>
            )}
          </div>
        </>
      )}
      {error && (
        <div className="alert error" role="alert">
          {error}
          {!data && (
            <button className="text-button" onClick={() => void load()}>
              Retry
            </button>
          )}
        </div>
      )}
      {notice && (
        <div className="alert success" role="status">
          {notice}
        </div>
      )}
      {reference && !payment && (
        <p className="muted">
          Submitted transaction:{" "}
          {reference.startsWith("0x") ? (
            <a
              href={`https://hashscan.io/${data?.config.network ?? "testnet"}/transaction/${reference}`}
              target="_blank"
              rel="noreferrer"
            >
              {shortAddress(reference)} ↗
            </a>
          ) : (
            <code>{reference}</code>
          )}
          . Refresh status before retrying payment.
        </p>
      )}
    </section>
  );
}
