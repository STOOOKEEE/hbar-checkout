"use client";

import { useEffect, useRef } from "react";
import { usePrefersReducedMotion } from "./useScrollProgress";

type CountUpProps = {
  to: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  durationMs?: number;
};

function formatCount(
  value: number,
  decimals: number,
  prefix: string,
  suffix: string,
): string {
  const digits = value.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  return `${prefix}${digits}${suffix}`;
}

/**
 * Counts from 0 to `to` once visible. The final value is rendered on the
 * server and for reduced motion; the animation only starts after mount.
 */
export function CountUp({
  to,
  decimals = 0,
  prefix = "",
  suffix = "",
  durationMs = 1600,
}: CountUpProps) {
  const ref = useRef<HTMLSpanElement | null>(null);
  const reducedMotion = usePrefersReducedMotion();
  const finalText = formatCount(to, decimals, prefix, suffix);

  useEffect(() => {
    const element = ref.current;
    if (!element || reducedMotion) return;
    let frame = 0;
    element.textContent = formatCount(0, decimals, prefix, suffix);
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        observer.disconnect();
        const start = performance.now();
        const tick = (now: number) => {
          const t = Math.min(1, (now - start) / durationMs);
          // easeOutCubic
          element.textContent = formatCount(
            to * (1 - (1 - t) ** 3),
            decimals,
            prefix,
            suffix,
          );
          if (t < 1) frame = window.requestAnimationFrame(tick);
        };
        frame = window.requestAnimationFrame(tick);
      },
      { threshold: 0.4 },
    );
    observer.observe(element);
    return () => {
      observer.disconnect();
      window.cancelAnimationFrame(frame);
      element.textContent = formatCount(to, decimals, prefix, suffix);
    };
  }, [to, decimals, prefix, suffix, durationMs, reducedMotion]);

  return (
    <span className="count-up" aria-label={finalText}>
      <span ref={ref} aria-hidden="true">
        {finalText}
      </span>
    </span>
  );
}
