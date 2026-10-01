# Troubleshooting

[README](../README.md) · [Configuration reference](REFERENCE.md) · [Deployment](DEPLOYMENT.md)

Start with the error code or text. Keep network, token ID, contract address and transaction hash together when diagnosing an invoice.

## Installation and first run

| Symptom                                      | Likely cause                               | What to do                                                                                                  |
| -------------------------------------------- | ------------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| Node engine or syntax error                  | Older Node version                         | Use Node 22+, then rerun `npm ci` from the project root                                                     |
| Git author identity error during scaffolding | Generator cannot create its initial commit | Configure your own Git `user.name` and `user.email`, then retry; use a new folder if generation was partial |
| Workspace package cannot be resolved         | Installing only a nested package           | Run `npm ci` at the repository root; retain all three workspaces                                            |
| `template.json` missing after generation     | Generator consumed its manifest            | Expected in the generated app; check the source repository to inspect it                                    |
| App opens on a different port                | Port 3000 is occupied                      | Use the address Next.js printed; set `SMOKE_ORIGIN` to the same origin when testing                         |
| Production build not found                   | `npm start` was run before build           | Run `npm run build`, then `npm start`                                                                       |
| Blank/unavailable quote, but tests pass      | Public endpoint or pool problem            | Try `npm run probe`; inspect each network result and the browser error. Local tests use mocks               |
| Create button is disabled                    | No checkout configured or mainnet mode     | Follow Deployment for a fresh scaffold; the hosted reference has a testnet checkout configured              |

## Configuration, token and quote errors

| Code                                       | Meaning                                                                | Recovery                                                                                                        |
| ------------------------------------------ | ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `INVALID_NETWORK`                          | Only `testnet` and `mainnet` are accepted                              | Correct query or env; restart after env changes                                                                 |
| `INVALID_ENTITY` / `INVALID_ADDRESS`       | Malformed token ID or EVM address                                      | Use token `0.0.x` ID and the actual `0x…` checkout address printed by deployment                                |
| `DEPLOYMENT_REQUIRED`                      | Checkout address is unset                                              | Deploy and configure `packages/nextjs/.env.local`; hosting alone does not deploy a contract                     |
| `DEPLOYMENT_MISMATCH`                      | Contract immutables differ from server config                          | Compare network, token and checkout; do not reuse a SAUCE contract for USDC (or vice versa)                     |
| `UNSUPPORTED_TOKEN`                        | Token is inactive/nonfungible, has unsupported decimals or custom fees | Choose a supported active fungible asset; do not bypass the checks                                              |
| `ASSOCIATION_REQUIRED`                     | Merchant does not have the token relationship                          | Connect the merchant and associate; allow mirror indexing to catch up                                           |
| `TOKEN_RESTRICTED`                         | Merchant is frozen or KYC is revoked                                   | Check token policy; association alone cannot grant the required authorization                                   |
| `INVALID_AMOUNT`                           | Invalid decimal precision, zero or out-of-range amount                 | Enter a positive plain decimal token amount, not exponent notation or a HBAR value                              |
| `INVALID_SLIPPAGE`                         | Allowance is not an integer 0–500 bps                                  | Use, for example, 50 for 0.5%                                                                                   |
| `NETWORK_UNAVAILABLE` / `INVALID_RESPONSE` | Endpoint timed out, returned an HTTP error or invalid JSON             | Retry the read and check the relevant RPC/mirror service                                                        |
| `RPC_FAILED` / `CONTRACT_UNAVAILABLE`      | Contract call failed or returned no readable result                    | Verify network, deployed address and direct-pool liquidity; these errors alone do not prove which cause applies |
| `INVALID_QUOTE`                            | Router result or payment terms are inconsistent                        | Discard it and fetch a new invoice quote; do not edit its fields to force acceptance                            |
| `NOT_FOUND` / `INVALID_INVOICE`            | Unknown or malformed ID, or preview used for payment                   | Use the bytes32 ID from the actual deployment and request an invoice quote                                      |
| `NOT_OPEN` / `EXPIRED`                     | Invoice settled/cancelled/expired, or quote expired                    | Read current invoice status; refresh only a still-open invoice's quote                                          |
| `READ_ONLY`                                | Attempt to sign on mainnet                                             | Use testnet; mainnet signing is intentionally excluded                                                          |

For a suspected network issue, gather read-only results:

```bash
npm run probe
curl -i 'http://localhost:3000/api/config?network=testnet'
curl -i 'http://localhost:3000/api/quote?network=testnet&amount=1&slippageBps=50'
```

For custom-token configuration, use the app API: `npm run probe` always probes the built-in default tokens and does not validate your env override.

`QUOTE_CONTEXT_MISMATCH` means the quote came from a different chain, checkout, router or token configuration. Fetch a new quote from the intended invoice endpoint. A preview has no invoice and cannot become a payment. `INVALID_PRESET` means the preview asset is outside the built-in allowlist.

## Wallet and deployment

- **No wallet found:** choose **HashPack** (extension, or WalletConnect QR for mobile) or use a browser with an injected EVM wallet such as MetaMask.
- **“HashPack needs NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID”:** create a free project ID at [cloud.reown.com](https://cloud.reown.com), set it in `packages/nextjs/.env.local` (and Vercel), then restart/redeploy. MetaMask works without it.
- **ED25519 account cannot sign with MetaMask:** EVM transactions need an ECDSA account. Use HashPack, which signs native Hedera transactions with ED25519 accounts.
- **Recovering a payment by ID:** the payment page `?tx=` accepts a `0x` hash or a Hedera transaction ID (`0.0.x@s.n` or `0.0.x-s-n`). `PENDING_RECEIPT` means the mirror node has not indexed it yet; retry the read, not the payment.
- **Wallet request cancelled:** nothing can proceed without the signature. Restart the intended action when ready; fetch a fresh quote before paying.
- **Wrong chain (MetaMask):** switch to Hedera testnet (296 / `0x128`). The built-in connector offers to add it. HashPack connects to `hedera:testnet`. Previewing mainnet prices does not switch the wallet.
- **Invalid key:** Hardhat requires a raw 32-byte ECDSA secp256k1 key with `0x` prefix. ED25519 and DER-encoded SDK keys are different formats. Do not truncate them by guessing.
- **Insufficient HBAR:** merchant needs fees for association/creation; payer needs the maximum conversion spend **plus** network fees. A reverted transaction may still consume fees.
- **`INSUFFICIENT_GAS` after wallet submission:** inspect the actual HashScan/mirror receipt. A live invoice creation exhausted Hedera's unbuffered `113,262`-gas estimate. Current script and UI double the estimate for writes; update an older copy before retrying a still-open action. Failed transactions may consume network fees.
- **Smoke cap exceeded:** the optional payment script stops before association/creation if its conversion quote exceeds `MAX_TESTNET_HBAR`. Review the requested asset and quote before changing that cap.
- **Constructor `InvalidConfiguration`:** check router/token deployed code, distinct token/WHBAR addresses and network. Do not replace the router with an arbitrary address.

## Payment submitted, but the page did not confirm

**Recover the existing transaction before submitting another.**

1. Keep the URL's `?tx=…` value or copy the hash from the wallet.
2. Open its actual testnet HashScan transaction page and inspect the result.
3. Refresh the payment page. Its server reads the receipt and invoice again.
4. If `PENDING_RECEIPT`, retry the read after indexing catches up. HTTP 400 here does not mean the payment reverted.
5. If the receipt is successful and verified, treat the invoice as paid even if a previous browser request failed.
6. Only if the transaction is confirmed reverted **and** the invoice remains open, remove the `tx` query parameter and obtain a fresh quote.

`INVALID_RECEIPT` means the receipt did not prove this invoice's payment: it may be reverted, addressed to another contract or missing the matching event. Do not mark an order paid from the hash alone. `REQUEST_FAILED` is an unexpected server error: inspect server logs with secrets redacted.

Contract errors `IncorrectDelivery`, `InvalidRouterResult` and `RefundFailed` roll back settlement. Investigate token delivery, router refund behavior or the payer's ability to accept HBAR. Do not disable the exact-delivery/refund checks to get a passing payment.

## Share a useful issue report

Include commit SHA (`git rev-parse HEAD`), Node/npm versions, reproduction steps, network, public token/contract IDs, error code, HTTP status and any public transaction hash. Say whether the failure happened before or after wallet submission. Exclude `.env` files, keys, seed phrases and private Vercel claim links.

[Open a repository issue](https://github.com/STOOOKEEE/hedera-temlate/issues).
