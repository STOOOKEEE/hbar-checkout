"use client";

import { useState } from "react";
import Link from "next/link";
import { Glow } from "@/components/motion/Glow";
import { Reveal } from "@/components/motion/Reveal";
import { QuotePreview } from "@/components/QuotePreview";

const examples = {
  service: {
    label: "Service invoice",
    title: "A 25 USDC service. Paid from HBAR.",
    amount: "25",
    description:
      "Your customer holds HBAR. Your service is priced in USDC. Keep the amount you receive fixed and let the quote calculate the required HBAR.",
    extension:
      "Attach your service order to an on-chain invoice. Record its chain, checkout address and invoice ID, then mark it paid after server-side receipt verification.",
  },
  credits: {
    label: "Prepaid API credits",
    title: "Top up 20 USDC of service credits.",
    amount: "20",
    description:
      "A developer buys credits for your API or compute service using HBAR. Your service accounts for the purchase in USDC.",
    extension:
      "Map the invoice to the authenticated credit account. After independent receipt verification, add credits once in a database transaction. Usage metering and service refunds belong to your app.",
  },
} as const;

const clientSnippet = `import { PayWithHbar } from "@/components/PayWithHbar";

<PayWithHbar
  invoiceId={order.invoiceId}
  onPaid={({ reference }) =>
    fetch(\`/api/orders/\${order.id}/fulfill\`, {
      method: "POST",
      body: JSON.stringify({ invoiceId: order.invoiceId, reference }),
    })
  }
/>`;
const serverSnippet = `import { verifyInvoicePayment } from "@hbar-checkout/checkout";
import { getConfig } from "@/lib/server";

const result = await verifyInvoicePayment(getConfig(), {
  invoiceId: order.invoiceId, // from your database, not the browser
  reference,
});
if (result.status === "paid") await fulfillOnce(order, result.payment);`;

export default function Examples() {
  const [selected, setSelected] = useState<keyof typeof examples>("service");
  const example = examples[selected];
  return (
    <div className="workspace examples-page">
      <Glow className="hero-glow" />
      <Reveal>
        <p className="eyebrow">Build with HBAR Checkout</p>
        <h1>
          Start with a<br />
          <span className="gradient-text">real payment need.</span>
        </h1>
        <p className="lead">
          Two product examples use the same quote component and payment
          integration.
        </p>
      </Reveal>
      <div className="example-options" role="group" aria-label="Use case">
        {(Object.keys(examples) as (keyof typeof examples)[]).map((key) => (
          <button
            key={key}
            className={`button ${selected === key ? "primary" : "secondary"}`}
            aria-pressed={selected === key}
            onClick={() => setSelected(key)}
          >
            {examples[key].label}
          </button>
        ))}
      </div>
      <div className="workspace-grid">
        <Reveal as="section" className="panel" delay={80}>
          <p className="eyebrow">{example.label}</p>
          <h2>{example.title}</h2>
          <p>{example.description}</p>
          <h3>Reuse the component</h3>
          <pre>{clientSnippet}</pre>
          <h3>Fulfill only after server verification</h3>
          <pre>{serverSnippet}</pre>
          <p>
            <code>pending</code> means the receipt is not indexed yet; a
            mismatched receipt throws. See the idempotent example in{" "}
            <code>app/api/orders/[orderId]/fulfill/route.ts</code>.
          </p>
          <h3>Connect your application</h3>
          <p>{example.extension}</p>
          <div className="setup-note">
            <p>
              These are live pricing examples. They do not collect a payment,
              deliver a service or credit an account. Mainnet USDC is read-only;
              the testnet invoice flow settles in testnet USDC.
            </p>
          </div>
          <a
            className="button secondary"
            href="https://github.com/STOOOKEEE/hbar-checkout/blob/main/docs/CUSTOMIZATION.md"
          >
            Read the integration recipe ↗
          </a>
        </Reveal>
        <Reveal delay={160}>
          <QuotePreview key={selected} initialAmount={example.amount} />
        </Reveal>
      </div>
      <section className="benefits">
        <Reveal>
          <span>PROTOCOL CAPABILITY</span>
          <h3>Existing liquidity.</h3>
          <p>
            SaucerSwap converts HBAR to the requested token. A standalone
            invoice contract does not supply that liquidity.
          </p>
        </Reveal>
        <Reveal delay={100}>
          <span>TEMPLATE CAPABILITY</span>
          <h3>Exact settlement.</h3>
          <p>
            The payment contract binds merchant and amount, limits spend and
            returns surplus. Removing the swap breaks HBAR-funded token
            settlement.
          </p>
        </Reveal>
        <Reveal delay={200}>
          <span>YOUR APPLICATION</span>
          <h3>Your order and delivery.</h3>
          <p>
            Keep your catalog, customer identity and fulfillment rules. Verify
            the receipt on the server before granting access.
          </p>
        </Reveal>
      </section>
      <Link href="/guide" className="button primary">
        Build your checkout →
      </Link>
    </div>
  );
}
