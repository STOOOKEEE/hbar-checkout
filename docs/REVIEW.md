# Reviewer walkthrough

[README](../README.md) · [Validation record](VALIDATION.md) · [Official bounty brief](https://hedera.com/blog/scaffold-hbar-template-bounty/)

This is a navigation guide to the implementation and [verified testnet evidence](VALIDATION.md#live-testnet-usdc-deployment-and-payment--2026-10-01). The contest submission and organizer eligibility review have not occurred.

For a ready-to-adapt pitch, timed demo and evidence preflight, use [Submission package](SUBMISSION.md).

## 1. Try the integration without setup

Open [the live workspace](https://hbar-checkout.vercel.app/workspace), enter `1` in the quote panel and request testnet and mainnet USDC quotes using the quote-asset selector. They read SaucerSwap; no fabricated price is substituted for a failed request. Then open the [paid USDC invoice](https://hbar-checkout.vercel.app/pay/0x08c3361023db4b0b2097fe1b82f90ed5477056e570daca65967f81c521357791?tx=0xbc333a625dcc2f71703366f7f45a3277783fb21496f117e7882ab0761efc3dd8): the server re-verifies the real two-wallet receipt without a wallet. HashPack is not enabled on the hosted app (no WalletConnect project ID configured there).

## 2. Generate and run a clean copy

Follow [Getting started](GETTING_STARTED.md) from an empty parent folder. The supported generator entry point is:

```bash
npx create-scaffold-hbar@latest --template STOOOKEEE/hbar-checkout
```

Then run lint, tests, build, start and smoke as documented. [Validation](VALIDATION.md#fresh-public-scaffold--2026-10-02) records a fresh generator/install/lint/test/build/boot/smoke pass for public source commit `0a6ef84` (`STOOOKEEE/hbar-checkout`) on Node 22.23.2 and Node 20.18.3, covering the HCS log, drop-in component, fulfill endpoint and +25 % gas rule.

## 3. Inspect what is reusable

| Rubric area                | Inspect                                                                                                                                                | Question answered                                                                                   |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| Ecosystem integration / 35 | [Who it is for](../README.md#who-it-is-for), [use cases](USE_CASES.md), [contract](../packages/hardhat/contracts/HbarCheckout.sol), [`PayWithHbar`](../packages/nextjs/components/PayWithHbar.tsx) | Why does this require SaucerSwap liquidity, and how little code does an adopter write?             |
| Documentation / 30         | [README integration](../README.md#integrate-in-ten-lines), [first run](GETTING_STARTED.md), [deployment](DEPLOYMENT.md), [architecture](ARCHITECTURE.md), [reference](REFERENCE.md), [agent guide](../AGENTS.md) | Can a new developer run, understand and adapt the example without private context?                  |
| Code / 20                  | [Contract tests](../packages/hardhat/test/checkout.cjs), [domain tests](../packages/checkout/test/checkout.test.ts), [HCS tests](../packages/checkout/test/hcs.test.ts), [CI](../.github/workflows/ci.yml) | Are delivery, refund, replay, receipt and label-trust boundaries checked?                           |
| Hedera depth / 15          | [Hedera services used](../README.md#hedera-services-used), [units, gas and HCS](ARCHITECTURE.md), [validation](VALIDATION.md)                         | Does it use HSCS, HTS, HCS, the mirror node and native transactions with correct Hedera semantics?  |

The exact-output conversion and surplus return are implemented in a single payment transaction. Token association and merchant invoice creation happen separately. The [customization recipe](CUSTOMIZATION.md) identifies what remains application-specific, and the [example fulfill endpoint](../packages/nextjs/app/api/orders/[orderId]/fulfill/route.ts) shows the server gate with placeholder storage.

## 4. Check chain evidence honestly

[Deploy on testnet](DEPLOYMENT.md), then exercise the two-wallet UI flow or optional smoke. The published [mirror-node USDC payment result](https://testnet.mirrornode.hedera.com/api/v1/contracts/results/0xbc333a625dcc2f71703366f7f45a3277783fb21496f117e7882ab0761efc3dd8) has separate merchant and payer accounts and passes `npm run submission:check`. The [HCS record](VALIDATION.md#hcs-invoice-log--2026-10-01) shows a payer's fake label ignored on the public topic. Not yet exercised live: a real HashPack session and MetaMask UI signing.

The [validation record](VALIDATION.md#live-testnet-usdc-deployment-and-payment--2026-10-01) gives the genuine testnet links, network, contract, token, invoice and observed result. Contract deployment proves deployment; the successful invoice payment demonstrates the conversion and exact token delivery. A quote, screenshot or local mock cannot stand in for either transaction.

Also complete the official submission fields, including the developer-experience survey. This repository did not use Hedera Harness and does not claim a harness specification or harness validators. Consult the current brief for the final submission requirements.
