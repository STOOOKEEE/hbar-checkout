"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { usePrefersReducedMotion } from "./useScrollProgress";

type RevealProps = {
  children: ReactNode;
  /** Delay before the transition starts, in milliseconds. */
  delay?: number;
  /** Initial vertical offset, in pixels. */
  y?: number;
  className?: string;
  as?: "div" | "section" | "li" | "span";
};

/** Fades and rises its children in once, the first time they enter the viewport. */
export function Reveal({
  children,
  delay = 0,
  y = 24,
  className,
  as: Tag = "div",
}: RevealProps) {
  const [element, setElement] = useState<HTMLElement | null>(null);
  const [intersected, setIntersected] = useState(false);
  const reducedMotion = usePrefersReducedMotion();
  const visible = intersected || reducedMotion;

  useEffect(() => {
    if (!element || visible) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setIntersected(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15 },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [element, visible]);

  const classes = ["reveal", visible ? "is-visible" : "", className ?? ""]
    .filter(Boolean)
    .join(" ");

  return (
    <Tag
      ref={setElement}
      className={classes}
      style={{
        transform: visible ? undefined : `translate3d(0, ${y}px, 0)`,
        transitionDelay: delay > 0 && !reducedMotion ? `${delay}ms` : undefined,
      }}
    >
      {children}
    </Tag>
  );
}
