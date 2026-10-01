# Reviewer walkthrough

[README](../README.md) · [Validation record](VALIDATION.md) · [Official bounty brief](https://hedera.com/blog/scaffold-hbar-template-bounty/)

This is a navigation guide to the implementation and [verified testnet evidence](VALIDATION.md#live-testnet-usdc-deployment-and-payment--2026-10-01). The contest submission and organizer eligibility review have not occurred.

For a ready-to-adapt pitch, timed demo and evidence preflight, use [Submission package](SUBMISSION.md).

## 1. Try the integration without setup

Open [the live demo](https://saucerpay-hedera.vercel.app), enter `1` in the quote panel and request testnet and mainnet USDC quotes using the quote-asset selector. They read SaucerSwap; no fabricated price is substituted for a failed request. The hosted environment has not yet been switched to the USDC checkout: it still serves the [earlier SAUCE deployment](VALIDATION.md#earlier-sauce-testnet-deployment-and-payment--2026-09-22), whose [paid invoice](https://saucerpay-hedera.vercel.app/pay/0x8f97d7a7c61394e9f927e2b0d9d7b62fc396d091cfffc0475ab3b13493b58e61?tx=0xd9d3d092b020d8d0e05825f7636f1be6085d3e935a18d2286d4a5448f42a85d1) shows a real two-wallet SAUCE receipt without a wallet.

## 2. Generate and run a clean copy

Follow [Getting started](GETTING_STARTED.md) from an empty parent folder. The supported generator entry point is:

```bash
npx create-scaffold-hbar@latest --template STOOOKEEE/hedera-temlate
```

Then run lint, tests, build, start and smoke as documented. [Validation](VALIDATION.md#fresh-public-scaffold--2026-09-22) records a fresh generator/install/test/build/boot pass for public source commit `57483b8`, which contains the live payment evidence and gas fix.

## 3. Inspect what is reusable

| Rubric area                | Inspect                                                                                                                                                | Question answered                                                                                   |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| Ecosystem integration / 35 | [Use cases](USE_CASES.md), [contract](../packages/hardhat/contracts/SaucerPay.sol), [quote module](../packages/checkout/src/index.ts)                  | Why does this require existing protocol liquidity, and what payment behavior does the template add? |
| Documentation / 30         | [First run](GETTING_STARTED.md), [deployment](DEPLOYMENT.md), [architecture](ARCHITECTURE.md), [reference](REFERENCE.md), [agent guide](../AGENTS.md)  | Can a new developer run, understand and adapt the example without private context?                  |
| Code / 20                  | [Contract tests](../packages/hardhat/test/checkout.cjs), [domain tests](../packages/checkout/test/checkout.test.ts), [CI](../.github/workflows/ci.yml) | Are delivery, refund, replay and receipt boundaries checked?                                        |
| Hedera depth / 15          | [Units and association](ARCHITECTURE.md), [deployment scripts](../packages/hardhat/scripts)                                                            | Does the integration account for HTS relationships and Hedera EVM amount semantics?                 |

The exact-output conversion and surplus return are implemented in a single payment transaction. Token association and merchant invoice creation happen separately. The [customization recipe](CUSTOMIZATION.md) identifies what remains application-specific.

## 4. Check chain evidence honestly

[Deploy on testnet](DEPLOYMENT.md), then exercise the two-wallet UI flow or optional smoke. The published [mirror-node USDC payment result](https://testnet.mirrornode.hedera.com/api/v1/contracts/results/0xbc333a625dcc2f71703366f7f45a3277783fb21496f117e7882ab0761efc3dd8) has separate merchant and payer accounts and passes `npm run submission:check`. The automated smoke supports either one or two accounts and labels the evidence accordingly. The injected-wallet UI signing path has not yet been exercised live with USDC.

The [validation record](VALIDATION.md#live-testnet-usdc-deployment-and-payment--2026-10-01) gives the genuine testnet links, network, contract, token, invoice and observed result. Contract deployment proves deployment; the successful invoice payment demonstrates the conversion and exact token delivery. A quote, screenshot or local mock cannot stand in for either transaction.

Also complete the official submission fields, including the developer-experience survey. This repository did not use Hedera Harness and does not claim a harness specification or harness validators. Consult the current brief for the final submission requirements.
