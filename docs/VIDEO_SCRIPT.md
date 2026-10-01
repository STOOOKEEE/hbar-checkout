# HBAR Checkout demo video: script and shot list

[Submission package](SUBMISSION.md) · [Payment evidence](VALIDATION.md) · [Developer walkthrough](REVIEW.md)

**Target:** about 3 minutes; the submission form requires a public video URL under five minutes. The video follows the judging rubric: who uses it and why the integration is load-bearing, how a developer adopts it, which Hedera services it composes, and real testnet proof. Read only the **Voiceover** lines. Timecodes are editing targets.

## Before recording

- Hosted app: https://hbar-checkout.vercel.app (merchant workspace at the site root; testnet USDC `0.0.5449`, checkout `0x140e27Cf63790a558d66C8796A67984d5164055E`, HCS topic `0.0.10814952`).
- **Scene 4 has two versions.** Record version A only after a real HashPack payment works on the hosted app (needs `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` on Vercel and a HashPack testnet account holding about 1 HBAR). Otherwise use version B, which shows only recorded evidence. Never present a wallet click as the origin of a transaction it did not produce.
- Two browser profiles help: one HashPack account as merchant, another as payer. Keep seed phrases, private keys and personal tabs out of frame.
- Record at 1920×1080, 30 fps, browser zoom 125–150 % so amounts are readable.

## Script

### 00:00–00:15 — Hook

**Screen:** open on the hosted workspace at the site root (`/`) with the title `HBAR Checkout · Scaffold-HBAR template`, or on your face. Caption: `Price in USDC. Get paid from HBAR.`

**Voiceover:** “Your Hedera users hold H-bar. Your business prices in USDC. HBAR Checkout is a Scaffold-HBAR template that closes that gap: the customer pays in H-bar, and the merchant receives the exact USDC amount, in one transaction.”

### 00:15–00:40 — Who it is for and why SaucerSwap is load-bearing

**Screen:** `/examples` (service invoice, prepaid API credits), then the live quote panel with `USDC · Mainnet (read only)`, enter `25`, click **Get live quote**.

**Voiceover:** “It is for teams building service invoices, marketplace checkout or prepaid API credits on Hedera. The conversion comes from a real SaucerSwap pool, with an exact-output route: it computes the H-bar needed to deliver a fixed USDC amount. Remove SaucerSwap and the template has no way to settle a USDC price from H-bar. Mainnet here is a live, read-only quote.”

### 00:40–01:05 — Merchant creates an invoice (HCS label)

**Screen:** `/` → **HashPack** → approve in HashPack → amount `1`, label `Logo design`, **Create payment link** → approve both prompts → the invoice row appears with its label. Briefly open the topic on HashScan: https://hashscan.io/testnet/topic/0.0.10814952. If HashPack is not set up, show the existing paid invoice's label and the HashScan topic instead and skip the clicks.

**Voiceover:** “The merchant connects HashPack, signing native Hedera transactions, so ED25519 accounts work too. The invoice terms, merchant, amount and expiry are fixed in the smart contract. The description goes to a Hedera Consensus Service topic. Anyone can write to that topic, but the app only shows a label submitted by the invoice's own merchant account. We tested this live: a fake label from another account was ignored.”

### 01:05–01:40 — Payer pays in HBAR

**Version A (live HashPack payment):** open the payment link in the payer profile → **Get payment quote** → show estimated and maximum HBAR → wallet **HashPack** → pay → “Settled and verified”.

**Version B (recorded evidence):** open the [paid USDC invoice](https://hbar-checkout.vercel.app/pay/0x08c3361023db4b0b2097fe1b82f90ed5477056e570daca65967f81c521357791?tx=0xbc333a625dcc2f71703366f7f45a3277783fb21496f117e7882ab0761efc3dd8) and zoom on `Paid`, `1 USDC`, `0.43988881 HBAR converted`, `0.00219945 HBAR returned`, then the [mirror-node result](https://testnet.mirrornode.hedera.com/api/v1/contracts/results/0xbc333a625dcc2f71703366f7f45a3277783fb21496f117e7882ab0761efc3dd8).

**Voiceover (A):** “The payer gets a quote with a maximum spend, and pays from HashPack. In one transaction the contract swaps through SaucerSwap, checks that the merchant's USDC balance rose by exactly the invoice amount, and refunds unused H-bar. The page then verifies the receipt against the invoice.”

**Voiceover (B):** “This is a real testnet payment between two accounts. The merchant received exactly one USDC. The payer spent 0.43988881 H-bar on the conversion, and 0.00219945 H-bar of unused input came back, in the same transaction. Testnet pool prices are not market prices. The receipt is verified against the invoice, not just a transaction hash.”

### 01:40–02:20 — Adopt it in ten lines

**Screen:** terminal: `npx create-scaffold-hbar@latest --template STOOOKEEE/hbar-checkout`, then the `/examples` snippets: `<PayWithHbar invoiceId=… onPaid=… />` and `verifyInvoicePayment(...)` in the fulfill route. Show `README.md` and `AGENTS.md` for a second each.

**Voiceover:** “A developer generates it with one Scaffold-HBAR command. On the frontend, drop in the PayWithHbar component with an invoice ID. On the server, call verifyInvoicePayment before fulfilling the order: it checks the deployment, the invoice and the receipt. The included fulfillment example is idempotent, so a second call never delivers twice. Your app keeps its own order database; the payment path is done.”

### 02:20–02:45 — Hedera depth and quality

**Screen:** the architecture diagram in `docs/ARCHITECTURE.md`, then `npm test` output and `docs/VALIDATION.md`.

**Voiceover:** “Under the hood it composes a Solidity contract, HTS tokens, the Consensus Service, native HashPack transactions and the mirror node for verification. It ships with tests, measured gas limits, Node 20 support, and a validation log where every claim links to a testnet transaction.”

### 02:45–03:00 — Close

**Screen:** hosted URL and GitHub URL. Caption: `Testnet USDC payment verified · Mainnet quote read-only · Unaudited template`.

**Voiceover:** “HBAR Checkout: price in USDC, get paid from H-bar, on Hedera. The contract is not audited and mainnet signing is disabled; everything shown settles on testnet. Clone it and ship your checkout.”

## Edit checklist

- Captions on every number shown (`1 USDC`, spent HBAR, returned HBAR) and on `Mainnet · read only` whenever the mainnet quote is visible.
- Hard cuts, close-ups on values. No music louder than the voice.
- Check every URL and number against [Validation](VALIDATION.md) before export.
- Export H.264/AAC MP4 1080p, add subtitles if possible, upload as public or unlisted (no login needed), then paste the URL into the form.
