"use client";

import { useState } from "react";
import Link from "next/link";
import { PayWithHbar } from "@/components/PayWithHbar";

export function Payment({ id }: { id: string }) {
  const [paid, setPaid] = useState(false);
  return (
    <div className="payment-page">
      <Link href="/" className="back-link">
        ← Merchant workspace
      </Link>
      <p className="eyebrow">Secure the amount. Simplify the payment.</p>
      <h1>
        {paid ? (
          "Payment received."
        ) : (
          <>
            An exact amount.
            <br />
            Paid your way.
          </>
        )}
      </h1>
      <p className="lead">
        Pay in HBAR. The merchant receives the requested tokens through
        SaucerSwap.
      </p>
      <PayWithHbar invoiceId={id} hosted onPaid={() => setPaid(true)} />
      <p className="payment-footnote">
        Invoice terms and settlement are enforced by the checkout contract.
        <br />
        This reference application signs on Hedera testnet only.
      </p>
    </div>
  );
}
