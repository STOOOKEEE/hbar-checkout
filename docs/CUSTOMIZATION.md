# Adapt the template to your application

[README](../README.md) · [API reference](REFERENCE.md) · [Architecture](ARCHITECTURE.md)

Start from the generated monorepo. Keep the checkout package, the contract and `PayWithHbar`; replace the invoice workspace with your service, product or top-up screen. `@saucerpay/checkout` is a local workspace package, not a public registry dependency.

The integration has three seams:

1. **Create** an on-chain invoice for each order and store its ID with the order (merchant wallet signs).
2. **Pay** with the drop-in [`PayWithHbar`](../packages/nextjs/components/PayWithHbar.tsx) component (payer wallet signs).
3. **Fulfill** on your server after `verifyInvoicePayment` says `paid`, exactly once.

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

Supported presets are `testnet-usdc`, `mainnet-usdc`, `testnet-sauce` and `mainnet-sauce`. This component is read-only. It clears stale results when inputs change and ignores responses belonging to superseded requests. It never creates an invoice or grants credits.

## Map a product order to an invoice

Choose a merchant wallet and a non-sensitive, unique bytes32 reference. The reference is public; do not put customer data or a guessable hash of confidential information into it. The demo uses random bytes.

Merchant creation is an on-chain transaction. This template does not include an unattended invoice signer. The following function assumes your UI has connected a merchant EVM signer on testnet and collected an amount; it is an integration example, not a script that should load a private key in the browser. With HashPack, the [workspace](../packages/nextjs/components/Workspace.tsx) sends the same call as a native `ContractExecuteTransaction` through [`wallet.ts`](../packages/nextjs/lib/wallet.ts).

```ts
import { Contract, hexlify, randomBytes, type Signer } from "ethers";
import {
  CHECKOUT_ABI,
  assertAssociated,
  assertDeployment,
  bufferedGasLimit,
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
  const units = tokenUnits(amount, token.decimals);
  const contract = new Contract(checkout, CHECKOUT_ABI, merchantSigner);
  // Hedera's bare estimate can run out of gas; add the template's +25 %.
  const estimate = await contract.createInvoice.estimateGas(
    reference,
    units,
    expiresAt,
  );
  const tx = await contract.createInvoice(reference, units, expiresAt, {
    gasLimit: bufferedGasLimit(estimate),
  });
  const receipt = await tx.wait();
  if (!receipt || receipt.status !== 1)
    throw new Error("Creation unconfirmed.");
  const id = invoiceId(merchant, reference);
  return { id, reference, creationHash: receipt.hash, path: `/pay/${id}` };
}
```

Obtain `config` from your configured server (`/api/config`) or `networkConfig("testnet", deployedAddress)`. Store the returned invoice ID alongside your application order. Include chain ID and checkout address in that mapping. Invoices are not scoped by a logged-in customer; anyone may pay an open invoice.

### Optional: describe the invoice on HCS

If `HEDERA_TOPIC_ID` is configured, a HashPack merchant can publish a one-line label (≤ 140 characters, check it with `isLabel`) after creating the invoice. The payer page shows it as "Description from the merchant", and **Load my invoices** rebuilds the merchant's recent labelled invoices from the topic. Validate the label and the wallet's `publish` capability before sending `createInvoice`, as the workspace does:

```ts
import { encodeInvoiceMessage, type CheckoutConfig } from "@saucerpay/checkout";
import type { Wallet } from "@/lib/wallet";

export async function publishLabel(
  config: CheckoutConfig,
  wallet: Wallet,
  id: string,
  label: string,
) {
  if (!config.topicId || !wallet.publish)
    throw new Error("Labels need a configured topic and HashPack.");
  return wallet.publish(config.topicId, encodeInvoiceMessage(config, id, label));
}
```

Readers accept a label only if the invoice's on-chain merchant paid for the message and it reached consensus after the invoice's creation, so a public topic is safe against impersonation and pre-posted labels. Never put the price or recipient only in a label: the contract terms are the payment. [HCS design and scan limits](ARCHITECTURE.md#hcs-invoice-log).

## Drop in the payer component

The simplest option is to link to `/pay/<invoiceId>` on your deployment's origin. To embed payment in your own page, render the component that `/pay` uses:

```tsx
import { PayWithHbar } from "@/components/PayWithHbar";

export function OrderPayment({ order }: { order: { id: string; invoiceId: string } }) {
  return (
    <PayWithHbar
      invoiceId={order.invoiceId}
      onPaid={({ reference }) =>
        fetch(`/api/orders/${order.id}/fulfill`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ invoiceId: order.invoiceId, reference }),
        })
      }
    />
  );
}
```

It loads the immutable terms and any HCS label, requests a quote with a slippage selector, lets the payer choose HashPack or MetaMask, sends the payable transaction with a buffered gas limit, saves the reference in `?tx=` before waiting, recovers after refresh and offers a verified receipt download. `onPaid` receives the verified receipt plus `reference`; it fires on a fresh payment and again on recovery, so the server call must be idempotent. Props: [Reference](REFERENCE.md#paywithhbar-component).

For a fully custom UI, the sequence is:

1. Request `/api/quote?invoiceId=<id>&slippageBps=50` from your server.
2. Display the token amount, merchant, maximum HBAR spend and additional network fee distinction.
3. Connect a wallet using the existing [wallet adapter](../packages/nextjs/lib/wallet.ts).
4. Pass the returned quote to `paymentTransaction(config, quote)` and send it with the wallet.
5. Save the transaction reference before waiting; use the receipt API to recover after interruption.

An amount-only preview quote cannot be paid. Discard old quotes when the invoice, network or slippage changes. Never multiply token units by the HBAR conversion factor: the transaction builder handles native value conversion exactly once.

## Fulfill the order on your server

Do not accept a browser-supplied receipt, merchant address or price as authoritative. `verifyInvoicePayment` reads the invoice and the receipt itself, for an EVM hash or a Hedera transaction ID:

```ts
import { verifyInvoicePayment } from "@saucerpay/checkout";
import { getConfig } from "@/lib/server";

export async function fulfillIfPaid(
  order: { id: string; invoiceId: string },
  reference: string,
  fulfillOnce: (orderId: string, transactionHash: string) => Promise<void>,
) {
  const result = await verifyInvoicePayment(getConfig(), {
    invoiceId: order.invoiceId, // from your authenticated order record
    reference,
  });
  if (result.status === "pending") return "pending"; // Retry the read, not the payment.
  await fulfillOnce(order.id, result.payment.transactionHash);
  return "fulfilled";
}
```

`pending` means the receipt is not indexed yet or the invoice does not read paid yet. A receipt for another invoice, merchant, amount or contract throws `CheckoutError` `INVALID_RECEIPT`. The verifier matches the chain receipt to the invoice; it does not know your product price or which application account owns an order, so also compare `result.invoice` with your record.

The runnable [example endpoint](../packages/nextjs/app/api/orders/[orderId]/fulfill/route.ts) shows the full shape: input validation, order lookup, 409 on an invoice mismatch, 202 while pending and an idempotent 200. Its `exampleOrders` and `exampleFulfillments` maps are placeholders. Replace them with these **application-specific database steps**:

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
| Product or booking interface   | `Workspace.tsx`, `PayWithHbar.tsx`                    | Immutable invoice amount/merchant                             |
| Another wallet                 | `lib/wallet.ts`                                       | Chain checks, wallet consent, buffered gas limit              |
| Durable merchant history       | HCS log (labelled invoices) or an event indexer + DB  | Merchant-only label rule; original deployment identity        |
| Paid content or credits        | `verifyInvoicePayment` + your fulfillment worker      | Idempotency; payment is not delivery                          |
| Another swap protocol or route | Shared quote module + contract + tests                | Native units, exact output, budget, refunds and receipt rules |

Contract, money-unit or receipt changes need meaningful regression tests and a real testnet check. UI copy changes do not establish new chain guarantees.
