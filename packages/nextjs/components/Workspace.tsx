"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { hexlify, randomBytes, formatUnits } from "ethers";
import {
  MAX_LABEL_LENGTH,
  checkoutInterface,
  encodeInvoiceMessage,
  isLabel,
  listMerchantInvoices,
  rpc,
  tokenUnits,
  type CheckoutConfig,
  type Invoice,
  type TokenInfo,
} from "@hbar-checkout/checkout";
import {
  api,
  confirm,
  connectWallet,
  message,
  shortAddress,
  type WalletKind,
} from "@/lib/wallet";
import { QuotePreview } from "@/components/QuotePreview";
import { Glow } from "@/components/motion/Glow";
import { Reveal } from "@/components/motion/Reveal";

type Settings = { config: CheckoutConfig; token: TokenInfo };
type Created = {
  id: string;
  amount: string;
  symbol: string;
  /** Hashscan reference: creation hash, or the label's consensus timestamp. */
  transaction: string;
  label?: string;
  status?: Invoice["status"];
};

export function Workspace() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [configError, setConfigError] = useState("");
  const [address, setAddress] = useState("");
  const [walletKind, setWalletKind] = useState<WalletKind>("hashpack");
  const [amount, setAmount] = useState("10");
  const [expiry, setExpiry] = useState("24");
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [created, setCreated] = useState<Created[]>([]);

  async function loadSettings() {
    setConfigError("");
    try {
      setSettings(await api<Settings>("/api/config"));
    } catch (error) {
      setConfigError(message(error));
    }
  }
  useEffect(() => {
    void loadSettings();
  }, []);

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
  async function wallet(kind = walletKind) {
    if (!settings) throw new Error("Wait for the network configuration.");
    const connected = await connectWallet(settings.config, kind);
    setWalletKind(kind);
    setAddress(connected.address);
    return connected;
  }
  async function associate() {
    if (!settings) return;
    const connected = await wallet();
    // HIP-719 associate() dry run: 22 = would succeed, 194 = already associated.
    const code = BigInt(
      String(
        await rpc(settings.config, "eth_call", [
          {
            from: connected.address,
            to: settings.config.token,
            data: "0x0a754de6",
          },
          "latest",
        ]),
      ),
    );
    if (code === 194n) {
      setNotice("This wallet is already associated with the settlement token.");
      return;
    }
    if (code !== 22n)
      throw new Error(`Hedera refused token association (response ${code}).`);
    await connected.associate();
    setNotice(
      "Association confirmed. Allow a few seconds for mirror indexing before creating an invoice.",
    );
  }
  async function create() {
    if (!settings?.config.checkout)
      throw new Error("Deploy the checkout contract first.");
    const connected = await wallet();
    await api(`/api/preflight?merchant=${connected.address}`);
    const units = tokenUnits(amount, settings.token.decimals);
    const hours = Number(expiry);
    if (!Number.isInteger(hours) || hours < 1 || hours > 720)
      throw new Error("Expiry must be between 1 and 720 hours.");
    // A label is published after creation; refuse a known failure before paying for the invoice.
    const text = label.trim();
    const { topicId } = settings.config;
    if (text) {
      if (!connected.publish || !topicId)
        throw new Error(
          "Only HashPack can publish labels, and the server needs HEDERA_TOPIC_ID. Clear the label to create the invoice without it.",
        );
      if (!isLabel(text))
        throw new Error(
          `The label must be a single line of 1 to ${MAX_LABEL_LENGTH} characters.`,
        );
    }
    const reference = hexlify(randomBytes(32));
    const expiresAt = Math.floor(Date.now() / 1000) + hours * 3600;
    const sent = await connected.send({
      to: settings.config.checkout,
      data: checkoutInterface.encodeFunctionData("createInvoice", [
        reference,
        units,
        expiresAt,
      ]),
    });
    setNotice("Creating your invoice on Hedera testnet…");
    const receipt = await confirm(settings.config, sent);
    // Read the ID from the event: msg.sender is authoritative for the merchant.
    const id = receipt.logs
      .filter(
        (log) =>
          log.address.toLowerCase() === settings.config.checkout?.toLowerCase(),
      )
      .map((log) => checkoutInterface.parseLog(log))
      .find((log) => log?.name === "InvoiceCreated")?.args.id;
    if (typeof id !== "string")
      throw new Error("Invoice creation was not confirmed.");
    setCreated((list) => [
      {
        id,
        amount: formatUnits(units, settings.token.decimals),
        symbol: settings.token.symbol,
        transaction: receipt.transactionHash,
        status: "open",
      },
      ...list,
    ]);
    const success =
      "Invoice created. Open it and copy the payment link to share.";
    setNotice(success);
    // No label to publish; publish and topicId were checked before sending.
    if (!text || !connected.publish || !topicId) return;
    setNotice("Invoice created. Approve the label message in HashPack…");
    try {
      await connected.publish(
        topicId,
        encodeInvoiceMessage(settings.config, id, text),
      );
    } catch (error) {
      setNotice(success);
      throw new Error(
        `The invoice was created, but its label was not published: ${message(error)}`,
      );
    }
    setCreated((list) =>
      list.map((item) => (item.id === id ? { ...item, label: text } : item)),
    );
    setLabel("");
    setNotice(success);
  }
  async function loadHistory() {
    if (!settings) return;
    const connected = await wallet();
    const { invoices, truncated } = await listMerchantInvoices(
      settings.config,
      connected.address,
    );
    const loaded = invoices.map(
      ({ invoice, label }): Created => ({
        id: invoice.id,
        amount: formatUnits(BigInt(invoice.amount), settings.token.decimals),
        symbol: settings.token.symbol,
        transaction: label.consensusTimestamp,
        label: label.text,
        status: invoice.status,
      }),
    );
    setCreated((list) => [
      ...list,
      ...loaded.filter((item) => !list.some((own) => own.id === item.id)),
    ]);
    const count = `${loaded.length} labelled invoice${loaded.length === 1 ? "" : "s"}`;
    setNotice(
      truncated
        ? `Showing ${count} from recent activity; older invoices were not read.`
        : loaded.length
          ? `Loaded ${count} from the invoice log.`
          : "No labelled invoices from this account on the invoice log.",
    );
  }

  return (
    <div className="workspace">
      <Glow className="hero-glow" />
      <Reveal className="page-heading">
        <div>
          <p className="eyebrow">
            <span className="live-dot" /> Payments, without the token mismatch
          </p>
          <h1>
            Your invoice.
            <br />
            <span className="gradient-text">Their HBAR.</span>
          </h1>
          <p className="lead">
            Request an exact token amount. Let your customer pay in HBAR.
            <br className="desktop-break" /> SaucerSwap handles the conversion
            in the same payment.
          </p>
        </div>
        <div className="heading-note">
          <span className="small-label">ONE TRANSACTION</span>
          <span className="large-arrow">↗</span>
          <p>
            Convert. Settle.
            <br />
            Return the difference.
          </p>
        </div>
      </Reveal>
      <Reveal className="flow-strip" delay={80}>
        <span>
          <b>01</b> Create an invoice
        </span>
        <i>→</i>
        <span>
          <b>02</b> Pay in HBAR
        </span>
        <i>→</i>
        <span>
          <b>03</b> Receive exact tokens
        </span>
        <span className="network-pill">Hedera testnet</span>
      </Reveal>
      <div className="workspace-grid">
        <Reveal as="section" className="panel invoice-panel" delay={140}>
          <div className="section-heading">
            <div>
              <p className="eyebrow">Merchant workspace</p>
              <h2>Create an invoice</h2>
            </div>
            <span className="icon-square">↗</span>
          </div>
          <p className="muted">
            The amount and recipient are fixed on-chain when you create the
            invoice.
          </p>
          {configError && (
            <div className="alert error" role="alert">
              {configError}{" "}
              <button
                className="text-button"
                onClick={() => void loadSettings()}
              >
                Retry
              </button>
            </div>
          )}
          {settings && !settings.config.checkout && (
            <div className="setup-note">
              <span className="setup-symbol">i</span>
              <div>
                <strong>Ready to explore. Deploy to accept payments.</strong>
                <p>
                  Live quotes are available now.{" "}
                  <Link href="/guide">Set up your testnet checkout →</Link>
                </p>
              </div>
            </div>
          )}
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void run("create", create);
            }}
          >
            <label htmlFor="amount">Amount to receive</label>
            <div className="amount-input">
              <input
                id="amount"
                inputMode="decimal"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                required
                autoComplete="off"
              />
              <span>{settings?.token.symbol || "HTS"}</span>
            </div>
            <div className="field-row">
              <div>
                <label htmlFor="settlement-token">Settlement token</label>
                <div id="settlement-token" className="read-field">
                  <span className="token-symbol">
                    {settings?.token.symbol.charAt(0) || "·"}
                  </span>
                  {settings?.token.name || "Loading token…"}
                  <small>{settings?.config.tokenId}</small>
                </div>
              </div>
              <div>
                <label htmlFor="expiry">Expires in</label>
                <select
                  id="expiry"
                  value={expiry}
                  onChange={(event) => setExpiry(event.target.value)}
                >
                  <option value="1">1 hour</option>
                  <option value="24">24 hours</option>
                  <option value="168">7 days</option>
                  <option value="720">30 days</option>
                </select>
              </div>
            </div>
            {settings?.config.topicId && (
              <>
                <label htmlFor="invoice-label">
                  Label (shown to the payer)
                </label>
                <input
                  id="invoice-label"
                  value={label}
                  maxLength={MAX_LABEL_LENGTH}
                  onChange={(event) => setLabel(event.target.value)}
                  placeholder="Optional, e.g. Logo design, March"
                  autoComplete="off"
                />
                <p className="muted">
                  Published on Hedera Consensus Service with HashPack. MetaMask
                  cannot sign HCS messages.
                </p>
              </>
            )}
            <div className="recipient-row">
              <div>
                <span className="small-label">RECIPIENT</span>
                <p title={address}>
                  {address ? shortAddress(address) : "Your connected wallet"}
                </p>
              </div>
              <div className="wallet-choice">
                {(["hashpack", "evm"] as const).map((kind) => (
                  <button
                    key={kind}
                    type="button"
                    className={`button small ${address && walletKind === kind ? "primary" : "secondary"}`}
                    disabled={
                      !!busy ||
                      !settings ||
                      settings.config.network !== "testnet"
                    }
                    onClick={() =>
                      void run("connect", async () => {
                        await wallet(kind);
                      })
                    }
                  >
                    {kind === "hashpack" ? "HashPack" : "MetaMask"}
                  </button>
                ))}
              </div>
            </div>
            <button
              className="button primary full"
              type="submit"
              disabled={
                !!busy ||
                !settings?.config.checkout ||
                settings.config.network !== "testnet"
              }
            >
              {busy === "create" ? "Confirm in wallet…" : "Create payment link"}{" "}
              <span>→</span>
            </button>
            <button
              type="button"
              className="text-button associate"
              disabled={
                !!busy || !settings || settings.config.network !== "testnet"
              }
              onClick={() => void run("associate", associate)}
            >
              {busy === "associate"
                ? "Associating…"
                : "First payment? Associate the settlement token"}
            </button>
          </form>
          {error && (
            <div className="alert error" role="alert">
              {error}
            </div>
          )}
          {notice && (
            <div className="alert success" role="status">
              {notice}
            </div>
          )}
        </Reveal>
        <aside className="preview-column">
          <Reveal delay={220}>
            <QuotePreview />
            <div className="template-note">
              <span className="code-icon">{"</>"}</span>
              <div>
                <strong>Built to be your starting point.</strong>
                <p>Keep the payment module. Make the experience yours.</p>
                <Link href="/guide">Explore the integration guide →</Link>
              </div>
            </div>
          </Reveal>
        </aside>
      </div>
      <Reveal as="section" className="activity">
        <div className="section-heading">
          <h2>Your invoices</h2>
          <span className="muted">{created.length} listed</span>
          {settings?.config.topicId && (
            <button
              type="button"
              className="button secondary small"
              disabled={!!busy || settings.config.network !== "testnet"}
              onClick={() => void run("history", loadHistory)}
            >
              {busy === "history" ? "Reading invoice log…" : "Load my invoices"}
            </button>
          )}
        </div>
        {created.length ? (
          <div className="invoice-list">
            {created.map((item) => (
              <div className="invoice-row" key={item.id}>
                <span className="invoice-icon">↗</span>
                <div>
                  <strong>
                    {item.amount} {item.symbol}
                    {item.status && ` · ${item.status}`}
                  </strong>
                  {item.label && <small>{item.label}</small>}
                  <small title={item.id}>{shortAddress(item.id)}</small>
                </div>
                <a
                  href={`https://hashscan.io/testnet/transaction/${item.transaction}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Transaction ↗
                </a>
                <Link
                  className="button secondary small"
                  href={`/pay/${item.id}`}
                >
                  Open invoice →
                </Link>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <span>▤</span>
            <div>
              <strong>Your first invoice starts here.</strong>
              <p>
                Invoices created here appear in this list. Labelled invoices can
                be reloaded from the HCS invoice log; terms stay on-chain.
              </p>
            </div>
          </div>
        )}
      </Reveal>
      <section className="benefits">
        <Reveal>
          <span>01 / EXACT DELIVERY</span>
          <h3>The amount you asked for.</h3>
          <p>
            The contract checks the merchant’s token balance increase before
            recording payment.
          </p>
        </Reveal>
        <Reveal delay={100}>
          <span>02 / BOUNDED SPEND</span>
          <h3>A ceiling, not a guess.</h3>
          <p>
            The payer sets a maximum HBAR spend. Unused HBAR is returned in the
            same transaction.
          </p>
        </Reveal>
        <Reveal delay={200}>
          <span>03 / VERIFIABLE RECEIPT</span>
          <h3>One invoice. One settlement.</h3>
          <p>
            A successful contract event ties the payment to the invoice, payer
            and merchant.
          </p>
        </Reveal>
      </section>
    </div>
  );
}
