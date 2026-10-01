"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import type { RefObject } from "react";

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

function subscribeReducedMotion(onChange: () => void): () => void {
  const query = window.matchMedia(REDUCED_MOTION_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

/** True when the user asked the OS to reduce motion. Always false during SSR. */
export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeReducedMotion,
    () => window.matchMedia(REDUCED_MOTION_QUERY).matches,
    () => false,
  );
}

function measure(element: HTMLElement): number {
  const rect = element.getBoundingClientRect();
  const viewport = window.innerHeight;
  const travel = viewport + rect.height;
  if (travel <= 0) return 0;
  return Math.min(1, Math.max(0, (viewport - rect.top) / travel));
}

/**
 * Progress (0..1) of an element through the viewport: 0 when its top reaches
 * the viewport bottom, 1 when its bottom leaves the viewport top.
 * Lenis drives native window scrolling, so plain scroll events are enough.
 */
export function useScrollProgress(ref: RefObject<HTMLElement | null>): number {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      setProgress(measure(element));
    };
    const schedule = () => {
      if (frame === 0) frame = window.requestAnimationFrame(update);
    };
    schedule();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      if (frame !== 0) window.cancelAnimationFrame(frame);
    };
  }, [ref]);

  return progress;
}
