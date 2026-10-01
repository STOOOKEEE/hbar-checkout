# Working on HBAR Checkout with a coding agent

This repository is a reusable Scaffold-HBAR payment template. The invoice workspace is an example consumer; preserve the shared integration when adapting the UI.

## Read before editing

1. [README.md](README.md): user outcome, current support and navigation.
2. [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): trust, transactions and Hedera units.
3. [docs/REFERENCE.md](docs/REFERENCE.md): exact configuration, APIs and events.
4. [docs/VALIDATION.md](docs/VALIDATION.md): observed results and uncompleted chain evidence.

For product scope, consult [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) and [use cases](docs/USE_CASES.md). Do not turn a proposed use case into a claim of adoption or a validated integration.

## Environment and commands

Use Node.js 20.18.3+ and npm workspaces. Install with `npm ci` at the repository root. `npm run dev` starts the Next.js app without secrets. Real quotes need internet access. Mainnet is read-only in the reference flow.

| Task                                   | Source / command                                              |
| -------------------------------------- | ------------------------------------------------------------- |
| Change merchant UI                     | `packages/nextjs/components/Workspace.tsx`                    |
| Change payer UI or recovery            | `packages/nextjs/components/PayWithHbar.tsx` (`Payment.tsx` is only the `/pay` page shell) |
| Change wallet connection               | `packages/nextjs/lib/wallet.ts`                               |
| Change server env handling             | `packages/nextjs/lib/server.ts`                               |
| Change amounts, quote or receipt logic | `packages/checkout/src/index.ts`                              |
| Change HCS label format or trust rule  | `packages/checkout/src/hcs.ts`                                |
| Change the example fulfillment gate    | `packages/nextjs/app/api/orders/[orderId]/fulfill/route.ts`   |
| Change invoice settlement              | `packages/hardhat/contracts/HbarCheckout.sol`                 |
| Run the documented no-key example      | `npx tsx packages/checkout/examples/quote.ts`                 |
| Validate source                        | `npm run lint`, `npm test`, `npm run build`                   |
| Validate served routes                 | `PORT=3020 npm start`, then `SMOKE_ORIGIN=http://localhost:3020 npm run smoke` (not `npm start -- -p`) |
| Probe live dependencies                | `npm run probe`; inspect both results, not only the exit code |

The read-only `QuotePreview` component is shared by the workspace and product examples. Keep the preset allowlist separate from configured invoice endpoints; do not enable mainnet signing when adding preview assets. Quotes carry chain/checkout/router/token/WHBAR context and must match the transaction configuration.

Run `npm run submission:check` to verify source metadata and a real payment receipt. A failure for missing evidence is expected until the funded testnet flow is executed. It is not the organizer's validator and does not replace fresh-scaffold checks.

The quote example is included in the checkout package's TypeScript checks. Keep documentation examples aligned with the real exports and API response wrappers.

## Payment invariants

- Router, settlement token and WHBAR are immutable. Never accept arbitrary router calldata from the payer.
- Read invoice amount and merchant from the configured on-chain invoice, never a query-string override or browser-supplied receipt.
- Keep bigint arithmetic. Solidity `msg.value`, balance and internal HBAR sends use tinybar. RPC transaction `value` uses wei: multiply by 10^10 once at that boundary. The native HashPack `ContractExecuteTransaction` takes tinybar directly (`rpcWeiToTinybar` rejects non-whole tinybar). Do not use `parseEther` for token amounts.
- Enforce exact merchant token balance increase, bounded HBAR spend and surplus return in one transaction. Revert invoice state and transfers together on failure.
- A successful receipt must target the configured checkout and contain its matching `InvoicePaid` event, with invoice ID, merchant and amount verified. A transaction hash alone is not proof.
- Payment references may be an EVM transaction hash (EVM wallet) or a Hedera transaction ID (HashPack native path). Resolve either to the same receipt before verification; never treat the reference itself as proof.
- Verify deployment immutables and merchant token association before the invoice payment path. These checks do not guarantee future liquidity or policies.
- Preserve duplicate-payment rejection, expiry, merchant-only cancellation and reentrancy protection.
- Preserve receipt recovery after refresh. After an uncertain send, check the existing transaction before retrying payment.
- Fulfillment requires separate authenticated order mapping and idempotency; gate it on `verifyInvoicePayment` with the invoice ID from the order record, never the browser. `onPaid` is not proof. Payment verification does not deliver a product or credit an account.
- HCS labels are descriptive only. Keep the rule that a label counts only if its mirror `payer_account_id` is the invoice's on-chain merchant account and it reached consensus after the merchant's `createInvoice` call, first in consensus order, within bounded mirror scans. Never read amount, recipient or status from HCS.
- Send every contract write with `bufferedGasLimit(estimate)` (+25 %); the bare Hedera estimate has failed with `INSUFFICIENT_GAS`.

## Configuration and secrets

Only Hardhat reads `packages/hardhat/.env`. Only the Next.js server reads its `.env.local`. No private key belongs in the frontend, `NEXT_PUBLIC_*`, logs, docs or Vercel runtime. Keep `.vercel` state and private claim links out of commits.

Testnet writes require a funded ECDSA secp256k1 account. `npm run hardhat:deploy`, `npm run hardhat:topic` and `npm run testnet:payment` perform real writes; ordinary tests, the quote example and probe do not. Follow the user's existing authorization and [deployment instructions](docs/DEPLOYMENT.md). Do not request new credentials when the task only needs reads or local work.

This repository has a verified testnet USDC deployment, a two-wallet payment and an HCS topic; see `docs/VALIDATION.md`. The local signer belongs only in the ignored `packages/hardhat/.env`. Never put a key in Git, documentation, frontend env or Vercel. `HEDERA_TOPIC_ID` and `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` are public. Use actual public metadata for any additional transaction claims. No real HashPack session has been tested; do not claim one.

## Validation appropriate to a change

- Documentation: check relative links/anchors and commands against source; run executable examples; typecheck TypeScript snippets. Do not claim a new fresh-scaffold pass without running the generator on that revision.
- UI: lint/types, build and browser checks for the affected flow; smoke the production routes.
- Money, contract or receipt logic: meaningful regression tests, lint/types, full tests/build and relevant live integration checks. Local Hardhat mocks do not emulate HTS precompiles.
- Integration/config: run real quote checks and distinguish failures from simulated success. Never replace unavailable prices with sample values.

Run the repository checks before delivering code changes. Record what was actually tested and what remains blocked by missing testnet setup. Do not present ordinary tests as Hedera Harness validators; this project has not used Harness.

## Scaffold and hosting boundaries

The generator reads the `create-scaffold-hbar` block in `template.json`, then consumes/removes the manifest in the generated app. Its absence there is expected. Keep the source manifest. Do not rename npm workspace packages independently; internal links use their names.

The source uses the `npx create-scaffold-hbar@latest` entry point because upstream generation rewrites some npm prose. Preserve working commands in both the source README and generated copy. Keep [web hosting](docs/HOSTING.md) separate from contract deployment: publishing the web app does not deploy Solidity.

## Useful scoped requests

- “Replace the merchant workspace with a service checkout. Keep the contract and quote/receipt helpers unchanged. Show which product-specific persistence still needs implementing.”
- “Explain the tinybar-to-RPC conversion using the worked example, then identify the tests that cover it.”
- “Investigate this quote error using read-only calls. Report the failing network/token/contract without submitting transactions.”

Return concrete changed files, relevant validation and remaining limits. Avoid adding services that do not supply a capability required by the requested use case.
