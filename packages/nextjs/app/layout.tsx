import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500"],
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
    <html lang="en" className={inter.variable}>
      <body>
        <header className="topbar">
          <Link href="/" className="brand">
            hbar checkout
          </Link>
          <nav aria-label="Main">
            <Link href="/">Workspace</Link>
            <Link href="/examples">Examples</Link>
            <Link href="/guide">Guide</Link>
            <a
              href="https://github.com/STOOOKEEE/hbar-checkout"
              target="_blank"
              rel="noreferrer"
            >
              GitHub
            </a>
          </nav>
        </header>
        <main>{children}</main>
        <footer className="site-footer">
          HBAR Checkout · Scaffold-HBAR template on Hedera
        </footer>
      </body>
    </html>
  );
}
