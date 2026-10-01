"use client";

import { useRef } from "react";
import {
  usePrefersReducedMotion,
  useScrollProgress,
} from "./useScrollProgress";

type DriftTextProps = {
  lines: string[];
  className?: string;
};

/** Maximum horizontal travel of each line, in percent of its own width. */
const DRIFT_PERCENT = 12;

/** Giant display lines that drift horizontally, alternating direction, as the block scrolls by. */
export function DriftText({ lines, className }: DriftTextProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const progress = useScrollProgress(ref);
  const reducedMotion = usePrefersReducedMotion();
  const offset = reducedMotion ? 0 : DRIFT_PERCENT * (1 - 2 * progress);

  return (
    <div ref={ref} className={className ? `drift ${className}` : "drift"}>
      {lines.map((line, index) => {
        const sign = index % 2 === 0 ? 1 : -1;
        return (
          <span
            key={`${index}-${line}`}
            className="drift-line"
            style={{
              transform: `translate3d(${(sign * offset).toFixed(3)}%, 0, 0)`,
            }}
          >
            {line}
          </span>
        );
      })}
    </div>
  );
}
