# Configuration and API reference

[README](../README.md) · [First run](GETTING_STARTED.md) · [Troubleshooting](TROUBLESHOOTING.md)

All commands below run from the repository root. Amounts cross JSON boundaries as **decimal strings**, not JavaScript numbers. Times are Unix seconds unless stated otherwise.

## Configuration

The quote demo starts with no env files. Copy the example files only when enabling deployment or changing the default configuration.

| Variable                   | Read by / file                                | Default                         | Meaning                                                                         |
| -------------------------- | --------------------------------------------- | ------------------------------- | ------------------------------------------------------------------------------- |
| `HEDERA_PRIVATE_KEY`       | Hardhat / `packages/hardhat/.env`             | Unset                           | Funded testnet ECDSA key, 32 bytes with `0x` prefix; never send to the frontend |
| `HEDERA_PAYER_PRIVATE_KEY` | Payment smoke / same file                     | Unset                           | Optional separately funded ECDSA payer; otherwise uses the merchant key         |
| `HEDERA_RPC_URL`           | Hardhat / same file                           | `https://testnet.hashio.io/api` | Deployment and smoke RPC; must report chain 296                                 |
| `HEDERA_TOKEN_ID`          | Hardhat / same file                           | `0.0.5449`                      | Token chosen when deploying the immutable contract                              |
| `MAX_TESTNET_HBAR`         | Payment smoke / same file                     | `1`                             | Maximum conversion spend for the one-token smoke; excludes all network fees     |
| `HEDERA_NETWORK`           | Next.js server / `packages/nextjs/.env.local` | `testnet`                       | Active invoice network; `mainnet` is read-only in the reference UI              |
| `HEDERA_TOKEN_ID`          | Next.js server / same file                    | Network default below           | Active settlement token; must match the deployed contract                       |
| `HEDERA_CHECKOUT_ADDRESS`  | Next.js server / same file                    | Unset                           | Actual deployed EVM contract address; absence disables invoice creation         |
| `HEDERA_TOPIC_ID`          | Next.js server / same file                    | Unset                           | Public HCS invoice log `0.0.N` printed by `npm run hardhat:topic`; not a secret. Unset hides labels and **Load my invoices** |
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | Next.js browser / same file       | Unset                           | Public WalletConnect project ID ([cloud.reown.com](https://cloud.reown.com)), not a secret; required for HashPack, not MetaMask; set it on Vercel too |
| `PORT`                     | `npm start` process environment               | `3000`                          | Production server port; use `PORT=3020 npm start` (`npm start -- -p 3020` does not work) |
| `SMOKE_ORIGIN`             | Smoke process environment                     | `http://localhost:3000`         | Public or local origin to test, without trailing slash                          |

Restart Next.js after editing its env file. On Vercel, set these server variables in project settings and redeploy. Hardhat's env file is not loaded by Next.js; `HEDERA_RPC_URL` does **not** override the frontend server's RPC. To customize that RPC, modify `networkConfig` or pass an explicit `CheckoutConfig` in your own integration.

For `/api/config` and `/api/quote`, a `network` query can select the preview network. Env token/checkout overrides apply only when it matches `HEDERA_NETWORK`. The other network uses its built-in defaults. Arbitrary token IDs and checkout addresses are not accepted from query parameters.

### Built-in network settings

| Setting                | Testnet                                        | Mainnet                                        |
| ---------------------- | ---------------------------------------------- | ---------------------------------------------- |
| Chain ID               | 296 (`0x128`)                                  | 295 (`0x127`)                                  |
| RPC                    | `https://testnet.hashio.io/api`                | `https://mainnet.hashio.io/api`                |
| Mirror API             | `https://testnet.mirrornode.hedera.com/api/v1` | `https://mainnet.mirrornode.hedera.com/api/v1` |
| SaucerSwap V1 RouterV3 | `0.0.19264`                                    | `0.0.3045981`                                  |
| WHBAR **token**        | `0.0.15058`                                    | `0.0.1456986`                                  |
| Default USDC token     | `0.0.5449`                                     | `0.0.456858`                                   |
| Reference signing      | Enabled after deployment                       | Disabled                                       |

The route uses the WHBAR token, not its wrapper contract. Protocol source: [SaucerSwap contract deployments](https://docs.saucerswap.finance/developers/contracts). The implementation's current constants are in [networkConfig](../packages/checkout/src/index.ts).

## Commands

| Command                           | Result / side effects                                                                                                        |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `npm run dev`                     | Start Next.js development server                                                                                             |
| `npm run lint`                    | ESLint and shared/frontend TypeScript checks, including the quote example                                                    |
| `npm test`                        | Local TypeScript and mocked contract tests; no network transactions                                                          |
| `npm run build`                   | Compile Solidity and build Next.js for production                                                                            |
| `npm start`                       | Serve the existing production build; set the port with `PORT=…`                                                              |
| `npm run smoke`                   | HTTP route checks against `SMOKE_ORIGIN`; no writes                                                                          |
| `npm run probe`                   | Live quotes on both networks; inspect each result                                                                            |
| `npm run hardhat:compile`         | Compile Solidity with pinned local solc                                                                                      |
| `npm run hardhat:deploy`          | **Testnet write:** deploy the checkout, save `deployments/testnet.json`                                                      |
| `npm run hardhat:topic`           | **Testnet write:** create the public HCS invoice log for the deployed checkout once; idempotent; prints `HEDERA_TOPIC_ID`  |
| `npm run testnet:payment`         | **Testnet writes:** optional association, invoice creation and payment, save `deployments/payment-evidence.json`             |
| `npm run submission:check`        | Source/evidence preflight; verifies actual testnet payment over RPC and mirror, fails if missing; optional receipt JSON path |
| `npm run check`                   | Lint, tests and build in sequence; does not boot the app                                                                     |
| `node scripts/prepare-vercel.mjs` | Package tracked web/shared files for CLI hosting; print a temporary directory                                                |

The preset-based `/api/preview` route uses a fixed allowlist and no env overrides; every preview has a null checkout. It supports `testnet-usdc`, `mainnet-usdc`, `testnet-sauce` and `mainnet-sauce`. This is separate from the configured invoice endpoints.

## HTTP API

Routes perform reads; wallet signing happens in the browser. Source: [app/api](../packages/nextjs/app/api).

| Route                                | Input                                                                                      | Success body                                                                                         |
| ------------------------------------ | ------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------- |
| `GET /api/config`                    | Optional `network=testnet` or `mainnet`                                                    | `{ config, token }` including public RPC/router/token addresses and `topicId`                        |
| `GET /api/quote`                     | `amount` decimal string **or** `invoiceId`; optional `network`, `slippageBps` (default 50) | `{ quote }`                                                                                          |
| `GET /api/preview`                   | `preset` (default `mainnet-usdc`), `amount` (default `25`), `slippageBps` (default 50)     | `{ config, quote, readOnly: true }`; rejects `invoiceId`                                             |
| `GET /api/preflight`                 | `merchant` EVM address                                                                     | `{ ready: true }` after testnet deployment/association checks                                        |
| `GET /api/invoices/:id`              | bytes32 invoice ID; optional `tx` = EVM hash or Hedera transaction ID                      | `{ config, invoice, token }`, plus `payment` and `label` (see below)                                 |
| `POST /api/orders/:orderId/fulfill`  | JSON `{ invoiceId, reference }`                                                            | **Example only.** `200 { fulfilled: true, orderId, payment }` or `202 { fulfilled: false, status: "pending" }` |

A quote with `amount=1` is a preview and cannot be passed to the payment transaction builder. A quote with `invoiceId` reads amount and merchant from the deployed contract. If both are supplied, the invoice takes precedence. Preflight does not check the payer's HBAR balance or guarantee a future transaction will succeed.

`/api/invoices/:id?tx=…` returns `payment` only when the receipt verifies **and** the on-chain invoice reads paid; otherwise it answers `PENDING_RECEIPT`. `label` is `{ text, consensusTimestamp, topicId }`, present only when a topic is configured and the invoice's merchant posted a valid label; a mirror failure omits it rather than failing the request.

The fulfill route resolves `orderId` in an in-memory `exampleOrders` map (one entry, `example-order`, bound to the paid invoice in [Validation](VALIDATION.md)) and remembers results in `exampleFulfillments`, so repeated calls return the same payload. It verifies with `verifyInvoicePayment` and delivers nothing. Replace both maps with your database. Status codes: 400 malformed JSON, invoice ID or reference; 404 unknown order; 409 `INVOICE_MISMATCH` when the body's invoice is not the order's; 202 pending; 200 fulfilled.

### Quote fields

| Field            | Unit / behavior                                                                                       |
| ---------------- | ----------------------------------------------------------------------------------------------------- |
| `context`        | Bound chain ID, checkout, router, token and WHBAR; mismatches are rejected by the transaction builder |
| `amountOut`      | Integer string in token smallest units                                                                |
| `quotedTinybar`  | Integer string; 100,000,000 tinybar = 1 HBAR                                                          |
| `maximumTinybar` | Quoted spend plus rounded-up slippage allowance; excludes gas                                         |
| `validUntil`     | Unix seconds; at most 60 seconds after generation, bounded by invoice expiry                          |
| `slippageBps`    | Integer 0–500; 50 means 0.5%                                                                          |
| `token`          | `{ name, symbol, decimals }` from the mirror node                                                     |
| `invoice`        | Present only for invoice quotes: `{ id, merchant, amount, expiresAt, status }`                        |

Invoice `status` is `open`, `paid`, `cancelled` or `expired`. `expired` is derived from an open on-chain invoice whose expiry has passed; it is not an extra stored Solidity enum value.

### Errors

Errors use `{ "code": "...", "error": "human-readable explanation" }`.

- HTTP 404: `NOT_FOUND`.
- HTTP 409: `INVOICE_MISMATCH` (example fulfill route only).
- HTTP 503: `NETWORK_UNAVAILABLE`, `RPC_FAILED`, `CONTRACT_UNAVAILABLE`.
- HTTP 400: other `CheckoutError` codes, including `PENDING_RECEIPT`, `INVALID_RECEIPT` and `INVALID_REQUEST`.
- HTTP 500: unexpected exception, exposed as `REQUEST_FAILED` without internal details.

Example that works without credentials:

```bash
curl -i 'http://localhost:3000/api/quote?network=invalid'
```

Expect HTTP 400 and `INVALID_NETWORK`. `PENDING_RECEIPT` means retry the **read**, not the payment. See [recovery steps](TROUBLESHOOTING.md).

## Shared TypeScript package

`@saucerpay/checkout` is a local npm workspace, not a separately published npm package. Next.js transpiles its TypeScript source using `transpilePackages`. For another framework, enable equivalent TypeScript/workspace support.

| Export                                                       | Purpose                                                                                        |
| ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| `networkConfig(network, checkout?, tokenId?, topicId?)`      | Construct configuration; checkout is an EVM address, token and topic are Hedera `0.0.N` IDs    |
| `PREVIEW_PRESETS`, `previewConfig(preset)`                   | Allowlisted read-only token/network examples; no invoice deployment                            |
| `readToken(config)`                                          | Read metadata; reject deleted, paused, nonfungible or custom-fee assets                        |
| `assertDeployment(config)`                                   | Match router, WHBAR and token immutables                                                       |
| `assertAssociated(config, merchant)`                         | Verify merchant's token relationship and freeze/KYC state                                      |
| `readInvoice(config, id)`                                    | Read stored terms and derive expiry status                                                     |
| `quotePayment(config, { amount?, invoiceId?, slippageBps })` | Preview or verified invoice quote                                                              |
| `paymentTransaction(config, quote)`                          | Build testnet transaction; reject preview/stale/inconsistent quotes; convert native value once |
| `bufferedGasLimit(estimate)`                                 | Gas limit = estimate +25 %, rounded up; rejects a non-positive estimate                        |
| `validatePaymentReference(reference)`                        | Format check for a `0x` hash or `0.0.x@s.n` / `0.0.x-s-n` ID; not proof of payment             |
| `readTransactionReceipt(config, reference)`                  | Read a receipt by EVM hash or Hedera transaction ID; `null` while not indexed                  |
| `verifyPaymentReceipt(config, invoice, receipt)`             | Check successful receipt (with `transactionHash`), destination, event emitter and matching invoice/merchant/amount |
| `verifyInvoicePayment(config, { invoiceId, reference })`     | Server fulfillment gate: `{ status: "paid", invoice, payment }` or `{ status: "pending", invoice }`; throws `CheckoutError` on mismatch |
| `encodeInvoiceMessage(config, id, label)` / `parseInvoiceMessage(bytes)` / `isLabel(text)` | Build / strictly parse a v1 HCS invoice message (`null` if malformed) / check a label |
| `readInvoiceLabel(config, invoice)`                          | First valid label posted by the invoice's on-chain merchant after its creation; `null` without a topic or if none is found within the bounded scan |
| `listMerchantInvoices(config, accountIdOrEvmAddress)`        | `{ invoices, truncated }`: merchant's recent labelled invoices, newest first, each re-read on-chain; throws `TOPIC_REQUIRED` without a topic |
| `tokenUnits(decimalString, decimals)`                        | Parse a positive token amount without floating-point arithmetic                                |
| `maximumSpend(tinybar, bps)`                                 | Calculate the rounded-up conversion cap                                                        |
| `hbarDisplay(tinybar)` / `tinybarToRpcWei(tinybar)` / `rpcWeiToTinybar(wei)` | Format HBAR / convert only at the RPC boundary                                 |
| `invoiceId(merchant, reference)`                             | Hash ABI-encoded merchant + bytes32 reference                                                  |
| `entityAddress(id)` / `validateInvoiceId(id)`                | Convert supported positive `0.0.x` entities / validate bytes32 syntax                          |
| `rpc`, `contractRead`, `requestJson`, `CHECKOUT_ABI`, `checkoutInterface` | Lower-level network/ABI helpers                                                   |

Exported types include `CheckoutConfig` (with `topicId: string | null`), `Network`, `TokenInfo`, `Invoice`, `Quote`, `PaymentReceipt`, `TransactionReceipt`, `InvoicePayment`, `InvoiceMessage`, `InvoiceLabel`, `LabelledInvoice`, `MerchantHistory`, the constant `MAX_LABEL_LENGTH` (140) and the `CheckoutError` class. See [source](../packages/checkout/src/index.ts) and [hcs.ts](../packages/checkout/src/hcs.ts) for exact signatures and scan limits, and [Customization](CUSTOMIZATION.md) for how to compose them.

### `PayWithHbar` component

[`packages/nextjs/components/PayWithHbar.tsx`](../packages/nextjs/components/PayWithHbar.tsx) is a client component used by the `/pay/[id]` page. It needs this app's `/api/invoices/:id` and `/api/quote` routes.

| Prop        | Type                                 | Meaning                                                                                                   |
| ----------- | ------------------------------------ | --------------------------------------------------------------------------------------------------------- |
| `invoiceId` | `string`                             | bytes32 on-chain invoice ID                                                                               |
| `onPaid`    | `(payment: VerifiedPayment) => void` | Optional. Fires after the receipt matches the invoice, and again on `?tx=` recovery. UX signal, not proof |
| `hosted`    | `boolean`                            | Optional, default `false`. Adds **Copy payment link** and **Cancel as merchant**                          |

It also exports `VerifiedPayment` (`PaymentReceipt & { reference }`) and `InvoiceData` (the `/api/invoices/:id` body). It keeps other query parameters of the host page when it writes `?tx=`, and shows the HCS label as "Description from the merchant", marked as not enforced by the contract.

## Contract interface

Source: [SaucerPay.sol](../packages/hardhat/contracts/SaucerPay.sol). Constructor: `(routerAddress, whbarAddress, tokenAddress)`. All three are immutable; changing the settlement asset requires a new deployment.

| Method                                                               | Caller and effect                                                                                   |
| -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `createInvoice(bytes32 reference, uint256 amount, uint64 expiresAt)` | Merchant; positive token units, nonzero reference, future Unix expiry                               |
| `cancelInvoice(bytes32 id)`                                          | Recorded merchant only; changes Open to Cancelled                                                   |
| `payInvoice(bytes32 id, uint256 deadline)` payable                   | Payer; native value caps conversion spend; deadline must be future and no later than invoice expiry |
| `invoiceId(address merchant, bytes32 reference)`                     | Pure computation of deterministic invoice ID                                                        |
| `invoices(bytes32 id)`                                               | Read merchant, amount, expiry and numeric status                                                    |
| `router()`, `whbar()`, `token()`                                     | Read immutable integration configuration                                                            |

Stored statuses: `Missing=0`, `Open=1`, `Paid=2`, `Cancelled=3`. A failed payment rolls back its state change. Cancellation does not reverse an already completed payment. A fresh invoice requires a new reference even after payment or cancellation.

| Event              | Fields                                                                      |
| ------------------ | --------------------------------------------------------------------------- |
| `InvoiceCreated`   | Indexed `id`, `merchant`; reference, amount, expiry                         |
| `InvoiceCancelled` | Indexed `id`                                                                |
| `InvoicePaid`      | Indexed `id`, `payer`, `merchant`; amountOut, spentTinybar, refundedTinybar |

The merchant's settlement token is obtained from the contract configuration, not an event field. A receipt proves payment, not customer authentication or off-chain delivery.
