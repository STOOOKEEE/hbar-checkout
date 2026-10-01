# Adapt the template to your application

[README](../README.md) · [API reference](REFERENCE.md) · [Architecture](ARCHITECTURE.md)

Start from the generated monorepo. Keep the checkout package and contract; replace the invoice workspace with your service, product or top-up screen. `@saucerpay/checkout` is a local workspace package, not a public registry dependency.

## A small first change

1. Change the headline/product copy in [Workspace.tsx](../packages/nextjs/components/Workspace.tsx).
2. Keep the quote call and payment route unchanged.
3. Run `npm run lint`, `npm run build`, then open the app and request a quote.

This confirms that your product screen can use the existing payment integration before you change contract behavior.

## Reuse a live quote component

The [QuotePreview component](../packages/nextjs/components/QuotePreview.tsx) is used by both the workspace and [product examples](../packages/nextjs/app/examples/page.tsx). In a Next.js screen:

```tsx
import { QuotePreview } from "@/components/QuotePreview";

export default function ServicePricing() {
  return <QuotePreview initialAmount="25" initialPreset="mainnet-usdc" />;
}
```

Supported presets are `mainnet-usdc`, `testnet-sauce` and `mainnet-sauce`. This component is read-only. It clears stale results when inputs change and ignores responses belonging to superseded requests. It never creates an invoice or grants credits.

## Map a product order to an invoice

Choose a merchant wallet and a non-sensitive, unique bytes32 reference. The reference is public; do not put customer data or a guessable hash of confidential information into it. The demo uses random bytes.

Merchant creation is an on-chain transaction. This template does not include an unattended invoice signer. The following function assumes your UI has connected a merchant signer on testnet and collected an amount; it is an integration example, not a script that should load a private key in the browser.

```ts
import { Contract, hexlify, randomBytes, type Signer } from "ethers";
import {
  CHECKOUT_ABI,
  assertAssociated,
  assertDeployment,
  invoiceId,
  readToken,
  tokenUnits,
  type CheckoutConfig,
} from "@saucerpay/checkout";

export async function createOrderInvoice(
  config: CheckoutConfig,
  merchantSigner: Signer,
  amount: string,
) {
  if (config.network !== "testnet" || !merchantSigner.provider)
    throw new Error("Use a connected testnet merchant signer.");
  if ((await merchantSigner.provider.getNetwork()).chainId !== 296n)
    throw new Error("Switch the merchant wallet to testnet.");
  const checkout = await assertDeployment(config);
  const merchant = await merchantSigner.getAddress();
  await assertAssociated(config, merchant);
  const token = await readToken(config);
  const reference = hexlify(randomBytes(32));
  const expiresAt = Math.floor(Date.now() / 1000) + 3600;
  const contract = new Contract(checkout, CHECKOUT_ABI, merchantSigner);
  const tx = await contract.createInvoice(
    reference,
    tokenUnits(amount, token.decimals),
    expiresAt,
  );
  const receipt = await tx.wait();
  if (!receipt || receipt.status !== 1)
    throw new Error("Creation unconfirmed.");
  const id = invoiceId(merchant, reference);
  return { id, reference, creationHash: receipt.hash, path: `/pay/${id}` };
}
```

Obtain `config` from your configured server (`/api/config`) or `networkConfig("testnet", deployedAddress)`. Store the returned invoice ID alongside your application order. Include chain ID and checkout address in that mapping. Invoices are not scoped by a logged-in customer; anyone may pay an open invoice.

## Reuse the payer page first

Return `/pay/<invoiceId>` on your deployment's origin. The included [Payment component](../packages/nextjs/components/Payment.tsx) already loads immutable terms, requests a quote, switches to testnet, constructs the payable transaction and recovers receipts after refresh.

For a custom UI, the sequence is:

1. Request `/api/quote?invoiceId=<id>&slippageBps=50` from your server.
2. Display the token amount, merchant, maximum HBAR spend and additional network fee distinction.
3. Connect a testnet signer using the existing [wallet adapter](../packages/nextjs/lib/wallet.ts).
4. Pass the returned quote to `paymentTransaction(config, quote)` and send it with the signer.
5. Save the transaction hash before waiting; use the receipt API to recover after interruption.

An amount-only preview quote cannot be paid. Discard old quotes when the invoice, network or slippage changes. Never multiply token units by the HBAR conversion factor: the transaction builder handles native value conversion exactly once.

## Fulfill the order on your server

Fetch the invoice and receipt independently through your configured contract/RPC. Do not accept a browser-supplied receipt, merchant address or price as authoritative. This function performs reads only and can be called from a server route:

```ts
import { JsonRpcProvider } from "ethers";
import {
  assertDeployment,
  readInvoice,
  verifyPaymentReceipt,
  type CheckoutConfig,
} from "@saucerpay/checkout";

export async function readVerifiedPayment(
  config: CheckoutConfig,
  trustedInvoiceId: string,
  transactionHash: string,
) {
  await assertDeployment(config);
  const provider = new JsonRpcProvider(config.rpcUrl);
  if ((await provider.getNetwork()).chainId !== BigInt(config.chainId))
    throw new Error("RPC network mismatch.");
  const invoice = await readInvoice(config, trustedInvoiceId);
  const receipt = await provider.getTransactionReceipt(transactionHash);
  if (!receipt) return null; // Pending: retry the read, not the payment.
  return verifyPaymentReceipt(config, invoice, receipt);
}
```

The `trustedInvoiceId` comes from your authenticated order record, not an arbitrary customer query. Also compare the loaded invoice terms with that record. The verifier matches the chain receipt to the invoice; it does not know your product price or which application account owns an order.

Once verified, implement these **application-specific database steps**:

1. Enforce a unique payment identity: `(chainId, checkoutAddress, invoiceId)`.
2. In one database transaction, mark that order paid and enqueue fulfillment once.
3. For a credit top-up, credit its authenticated owner's ledger once. Handle usage and service refunds separately.
4. Make the fulfillment worker retryable without re-sending a wallet payment.

An event proves payment to the recorded merchant. It does not prove shipping, download delivery or the payer's off-chain identity.

## Change the settlement asset

Set the same testnet `HEDERA_TOKEN_ID` in both package env files, validate a real direct-pool quote, and deploy a **new** checkout. The asset must be active, fungible, supported in decimals, and without custom fees. The merchant must be associated and satisfy any token policies. Match the new checkout address in the frontend and restart.

Do not overwrite an existing deployment's configuration and assume old links still work. The reference app serves one configured contract; keep the old instance available or implement routes that explicitly select a validated deployment. Save deployment identity in every order record.

[Settlement token choice and current limits](USE_CASES.md#choosing-a-settlement-token). Changing a token label in the UI is not a token integration; the deployed contract's token must match the configured one.

## Extension map

| Change                         | Start here                                            | Preserve                                                      |
| ------------------------------ | ----------------------------------------------------- | ------------------------------------------------------------- |
| Product or booking interface   | `Workspace.tsx`                                       | Immutable invoice amount/merchant                             |
| Mobile wallet support          | `lib/wallet.ts`                                       | Chain checks and wallet consent                               |
| Durable merchant history       | Event indexer + your database                         | Namespaced IDs and original deployment identity               |
| Paid content or credits        | Server receipt verification + your fulfillment worker | Idempotency; payment is not delivery                          |
| Another swap protocol or route | Shared quote module + contract + tests                | Native units, exact output, budget, refunds and receipt rules |

Contract, money-unit or receipt changes need meaningful regression tests and a real testnet check. UI copy changes do not establish new chain guarantees.
