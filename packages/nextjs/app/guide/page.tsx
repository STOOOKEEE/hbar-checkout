import Link from "next/link";

export default function Guide() {
  return (
    <div className="guide">
      <p className="eyebrow">Developer guide / 01</p>
      <h1>
        Make checkout
        <br />
        part of your app.
      </h1>
      <p className="lead">
        A reusable payment boundary, with an invoice workspace to show how the
        pieces fit together.
      </p>
      <section className="panel">
        <h2>Start with a live quote</h2>
        <p>
          The workspace reads SaucerSwap prices without a wallet or API key. An
          unavailable pool produces an explicit error.
        </p>
        <pre>{`npx create-scaffold-hbar@latest --template STOOOKEEE/hbar-checkout\ncd your-project\nnpm run dev`}</pre>
        <p>
          Use Node.js 20.18.3 or later. Select Next.js, Hardhat and npm if
          prompted.
        </p>
      </section>
      <section className="panel">
        <h2>Enable testnet invoices</h2>
        <ol>
          <li>
            Create and fund a Hedera testnet ECDSA account using the Hedera
            Portal.
          </li>
          <li>
            Copy <code>packages/hardhat/.env.example</code> to <code>.env</code>{" "}
            in that folder and set the local deployment key.
          </li>
          <li>
            Run <code>npm run hardhat:deploy</code>. It checks the configured
            router and token before deployment.
          </li>
          <li>
            Copy the generated checkout address into{" "}
            <code>packages/nextjs/.env.local</code> as{" "}
            <code>HEDERA_CHECKOUT_ADDRESS</code>, then restart the app.
          </li>
          <li>
            Optional: run <code>npm run hardhat:topic</code> and set{" "}
            <code>HEDERA_TOPIC_ID</code> to enable merchant labels on the Hedera
            Consensus Service.
          </li>
          <li>
            Connect the merchant wallet, associate the settlement token, create
            a small invoice, then pay it with a funded payer wallet.
          </li>
        </ol>
        <p>
          See{" "}
          <a href="https://github.com/STOOOKEEE/hbar-checkout/blob/main/docs/DEPLOYMENT.md">
            the deployment walkthrough
          </a>{" "}
          for exact steps, account requirements and transaction evidence.
        </p>
      </section>
      <section className="panel">
        <h2>Replace the screen, keep the payment flow</h2>
        <pre>{`import { PayWithHbar } from '@/components/PayWithHbar';\n\n<PayWithHbar\n  invoiceId={order.invoiceId}\n  onPaid={({ reference }) =>\n    fetch(\`/api/orders/\${order.id}/fulfill\`, {\n      method: 'POST',\n      body: JSON.stringify({ invoiceId: order.invoiceId, reference }),\n    })\n  }\n/>`}</pre>
        <p>
          The contract binds the merchant and amount. The component handles the
          quote, HashPack or MetaMask signing and receipt recovery. Your server
          fulfills the order only after <code>verifyInvoicePayment</code>{" "}
          confirms the <code>InvoicePaid</code> receipt for the invoice stored
          with that order; <code>onPaid</code> alone is not proof.
        </p>
      </section>
      <section className="panel">
        <h2>Try a concrete integration</h2>
        <p>
          The{" "}
          <Link href="/examples">
            service invoice and prepaid-credit examples
          </Link>{" "}
          share the same <code>QuotePreview</code> component. Mainnet USDC
          pricing is live and read-only; your configured testnet checkout
          handles invoice payment.
        </p>
        <p>
          <a href="https://github.com/STOOOKEEE/hbar-checkout/blob/main/docs/CUSTOMIZATION.md">
            Customization recipe
          </a>{" "}
          ·{" "}
          <a href="https://github.com/STOOOKEEE/hbar-checkout/blob/main/docs/REFERENCE.md">
            API reference
          </a>{" "}
          ·{" "}
          <a href="https://github.com/STOOOKEEE/hbar-checkout/blob/main/docs/TROUBLESHOOTING.md">
            Troubleshooting
          </a>
        </p>
      </section>
      <section className="panel">
        <h2>Know the boundary</h2>
        <p>
          The starter supports HBAR input and one fee-free HTS token through a
          direct SaucerSwap V1 pool. It checks token association, expiry,
          maximum spend and the exact delivered amount. Testnet transactions are
          enabled after deployment; mainnet quotes are read-only. This is
          unaudited template code, and local mocks do not validate Hedera
          precompiles.
        </p>
      </section>
      <Link className="button primary" href="/">
        Open the workspace →
      </Link>
    </div>
  );
}
