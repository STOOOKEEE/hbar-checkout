"use client";

import { useState } from "react";
import Link from "next/link";
import { Glow } from "@/components/motion/Glow";
import { Reveal } from "@/components/motion/Reveal";
import { PayWithHbar } from "@/components/PayWithHbar";

export function Payment({ id }: { id: string }) {
  const [paid, setPaid] = useState(false);
  return (
    <div className="payment-page">
      <Glow className="hero-glow" />
      <Link href="/workspace" className="back-link">
        ← Merchant workspace
      </Link>
      <Reveal>
        <p className="eyebrow">Secure the amount. Simplify the payment.</p>
        <h1>
          {paid ? (
            <span className="gradient-text">Payment received.</span>
          ) : (
            <>
              An exact amount.
              <br />
              <span className="gradient-text">Paid your way.</span>
            </>
          )}
        </h1>
        <p className="lead">
          Pay in HBAR. The merchant receives the requested tokens through
          SaucerSwap.
        </p>
      </Reveal>
      <Reveal delay={120}>
        <PayWithHbar invoiceId={id} hosted onPaid={() => setPaid(true)} />
      </Reveal>
      <p className="payment-footnote">
        Invoice terms and settlement are enforced by the checkout contract.
        <br />
        This reference application signs on Hedera testnet only.
      </p>
    </div>
  );
}
