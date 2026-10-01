# Host HBAR Checkout on Vercel

[README](../README.md) · [Server configuration](REFERENCE.md#configuration) · [Testnet deployment](DEPLOYMENT.md)

The web app serves real SaucerSwap quotes without any secrets. Hosting the web
app does not deploy the Solidity contract. See [testnet deployment](DEPLOYMENT.md)
to enable invoice creation and payment.

## Deploy from GitHub

Import this repository into your Vercel account with these settings:

| Setting                                         | Value                     |
| ----------------------------------------------- | ------------------------- |
| Framework                                       | Next.js                   |
| Root Directory                                  | `packages/nextjs`         |
| Include source files outside the Root Directory | Enabled                   |
| Node.js                                         | 22.x (what the packaging script selects; the source supports ≥ 20.18.3) |
| Install Command                                 | `npm ci`                  |
| Build Command                                   | `npm run build`           |
| Output Directory                                | Next.js default (`.next`) |

The frontend imports the sibling `packages/checkout` npm workspace. Keep the
repository root lockfile and workspace packages available during the build.
No environment variables are required for the quote demo. Once deployed, use
the public production URL in your own README and project metadata.

These are the settings for a Git-connected monorepo deployment. The current
public demo was validated using the packaged CLI method below; the Git import
settings have not been independently exercised in an authenticated account.

Optional server-side variables are `HEDERA_NETWORK`, `HEDERA_TOKEN_ID`,
`HEDERA_CHECKOUT_ADDRESS` and `HEDERA_TOPIC_ID` (public HCS invoice log). Mainnet
remains read-only in the reference UI. HashPack also needs the public build-time
variable `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` (free at [cloud.reown.com](https://cloud.reown.com),
not a secret); redeploy after setting it. MetaMask works without it.
Never upload `HEDERA_PRIVATE_KEY` or the Hardhat `.env` to Vercel.

The current public site serves Hedera testnet, USDC `0.0.5449` and the
[USDC reference checkout](VALIDATION.md#hosted-app-on-the-usdc-checkout--2026-10-01)
`0x140e27Cf63790a558d66C8796A67984d5164055E`; its
[paid invoice](https://hbar-checkout.vercel.app/pay/0x08c3361023db4b0b2097fe1b82f90ed5477056e570daca65967f81c521357791?tx=0xbc333a625dcc2f71703366f7f45a3277783fb21496f117e7882ab0761efc3dd8)
can be inspected without a wallet. `HEDERA_TOPIC_ID=0.0.10814952` is set in the
project. `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` is not, so HashPack is unavailable
on the hosted app. The deployer and payer keys were not uploaded to Vercel.

## Package the demo for a CLI deployment

For hosts that expect Next.js at the upload root, the repository includes a
packaging script:

```bash
node scripts/prepare-vercel.mjs
```

It prints a new temporary directory. The script copies tracked frontend and
checkout source, links the checkout npm workspace, creates a lockfile, and
supplies the Next.js build configuration. It excludes local environment files,
contract deployment credentials and build artifacts. Commit new frontend files
before packaging them so they are included by `git ls-files`.

Deploy that printed directory with an authenticated Vercel CLI:

```bash
npx vercel@59.25.0 link --cwd /path/printed/by/the/script --project your-existing-project --yes
npx vercel@59.25.0 deploy /path/printed/by/the/script --prod --yes
```

For a new site, omit the link command and follow the project's creation flow.
For an existing claimed demo, authenticate with `vercel login` and link its
existing project; claiming the initial deployment does not authenticate this
machine for subsequent publishes. Keep the same project to preserve its domains.

If adding another `vercel.app` alias, add it to the project's production domains
as well. An alias that is not a production domain can inherit Vercel's preview
authentication and redirect visitors to login. Verify the public URL in a fresh
browser context. `npm run smoke` rejects authentication redirects.

Vercel CLI 59.25.0 also offers `deploy --temporary --yes` without an account.
That mode builds locally and returns a public demo URL, an expiration timestamp
and a private claim link. The owner must claim the deployment before it expires
to keep it available. Never commit or publish the claim link or `.vercel` state.

## Verify the hosted app

```bash
SMOKE_ORIGIN=https://your-site.vercel.app npm run smoke
```

Also request a real quote in both network modes and open the app on mobile.
Successful HTTP checks and quotes verify hosting, not an executed payment.

References: [Vercel monorepos](https://vercel.com/docs/monorepos) and
[files outside the root directory](https://vercel.com/docs/monorepos/monorepo-faq).
