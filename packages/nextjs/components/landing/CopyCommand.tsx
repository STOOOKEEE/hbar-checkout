"use client";

import { useEffect, useState } from "react";
import styles from "@/app/landing.module.css";

export function CopyCommand({ command }: { command: string }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 1800);
    return () => window.clearTimeout(timer);
  }, [copied]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className={styles.command}>
      <code className={styles.commandText}>
        <span className={styles.commandPrompt} aria-hidden="true">
          $
        </span>
        {command}
      </code>
      <button
        type="button"
        className={`btn btn-ghost ${styles.commandButton}`}
        onClick={copy}
      >
        <span aria-live="polite">{copied ? "Copied" : "Copy"}</span>
      </button>
    </div>
  );
}
