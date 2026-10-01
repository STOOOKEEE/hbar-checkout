"use client";

import { useEffect, useRef, useState } from "react";
import styles from "@/app/landing.module.css";
import { Reveal } from "@/components/motion/Reveal";
import { FlowIllustration } from "./FlowIllustration";

const STEPS = [
  {
    title: "Create the invoice",
    body: "The merchant fixes the token amount, recipient and expiry on-chain. An optional label can be anchored on Hedera Consensus Service.",
  },
  {
    title: "Quote in HBAR",
    body: "A live SaucerSwap exact-output quote tells the payer how much HBAR is needed, capped by a maximum spend.",
  },
  {
    title: "Pay in one transaction",
    body: "The payer signs with HashPack or MetaMask. Swap, exact delivery check and refund of unused HBAR are atomic.",
  },
  {
    title: "Verify, then fulfill",
    body: "Your server calls verifyInvoicePayment before delivering anything. No trust in the browser required.",
  },
] as const;

export function HowItWorks() {
  const [active, setActive] = useState(0);
  const cardRefs = useRef<Array<HTMLLIElement | null>>([]);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const center = window.innerHeight / 2;
      let nearest = 0;
      let best = Number.POSITIVE_INFINITY;
      cardRefs.current.forEach((card, index) => {
        if (!card) return;
        const rect = card.getBoundingClientRect();
        const distance = Math.abs(rect.top + rect.height / 2 - center);
        if (distance < best) {
          best = distance;
          nearest = index;
        }
      });
      setActive(nearest);
    };
    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <section className={styles.how} aria-labelledby="how-title">
      <div className="container">
        <p className="eyebrow">How it works</p>
        <h2 id="how-title" className={styles.sectionTitle}>
          From quote to verified receipt
        </h2>
        <div className={styles.howGrid}>
          <ol className={styles.howSteps}>
            {STEPS.map((step, index) => (
              <li
                key={step.title}
                ref={(node) => {
                  cardRefs.current[index] = node;
                }}
                className={styles.howItem}
                aria-current={active === index ? "step" : undefined}
              >
                <Reveal>
                  <div
                    className={`card ${styles.howCard} ${active === index ? styles.howCardActive : ""}`}
                  >
                    <span className={styles.howIndex}>0{index + 1}</span>
                    <h3>{step.title}</h3>
                    <p>{step.body}</p>
                  </div>
                </Reveal>
              </li>
            ))}
          </ol>
          <div className={styles.howVisual}>
            <FlowIllustration step={active} />
          </div>
        </div>
      </div>
    </section>
  );
}
