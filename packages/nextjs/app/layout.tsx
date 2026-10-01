import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

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
    <html lang="en">
      <body>
        <header className="topbar">
          <Link href="/" className="brand">
            <span className="brand-mark">h</span>hbar checkout
            <span className="brand-dot">.</span>
          </Link>
          <nav>
            <Link href="/">Workspace</Link>
            <Link href="/examples">Examples</Link>
            <Link href="/guide">Build with it ↗</Link>
          </nav>
          <span className="template-badge">Scaffold-HBAR template</span>
        </header>
        <main>{children}</main>
        <footer>
          <span>Built on Hedera. Powered by SaucerSwap liquidity.</span>
          <Link href="/guide">Open-source checkout infrastructure ↗</Link>
        </footer>
      </body>
    </html>
  );
}
