import styles from "@/app/landing.module.css";

const CAPTIONS = [
  "Invoice fixed on-chain",
  "Live quote · max HBAR spend",
  "Swap · exact delivery · refund",
  "verifyInvoicePayment ✓",
] as const;

const cx = (...names: Array<string | false>) => names.filter(Boolean).join(" ");

export function FlowIllustration({ step }: { step: number }) {
  const quoting = step === 1;
  const paying = step === 2;
  const verifying = step === 3;

  return (
    <div className={styles.flow} aria-hidden="true">
      <svg className={styles.flowSvg} viewBox="0 0 400 480" fill="none">
        <defs>
          <linearGradient id="flow-iridescent" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#c8f169" />
            <stop offset="50%" stopColor="#6fd6ff" />
            <stop offset="100%" stopColor="#b9a8ff" />
          </linearGradient>
          <radialGradient id="flow-core" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#6fd6ff" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#6fd6ff" stopOpacity="0" />
          </radialGradient>
        </defs>

        <path
          className={styles.flowTrack}
          d="M100 96 C100 170 140 210 200 240"
        />
        <path
          className={styles.flowTrack}
          d="M200 240 C260 270 300 310 300 384"
        />
        <path className={styles.flowTrack} d="M200 240 C70 240 50 160 100 96" />

        <path
          className={cx(
            styles.flowDots,
            (quoting || paying) && styles.flowDotsOn,
          )}
          d="M100 96 C100 170 140 210 200 240"
        />
        <path
          className={cx(
            styles.flowDots,
            (paying || verifying) && styles.flowDotsOn,
          )}
          d="M200 240 C260 270 300 310 300 384"
        />
        <path
          className={cx(
            styles.flowDots,
            styles.flowDotsRefund,
            paying && styles.flowDotsOn,
          )}
          d="M200 240 C70 240 50 160 100 96"
        />

        <g className={cx(styles.flowNode, step >= 1 && styles.flowNodeOn)}>
          <circle cx="100" cy="96" r="40" />
          <text x="100" y="101" textAnchor="middle">
            HBAR
          </text>
        </g>

        <g
          className={cx(
            styles.flowRing,
            (quoting || paying) && styles.flowRingOn,
          )}
        >
          <circle
            className={styles.flowRingGlow}
            cx="200"
            cy="240"
            r="86"
            fill="url(#flow-core)"
          />
          <circle className={styles.flowRingTrack} cx="200" cy="240" r="58" />
          <circle
            className={cx(styles.flowRingArc, paying && styles.flowRingSpin)}
            cx="200"
            cy="240"
            r="58"
            stroke="url(#flow-iridescent)"
          />
          <text x="200" y="245" textAnchor="middle">
            SaucerSwap
          </text>
        </g>

        <g
          className={cx(
            styles.flowNode,
            (step === 0 || paying || verifying) && styles.flowNodeOn,
          )}
        >
          <circle cx="300" cy="384" r="40" />
          <text x="300" y="389" textAnchor="middle">
            USDC
          </text>
        </g>

        <g className={cx(styles.flowCheck, verifying && styles.flowCheckOn)}>
          <circle cx="340" cy="344" r="18" fill="url(#flow-iridescent)" />
          <path d="M332 344 l6 6 l11 -12" />
        </g>
      </svg>
      <p className={styles.flowCaption}>
        <span className={styles.flowCaptionStep}>0{step + 1}</span>
        {CAPTIONS[step]}
      </p>
    </div>
  );
}
