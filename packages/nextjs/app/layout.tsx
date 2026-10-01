import type { Metadata } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import Link from "next/link";
import { MobileNav } from "../components/MobileNav";
import { SmoothScroll } from "../components/motion/SmoothScroll";
import "./globals.css";
import "./theme.css";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-space-grotesk",
});

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "HBAR Checkout · Exact-amount checkout on Hedera",
  description:
    "A Scaffold-HBAR template for invoices paid in HBAR and settled in HTS tokens through SaucerSwap.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${spaceGrotesk.variable} ${inter.variable}`}>
      <body>
        <SmoothScroll />
        <header className="topbar">
          <Link href="/" className="brand">
            <span className="brand-mark" aria-hidden="true">
              h
            </span>
            hbar checkout
            <span className="brand-dot">.</span>
          </Link>
          <nav aria-label="Main">
            <Link href="/workspace">Workspace</Link>
            <Link href="/examples">Examples</Link>
            <Link href="/guide">Build with it ↗</Link>
          </nav>
          <Link href="/workspace" className="btn btn-iridescent topbar-cta">
            Open workspace
          </Link>
          <MobileNav />
        </header>
        <main>{children}</main>
        <footer className="site-footer">
          <div className="site-footer-brand">
            <span className="gradient-text">hbar checkout.</span>
          </div>
          <span>Built on Hedera · Powered by SaucerSwap liquidity</span>
          <div className="site-footer-links">
            <Link href="/guide">Build with it ↗</Link>
            <a
              href="https://github.com/STOOOKEEE/hbar-checkout"
              target="_blank"
              rel="noreferrer"
            >
              GitHub ↗
            </a>
          </div>
        </footer>
      </body>
    </html>
  );
}
