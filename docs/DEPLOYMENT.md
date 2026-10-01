# Deploy and produce testnet evidence

[README](../README.md) · Before this: [first run](GETTING_STARTED.md) · [Troubleshooting](TROUBLESHOOTING.md)

**Outcome:** deploy your own checkout, receive a token payment from HBAR, and retain genuine transaction evidence. The reference testnet USDC deployment and a two-wallet payment are [publicly verified](VALIDATION.md#live-testnet-usdc-deployment-and-payment--2026-10-01). Follow the checkpoints below for your own copy; placeholders are not deployed addresses.

You do not need a key to install, lint, test, build, start the app or read live quotes. You need a funded **Hedera testnet ECDSA secp256k1 account** to deploy and sign payments.

| Role     | Needs                                                            | Signs                                                          |
| -------- | ---------------------------------------------------------------- | -------------------------------------------------------------- |
| Deployer | Funded testnet ECDSA key in Hardhat's local env                  | Contract deployment                                            |
| Merchant | Funded testnet wallet (HashPack or EVM), settlement-token association | Association if needed, invoice creation, optional cancellation |
| Payer    | Funded testnet wallet (HashPack or EVM)                          | Invoice payment (HBAR conversion plus network fees)            |

The deployer does not have to be the merchant. One account can perform all roles for the automated smoke; separate wallets demonstrate the actual buyer/seller flow. The payer needs no USDC balance for an HBAR-input payment.

## 1. Create and fund a testnet account

Use the [Hedera Portal](https://portal.hedera.com/) and its [faucet](https://portal.hedera.com/faucet). The Hardhat deployment and smoke scripts need an ECDSA account suitable for EVM transactions; obtain testnet HBAR and keep the account ID, EVM address and private key locally. In the UI, HashPack also works with ED25519 accounts; MetaMask needs ECDSA.

The Hardhat key format is a 32-byte secp256k1 private key with a `0x` prefix (64 hexadecimal digits after it). Hedera SDK DER-encoded keys are not interchangeable with that format. Use the portal/wallet's raw EVM key export or the official SDK conversion for your key type; do not truncate a key by guessing.

The merchant and payer both need testnet HBAR for transaction fees. The payer also needs enough HBAR to cover the displayed maximum conversion amount. Start with a small invoice. Testnet USDC pool prices are not market prices: on 2026-10-01, 1 USDC was quoted at `0.43988881` HBAR.

## 2. Configure the deployment signer

From the repository root:

```bash
cp packages/hardhat/.env.example packages/hardhat/.env
```

Edit the new ignored `.env` locally:

```dotenv
HEDERA_PRIVATE_KEY=<your-funded-testnet-ECDSA-key>
# Optional: separate, funded testnet payer for the payment smoke.
HEDERA_PAYER_PRIVATE_KEY=
HEDERA_RPC_URL=https://testnet.hashio.io/api
HEDERA_TOKEN_ID=0.0.5449
MAX_TESTNET_HBAR=1
```

Do not put that key in the Next.js package, a `NEXT_PUBLIC_` variable, a README or a commit. The repo ignores real env files; the example files contain no credentials.

## 3. Check and deploy

```bash
npm ci
npm run lint
npm test
npm run build
npm run probe
npm run hardhat:deploy
```

`probe` reads current quotes on both networks without sending any transaction. Deployment verifies chain ID 296, settlement-token metadata and a real direct-pool quote before submitting a constructor transaction. It deliberately does not expose a mainnet deployment command.

The deployment script prints:

```text
HEDERA_CHECKOUT_ADDRESS=<actual-deployed-EVM-address>
```

It writes actual transaction metadata to `deployments/testnet.json` (ignored by Git). A quote or an intended address is never written as deployment evidence. The deployment receipt proves contract creation, not a completed payment.

**Checkpoint:** the command exits successfully, the evidence file contains the actual address/hash, and its public HashScan link shows a successful deployment. If it fails, resolve the error before configuring the frontend with an address.

### Optional: create the HCS invoice log

```bash
npm run hardhat:topic
```

This creates a public HCS topic (memo `hbar-checkout:<checkout>`, admin key = deployer, **no submit key**) for the checkout in `deployments/testnet.json`, saves `topicId` there and prints `HEDERA_TOPIC_ID=0.0.…`. It costs a small HCS fee and is idempotent: a second run prints the saved ID. Without a topic, everything works except invoice labels and **Load my invoices**. Anyone may post to the topic; readers trust only messages paid by the invoice's on-chain merchant ([design](ARCHITECTURE.md#hcs-invoice-log)).

## 4. Connect the app

```bash
cp packages/nextjs/.env.example packages/nextjs/.env.local
```

Set the actual deployed address:

```dotenv
HEDERA_NETWORK=testnet
HEDERA_TOKEN_ID=0.0.5449
HEDERA_CHECKOUT_ADDRESS=<actual-deployed-EVM-address>
# Optional, public: printed by npm run hardhat:topic
HEDERA_TOPIC_ID=<topic-id>
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=<public-project-id-from-cloud.reown.com>
```

Run/restart `npm run dev`. Environment changes require restarting the Next.js process.

For your hosted Vercel copy, set the same server variables and `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` in project settings and redeploy. The topic and project IDs are public, not secrets; without the project ID HashPack is unavailable but MetaMask still works. Never add the Hardhat key to Vercel. See [web hosting](HOSTING.md).

In the workspace at `/` (for example http://localhost:3000), choose **HashPack** (default) or **MetaMask**; the payment page has a **Wallet** selector. HashPack connects through its browser extension if detected, otherwise a WalletConnect QR code for mobile, and signs native Hedera transactions (ED25519 or ECDSA accounts). MetaMask needs a funded testnet ECDSA account; its Connect button requests Hedera testnet (chain 296 / `0x128`) and offers the canonical testnet RPC if the wallet does not know it. For a realistic demo, use separate merchant and payer wallets or browser profiles.

**Checkpoint:** `/api/config` returns your checkout address and the intended token. The quote-panel network selector is only a preview selector; it does not change the deployed contract.

## 5. Merchant and payer flow

1. On `/`, connect the merchant wallet. Click **Associate the settlement token**. Association is a Hedera token operation signed by that account, not an ERC20 spending approval.
2. Allow mirror-node indexing to catch up. Create a small invoice, such as `1 USDC`. The merchant signs invoice creation. With a topic and HashPack, fill in **Label (shown to the payer)**: HashPack asks for a second approval to publish it on HCS. MetaMask cannot sign HCS messages, so leave the label empty when using it; the workspace checks this before creating the invoice.
3. Open the payment page and copy its URL. **Your invoices** lists invoices created in this browser session; with a topic, **Load my invoices** rebuilds the connected merchant's recent labelled invoices from HCS, newest first (labels appear about 5–10 s after consensus).
4. Open the link using the payer wallet. Request a quote, review maximum HBAR spend plus additional network fees, then pay.
5. The payment page verifies the actual receipt against invoice ID, merchant, amount and emitting checkout contract.
6. Reload the URL containing `?tx=<actual-reference>`: a `0x` EVM hash (MetaMask) or a Hedera transaction ID such as `0.0.x@s.n` (HashPack). The server retrieves and verifies the receipt again. **Download verified receipt** exports public payment JSON; `npm run submission:check -- /path/to/receipt.json` independently rechecks it against the network.

**Checkpoint:** the invoice shows paid, the receipt matches the configured contract/invoice/merchant/amount, and the merchant's token balance increased by the invoice amount. A payment screenshot or a wallet notification alone is insufficient. Unlabelled invoices are not in the HCS history, so keep their payment links.

If a payment transaction was submitted but receipt retrieval timed out, refresh status before retrying. If HashScan confirms it reverted and the invoice remains open, remove the `tx` parameter from the URL and request a fresh quote. Contract replay protection rejects an already-paid invoice.

## 6. Optional automated payment smoke

After deployment, this command uses the configured testnet signer as merchant, associates the output token if necessary, creates a one-token invoice, pays it and verifies exact delivery. By default the same signer is also the payer. To test separate accounts, set `HEDERA_PAYER_PRIVATE_KEY` in the ignored Hardhat `.env` to a **separately funded** testnet ECDSA key:

```bash
npm run testnet:payment
```

The script enforces `MAX_TESTNET_HBAR` before submitting association or invoice transactions. The cap covers conversion only, not network fees. It writes actual evidence to `deployments/payment-evidence.json`: creation hash, payment hash, amount received, HBAR spent/refunded, and explorer links.

This is a live testnet integration check. It is separate from `npm test`, which uses local mocks. Its success does not replace testing the wallet UI: no real HashPack session or MetaMask UI signature has been exercised live. Like the UI, the script sends each write with the gas estimate +25 % (`bufferedGasLimit`), because the bare Hedera estimate ran out of gas on invoice creation. Network fees are additional to the HBAR conversion cap; on 2026-10-01 they were about 0.077 HBAR to create, 0.159 HBAR to pay and 0.035 HBAR to cancel an invoice ([measurements](VALIDATION.md#gas-limit-measurements--2026-10-01)).

## Common blockers

| Symptom                        | Check                                                                                                                               |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| Deployment key missing         | The key belongs in `packages/hardhat/.env`, not the root or frontend env                                                            |
| Invalid private key            | Use an ECDSA secp256k1 raw EVM key; ED25519 or SDK DER strings do not work directly                                                 |
| No quote / RPC failure         | Endpoint health, current router IDs, configured token and actual direct-pool liquidity                                              |
| Association required           | Associate using the merchant wallet, then allow mirror indexing to catch up                                                         |
| KYC/freeze restriction         | Merchant token relationship and token admin policies                                                                                |
| Deployment mismatch            | Same checkout address, token ID and network in all configuration                                                                    |
| Price moved / payment reverted | Obtain a new quote; do not remove the spend limit                                                                                   |
| Refund rejected                | The payer must be able to receive native HBAR; contract wallets with reverting receive handlers are unsupported for surplus refunds |
| Receipt not indexed            | Keep the transaction hash and retry receipt retrieval; do not assume a failed HTTP request means payment failed                     |

For API codes, wallet issues and the complete recovery sequence, use [Troubleshooting](TROUBLESHOOTING.md).

## Submission evidence

Once you have an actual successful payment, copy **only public transaction metadata** from the ignored evidence files into your submission. Update `docs/VALIDATION.md` with what actually ran. Include the public repository link, genuine testnet HashScan/mirror link, and the additional submission fields required by the official bounty.

This project does not use Hedera Harness, so it does not claim to supply a harness spec or harness validators. Its own tests and checks are ordinary repository validation.
