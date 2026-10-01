import Link from "next/link";
import styles from "./landing.module.css";
import { CopyCommand } from "@/components/landing/CopyCommand";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { StatsBento } from "@/components/landing/StatsBento";
import { DriftText } from "@/components/motion/DriftText";
import { Glow } from "@/components/motion/Glow";
import { Marquee } from "@/components/motion/Marquee";
import { Reveal } from "@/components/motion/Reveal";
import { WordFill } from "@/components/motion/WordFill";

const AUDIENCES = [
  {
    title: "Service invoices",
    body: "Bill a client a fixed USDC amount and let them settle from whatever HBAR they hold.",
  },
  {
    title: "Marketplace checkout",
    body: "Give every order its own on-chain invoice so sellers receive the exact price, never a rounded guess.",
  },
  {
    title: "Prepaid API credits",
    body: "Top up usage balances only after your server has verified the payment on Hedera.",
  },
] as const;

const ECOSYSTEM = [
  "SaucerSwap",
  "HashPack",
  "Hedera Token Service",
  "Hedera Consensus Service",
  "Mirror Node",
  "Scaffold-HBAR",
  "USDC",
];

export default function Home() {
  return (
    <div className={styles.landing}>
      <section className={styles.hero} aria-labelledby="hero-title">
        <Glow className={styles.heroGlow} />
        <div className={`container ${styles.heroInner}`}>
          <Reveal>
            <p className="eyebrow">HBAR CHECKOUT · SCAFFOLD-HBAR TEMPLATE</p>
          </Reveal>
          <Reveal delay={80}>
            <h1 id="hero-title" className={styles.heroTitle}>
              <span>Price in USDC.</span>
              <span className="gradient-text">Get paid from HBAR.</span>
            </h1>
          </Reveal>
          <Reveal delay={160}>
            <p className={styles.heroCopy}>
              An exact-amount checkout for Hedera: your customer pays in HBAR,
              SaucerSwap converts, and you receive the exact token amount — in
              one transaction.
            </p>
          </Reveal>
          <Reveal delay={240}>
            <div className={styles.actions}>
              <Link href="/workspace" className="btn btn-iridescent">
                Open the workspace ↗
              </Link>
              <Link href="/guide" className="btn btn-ghost">
                Build with it
              </Link>
            </div>
          </Reveal>
        </div>
        <div className={styles.scrollCue} aria-hidden="true">
          <span>Scroll</span>
          <span className={styles.scrollCueLine} />
        </div>
      </section>

      <section
        className={styles.drift}
        aria-label="Exact amount, any HBAR wallet"
      >
        <DriftText lines={["Exact amount", "Any HBAR wallet"]} />
      </section>

      <section
        className={styles.statement}
        aria-label="What HBAR Checkout does"
      >
        <div className="container">
          <WordFill
            className={styles.wordFill}
            text="HBAR Checkout turns a live SaucerSwap quote into an on-chain invoice that settles in one Hedera transaction: exact tokens to the merchant, unused HBAR back to the payer, and a receipt anyone can verify."
          />
        </div>
      </section>

      <HowItWorks />

      <StatsBento />

      <section className={styles.bigStatement} aria-label="Precision">
        <div className="container">
          <Reveal>
            <p className={styles.bigStatementText}>
              Built for checkouts that{" "}
              <span className="gradient-text">can’t be off by a cent.</span>
            </p>
          </Reveal>
        </div>
      </section>

      <section className={styles.ecosystem} aria-labelledby="ecosystem-title">
        <div className="container">
          <p id="ecosystem-title" className="eyebrow">
            BUILT ON THE HEDERA ECOSYSTEM
          </p>
        </div>
        <Marquee items={ECOSYSTEM} />
      </section>

      <section className={styles.audience} aria-labelledby="audience-title">
        <div className="container">
          <p className="eyebrow">Use cases</p>
          <h2 id="audience-title" className={styles.sectionTitle}>
            Who it’s for
          </h2>
          <ul className={styles.audienceGrid}>
            {AUDIENCES.map((audience, index) => (
              <Reveal key={audience.title} as="li" delay={index * 90}>
                <Link
                  href="/examples"
                  className={`card ${styles.audienceCard}`}
                >
                  <h3>{audience.title}</h3>
                  <p>{audience.body}</p>
                  <span className={styles.audienceLink} aria-hidden="true">
                    See the example →
                  </span>
                </Link>
              </Reveal>
            ))}
          </ul>
        </div>
      </section>

      <section className={styles.finalCta} aria-labelledby="final-title">
        <Glow className={styles.finalGlow} />
        <div className={`container ${styles.finalInner}`}>
          <Reveal>
            <h2 id="final-title" className={styles.finalTitle}>
              Start from a working{" "}
              <span className="gradient-text">payment path.</span>
            </h2>
          </Reveal>
          <Reveal delay={100}>
            <CopyCommand command="npx create-scaffold-hbar@latest --template STOOOKEEE/hbar-checkout" />
          </Reveal>
          <Reveal delay={180}>
            <div className={styles.actions}>
              <Link href="/workspace" className="btn btn-iridescent">
                Open the workspace ↗
              </Link>
              <a
                href="https://github.com/STOOOKEEE/hbar-checkout"
                className="btn btn-ghost"
              >
                View on GitHub
              </a>
            </div>
          </Reveal>
        </div>
      </section>
    </div>
  );
}
