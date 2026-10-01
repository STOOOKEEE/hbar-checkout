import styles from "@/app/landing.module.css";
import { CountUp } from "@/components/motion/CountUp";
import { Reveal } from "@/components/motion/Reveal";

const STATS = [
  { value: 1, label: "transaction to convert, settle and refund" },
  {
    value: 4,
    label:
      "native Hedera services (Smart Contracts, Token Service, Consensus Service, Mirror Node)",
  },
  { value: 49, label: "automated tests (38 TypeScript + 11 contract)" },
  { value: 0, label: "private keys on the server" },
] as const;

export function StatsBento() {
  return (
    <section className={styles.stats} aria-labelledby="stats-title">
      <div className="container">
        <p className="eyebrow">By the numbers</p>
        <h2 id="stats-title" className={styles.sectionTitle}>
          Small surface, verifiable money path
        </h2>
        <ul className={styles.bento}>
          {STATS.map((stat, index) => (
            <Reveal
              key={stat.label}
              as="li"
              delay={index * 90}
              className={
                index === 0
                  ? `${styles.bentoCard} ${styles.bentoFeature}`
                  : `card ${styles.bentoCard}`
              }
            >
              <span className={styles.bentoValue}>
                <CountUp to={stat.value} />
              </span>
              <span className={styles.bentoLabel}>{stat.label}</span>
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  );
}
