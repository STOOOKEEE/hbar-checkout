"use client";

import { useEffect, useId, useRef, useState } from "react";
import { formatUnits } from "ethers";
import {
  hbarDisplay,
  PREVIEW_PRESETS,
  type PreviewPreset,
  type Quote,
} from "@saucerpay/checkout";
import { api, message } from "@/lib/wallet";

/** Reusable read-only conversion UI. Does not sign, reserve funds or fulfill orders. */
export function QuotePreview({
  initialAmount = "25",
  initialPreset = "mainnet-usdc",
}: {
  initialAmount?: string;
  initialPreset?: PreviewPreset;
}) {
  const fieldId = useId();
  const requestId = useRef(0);
  const [amount, setAmount] = useState(initialAmount);
  const [preset, setPreset] = useState<PreviewPreset>(initialPreset);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const asset = PREVIEW_PRESETS[preset];

  useEffect(
    () => () => {
      requestId.current += 1;
    },
    [],
  );

  function reset() {
    requestId.current += 1;
    setQuote(null);
    setError("");
    setBusy(false);
  }
  async function preview() {
    const current = ++requestId.current;
    setBusy(true);
    setQuote(null);
    setError("");
    try {
      const result = await api<{ quote: Quote }>(
        `/api/preview?preset=${preset}&amount=${encodeURIComponent(amount)}&slippageBps=50`,
      );
      if (current === requestId.current) setQuote(result.quote);
    } catch (error) {
      if (current === requestId.current) setError(message(error));
    } finally {
      if (current === requestId.current) setBusy(false);
    }
  }
  return (
    <section className="quote-panel" aria-label="Live conversion preview">
      <div className="section-heading">
        <p className="eyebrow">Live SaucerSwap liquidity</p>
        <span className="read-only">READ ONLY</span>
      </div>
      <h2>
        Receive {asset.symbol}.<br />
        Quote in HBAR.
      </h2>
      <p>
        See what a customer holding HBAR would need to spend. No payment is
        sent.
      </p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void preview();
        }}
      >
        <label htmlFor={`${fieldId}-asset`}>Quote asset</label>
        <select
          id={`${fieldId}-asset`}
          value={preset}
          onChange={(event) => {
            reset();
            setPreset(event.target.value as PreviewPreset);
          }}
        >
          <option value="mainnet-usdc">USDC · Mainnet (read only)</option>
          <option value="testnet-usdc">USDC · Testnet</option>
          <option value="testnet-sauce">SAUCE · Testnet</option>
          <option value="mainnet-sauce">SAUCE · Mainnet (read only)</option>
        </select>
        <label htmlFor={`${fieldId}-amount`}>Requested token amount</label>
        <div className="preview-input">
          <input
            id={`${fieldId}-amount`}
            inputMode="decimal"
            value={amount}
            onChange={(event) => {
              reset();
              setAmount(event.target.value);
            }}
            required
          />
          <span>{asset.symbol}</span>
        </div>
        <button className="button quote-button full" disabled={busy}>
          {busy ? "Reading the pool…" : "Get live quote"}
          <span>↗</span>
        </button>
      </form>
      {quote && (
        <div className="quote-result" role="status">
          <span>
            For {formatUnits(BigInt(quote.amountOut), quote.token.decimals)}{" "}
            {quote.token.symbol}
          </span>
          <strong>
            {hbarDisplay(BigInt(quote.quotedTinybar))} <small>HBAR</small>
          </strong>
          <p>
            Maximum {hbarDisplay(BigInt(quote.maximumTinybar))} HBAR · 0.5%
            tolerance
          </p>
          <small>
            Snapshot at{" "}
            {new Date((quote.validUntil - 60) * 1000).toLocaleTimeString()}.
            Network fees are additional. This quote does not reserve a price.
          </small>
        </div>
      )}
      {error && (
        <div className="alert quote-error" role="alert">
          {error}
        </div>
      )}
      <p className="quote-footnote">
        {asset.network} · Token {asset.tokenId} · Direct WHBAR → {asset.symbol}{" "}
        pool.
        {asset.network === "mainnet"
          ? " Mainnet is a live, read-only price; invoices settle on testnet."
          : " Testnet pool prices are not market prices."}
      </p>
    </section>
  );
}
