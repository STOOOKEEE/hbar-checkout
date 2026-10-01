# From a fresh scaffold to your first quote

[README](../README.md) · Next: [testnet payment](DEPLOYMENT.md) · [Troubleshooting](TROUBLESHOOTING.md)

**Outcome:** a local app that reads the amount of HBAR needed to receive an exact token amount. This walkthrough performs no blockchain writes and needs no wallet, API key, private key or funded account.

## 1. Check your tools

```bash
node --version
npm --version
git --version
git config user.name
git config user.email
```

Use Node.js 20.18.3 or newer (`package.json` `engines`). A full install, lint, test, build, start and smoke run passed on Node 20.18.3 with npm 10.9.8 ([record](VALIDATION.md#node-20183-compatibility--2026-10-01)); earlier records used Node 22.23.2. On Node 20.18.x, `npm ci` prints `EBADENGINE` warnings for some transitive packages (vite, chokidar, unused React Native peers); they do not stop the install or the build. If Git's author fields are empty, configure your own name and email using `git config --global user.name` and `git config --global user.email` before using the generator. Do not copy someone else's identity.

You also need internet access for npm packages, Hedera's public RPC and mirror node. Offline tests can pass while live quotes fail.

## 2. Generate the app

From the parent folder in which you want the new project:

```bash
npx create-scaffold-hbar@latest --template STOOOKEEE/hbar-checkout
```

Choose a new folder name, such as `my-checkout`, and keep the supported defaults: Next.js, Hardhat, npm. The generator installs dependencies and initializes Git. Wait for it to finish successfully, then:

```bash
cd my-checkout
npm run dev
```

Do not run `npm ci` concurrently with the generator. If its installation failed, resolve the reported error and run `npm ci` from the generated project root.

Expected terminal result: Next.js reports it is ready and prints a local address. Open http://localhost:3000/workspace, or `/workspace` on the alternate port printed if 3000 is already occupied. The root `/` is the landing page; the merchant workspace lives at `/workspace`. No `.env` is required.

The generator consumes `template.json`; its absence in the generated app is expected. It remains present in the source repository.

## 3. Get a real price

In the **quote panel** on `/workspace` (separate from the merchant invoice form; `/examples` has the same panel):

1. Set **Quote asset** to **USDC · Testnet**.
2. Enter `1` in **Requested token amount**.
3. Click **Get live quote**.
4. Check the result shows `1 USDC`, quoted HBAR, maximum HBAR and a timestamp.
5. Choose **USDC · Mainnet (read only)** to compare with mainnet liquidity. Testnet pool prices are not market prices.

The maximum includes the preview's 0.5% price movement allowance. It excludes network fees. Values depend on live pool reserves; there is no expected fixed HBAR price.

The quote-asset selector changes only the read-only preview, not the configured contract or merchant wallet network. Creation remains testnet-only and unavailable until deployment. The default token IDs differ between networks; see [configuration](REFERENCE.md#configuration).

## 4. Read the same integration outside the UI

From the project root, in another terminal:

```bash
npx tsx packages/checkout/examples/quote.ts
```

Expected: a JSON result with `network`, `tokenId`, `receive`, `quotedHbar`, `maximumHbar` and `validUntil`. Inspect [the complete example](../packages/checkout/examples/quote.ts): it calls the same shared package used by the app. It never signs a transaction.

To exercise the HTTP route while the app runs:

```bash
curl --fail-with-body 'http://localhost:3000/api/quote?network=testnet&amount=1&slippageBps=50'
```

Expected: `{"quote": ...}` with integer amounts encoded as strings. For USDC's 6 decimals, `amountOut` is `"1000000"`. Prices and expiry vary. [Response fields](REFERENCE.md#http-api).

## 5. Verify the local build

Stop the dev server with Ctrl+C before starting production on the same port:

```bash
npm run lint
npm test
npm run build
npm start            # or PORT=3020 npm start for another port
```

In another terminal at the project root:

```bash
npm run smoke        # or SMOKE_ORIGIN=http://localhost:3020 npm run smoke
```

Expected: lint and types pass, the TypeScript and 11 contract tests pass, the build completes, and smoke prints `OK` lines for the landing page (`/`), workspace (`/workspace`), guide, examples and invoice pages, the invalid-network error, the preview allowlist and the example fulfill endpoint. The error checks intentionally send invalid requests and expect HTTP 400/404. Use `PORT=…` to change the port: `npm start -- -p 3020` is turned into `next start 3020` by the workspace wrapper and fails.

`npm run probe` separately reads both live networks. Read its per-network results: the command only exits with failure if both probes fail. A zero exit code does not prove both networks are healthy.

## What next?

- **I want to understand the pattern:** read [Architecture](ARCHITECTURE.md), including the tinybar/wei example.
- **I want to make a real testnet payment:** follow [Deployment](DEPLOYMENT.md). Creating the Vercel site did not deploy the Solidity contract.
- **I want my own product screen:** follow [Customization](CUSTOMIZATION.md).
- **Something differs from the expected result:** use [Troubleshooting](TROUBLESHOOTING.md), starting with the exact error text.
