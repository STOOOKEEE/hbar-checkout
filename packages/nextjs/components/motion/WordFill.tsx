"use client";

import { useRef } from "react";
import {
  usePrefersReducedMotion,
  useScrollProgress,
} from "./useScrollProgress";

type WordFillProps = {
  text: string;
  className?: string;
};

/** Words light up during the middle 70% of the paragraph's travel through the viewport. */
const FILL_START = 0.15;
const FILL_SPAN = 0.7;

/** Paragraph whose words go from dim to full, one by one, as it scrolls through the viewport. */
export function WordFill({ text, className }: WordFillProps) {
  const ref = useRef<HTMLParagraphElement | null>(null);
  const progress = useScrollProgress(ref);
  const reducedMotion = usePrefersReducedMotion();
  const words = text.split(/\s+/).filter(Boolean);
  const fill = reducedMotion
    ? 1
    : Math.min(1, Math.max(0, (progress - FILL_START) / FILL_SPAN));

  return (
    <p ref={ref} className={className ? `word-fill ${className}` : "word-fill"}>
      {words.map((word, index) => (
        <span key={`${index}-${word}`}>
          <span
            className={fill > index / words.length ? "word is-lit" : "word"}
          >
            {word}
          </span>
          {index < words.length - 1 ? " " : null}
        </span>
      ))}
    </p>
  );
}
