"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

const PANEL_ID = "mobile-nav-panel";
/** Matches the breakpoint in theme.css where the menu replaces the inline nav. */
const MOBILE_QUERY = "(max-width: 760px)";

/** Compact header navigation for small screens: a Menu toggle revealing the main links. */
export function MobileNav() {
  const [open, setOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      toggleRef.current?.focus();
    };
    // Leaving the mobile layout hides the panel, so drop the open state and its scroll lock.
    const mobile = window.matchMedia(MOBILE_QUERY);
    const onBreakpoint = () => {
      if (!mobile.matches) setOpen(false);
    };
    // Lock the page behind the open panel. Lenis scrolls programmatically and
    // ignores `data-lenis-prevent` on <html> itself, so the marker goes on <body>.
    const root = document.documentElement;
    root.classList.add("mobile-nav-open");
    document.body.setAttribute("data-lenis-prevent", "");
    document.addEventListener("keydown", onKeyDown);
    mobile.addEventListener("change", onBreakpoint);
    return () => {
      root.classList.remove("mobile-nav-open");
      document.body.removeAttribute("data-lenis-prevent");
      document.removeEventListener("keydown", onKeyDown);
      mobile.removeEventListener("change", onBreakpoint);
    };
  }, [open]);

  const close = () => setOpen(false);

  return (
    <div className="mobile-nav">
      <button
        ref={toggleRef}
        type="button"
        className="mobile-nav-toggle"
        aria-expanded={open}
        aria-controls={PANEL_ID}
        onClick={() => setOpen((value) => !value)}
      >
        {open ? "Close" : "Menu"}
      </button>
      <nav
        id={PANEL_ID}
        className="mobile-nav-panel"
        aria-label="Main"
        hidden={!open}
      >
        <Link href="/workspace" onClick={close}>
          Workspace
        </Link>
        <Link href="/examples" onClick={close}>
          Examples
        </Link>
        <Link href="/guide" onClick={close}>
          Build with it ↗
        </Link>
      </nav>
    </div>
  );
}
