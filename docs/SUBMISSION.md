# Submission package

[README](../README.md) · [Reviewer walkthrough](REVIEW.md) · [Validation](VALIDATION.md)

**Status:** source, live quote demo, testnet deployment and a real two-wallet payment are available. `npm run submission:check` verifies the payment against Hedera RPC and mirror data. This is a prepared submission draft, not an entry that has been sent to the organizers.

## Short description

SaucerPay is a Scaffold-HBAR template for Hedera apps that price in USDC while their users hold HBAR in HashPack. A drop-in `PayWithHbar` component pays an on-chain invoice in one transaction that swaps HBAR through SaucerSwap, delivers the exact USDC amount to the merchant and refunds unused HBAR; `verifyInvoicePayment` lets the server fulfill only after verifying the receipt. It uses Hedera smart contracts, HTS, an HCS invoice log with merchant-only labels, the mirror node and native HashPack transactions.

## Why the integration matters

The buyer holds HBAR; the merchant requests a fixed amount of another token. SaucerSwap supplies the liquidity and exact-output swap. The template binds that swap to an invoice and verifies actual delivery and refund before accepting payment. Without the protocol integration, this HBAR-funded token settlement capability disappears.

The reference checkout settles in testnet USDC (`0.0.5449`). The mainnet USDC preview reads actual mainnet liquidity and demonstrates the commercial asset-mismatch use case without enabling mainnet signing. Service and credit examples share the same component and server gate; the example fulfill endpoint uses placeholder in-memory maps and does not claim to provide an order database, x402 facilitator or credit ledger.

## Links to provide

- Source: https://github.com/STOOOKEEE/hedera-temlate
- Hosted demo: https://saucerpay-hedera.vercel.app
- Developer docs: [README navigation](../README.md#find-the-right-guide)
- Architecture: [payment flow and units](ARCHITECTURE.md)
- Contract deployment: [Hedera Mirror Node result](https://testnet.mirrornode.hedera.com/api/v1/contracts/results/0xf7cd48ffb48e9385be5f1be7aa064921754398ab7f1a6f670c251da907d29ed1) · [HashScan](https://hashscan.io/testnet/transaction/0xf7cd48ffb48e9385be5f1be7aa064921754398ab7f1a6f670c251da907d29ed1)
- Two-wallet testnet USDC payment: [Hedera Mirror Node result](https://testnet.mirrornode.hedera.com/api/v1/contracts/results/0xbc333a625dcc2f71703366f7f45a3277783fb21496f117e7882ab0761efc3dd8) · [HashScan](https://hashscan.io/testnet/transaction/0xbc333a625dcc2f71703366f7f45a3277783fb21496f117e7882ab0761efc3dd8)
- Paid invoice on the hosted app: [USDC invoice with its verified payment](https://saucerpay-hedera.vercel.app/pay/0x08c3361023db4b0b2097fe1b82f90ed5477056e570daca65967f81c521357791?tx=0xbc333a625dcc2f71703366f7f45a3277783fb21496f117e7882ab0761efc3dd8), viewable without a wallet. The [earlier SAUCE paid invoice](VALIDATION.md#earlier-sauce-testnet-deployment-and-payment--2026-09-22) remains historical evidence.
- HCS invoice log: [topic `0.0.10814952`](https://hashscan.io/testnet/topic/0.0.10814952) with a payer's fake label ignored and the merchant's label accepted ([record](VALIDATION.md#hcs-invoice-log--2026-10-01)).
- Browser-exported receipt: on the earlier SAUCE deployment, the hosted page's **Download verified receipt** JSON passed `npm run submission:check -- /path/to/downloaded.json`. For USDC, the download was checked on a local server, not re-run through `submission:check`.
- Demo recording: **not recorded yet; follow the [complete video script and shot list](VIDEO_SCRIPT.md)**

Do not use a deployment address, quote screenshot or unrelated transaction as proof of a completed payment. The actual receipt must match this template's contract and invoice.

## Official submission form

The [official form](https://docs.google.com/forms/d/e/1FAIpQLSfMrExu3tI95KP9WlwtS9JFka5iy3uWOi8vVK4JqpLbd0FTPA/viewform?entry.1760747509=Scaffold+HBAR+Template&usp=pp_url) asks for team contact details, a mainnet Hedera Account ID for possible prize payment, project name, a description of at most three sentences, the public GitHub URL, and a **required video URL under five minutes**. It contains the required developer-experience questions. Put the successful [testnet mirror-node payment result](https://testnet.mirrornode.hedera.com/api/v1/contracts/results/0xbc333a625dcc2f71703366f7f45a3277783fb21496f117e7882ab0761efc3dd8) and hosted demo in its optional **Any other links** field; the bounty brief requires a verifiable testnet transaction link. The form must be submitted by the entrant, and no private key belongs in it.

## Demo video

Use the [exact English narration, timed storyboard and asset checklist](VIDEO_SCRIPT.md). It shows the real testnet transaction, explains why SaucerSwap is required for the payment, and makes the mainnet read-only limit explicit. The short presenter introduction is optional; the product and developer handoff should occupy almost all of the recording.

## Reproduce and verify chain evidence

Follow [Deployment](DEPLOYMENT.md). The optional `HEDERA_PAYER_PRIVATE_KEY` allows the script to use a separately funded payer; otherwise it uses one account for both roles:

```bash
npm run hardhat:deploy
npm run testnet:payment
npm run submission:check
```

The commands above need the funded testnet ECDSA configuration. The payment smoke writes an actual receipt record to the ignored `deployments/payment-evidence.json`. Alternatively, download a verified receipt from the payment page, then run:

```bash
npm run submission:check -- /path/to/saucerpay-receipt.json
```

The preflight checks source metadata, tracked env-file names, configured contract immutables, invoice state, the successful matching payment event, the recorded amount and mirror-node success. Missing or unverifiable evidence results in a nonzero exit code. It does not replace a full secret scan, fresh-build tests, an audit or the organizer's eligibility validator.

A fresh public scaffold has passed the checks in [Validation](VALIDATION.md#fresh-public-scaffold--2026-09-22); rerun them if the implementation changes. Before submitting, record the demo and complete the official form and developer-experience survey. The public chain metadata is in [Validation](VALIDATION.md). No registration, submission or external outreach is automated here. This project has not used Hedera Harness.

## Honest claim boundaries

- A quoted mainnet USDC conversion is not a validated mainnet payment; the verified USDC payment is on testnet only.
- Mocked local contract tests validate invariants, not HTS precompiles or actual protocol execution.
- Successful payment does not prove product delivery or credit allocation.
- Known related projects support the plausibility of the use cases, not adoption of this template.
- A strong submission can improve competitiveness; no score, ranking or reward is guaranteed.
