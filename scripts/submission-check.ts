import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  assertDeployment,
  networkConfig,
  readInvoice,
  readTransactionReceipt,
  rpc,
  validateInvoiceId,
  verifyPaymentReceipt,
} from "../packages/checkout/src/index";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const failures: string[] = [];
function check(name: string, ok: boolean, fix: string) {
  console.log(`${ok ? "PASS" : "FAIL"} ${name}`);
  if (!ok) failures.push(fix);
}

for (const file of [
  "README.md",
  "AGENTS.md",
  "LICENSE",
  "template.json",
  "docs/SUBMISSION.md",
])
  check(
    file,
    existsSync(resolve(root, file)),
    `Add ${file} to the source repository.`,
  );

try {
  const manifest = JSON.parse(
    readFileSync(resolve(root, "template.json"), "utf8"),
  );
  check(
    "Scaffold-HBAR manifest",
    Boolean(
      manifest["create-scaffold-hbar"]?.capabilities?.frontend?.includes(
        "nextjs-app",
      ),
    ),
    "Restore the supported source manifest (the generator consumes its output copy).",
  );
  const pkg = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));
  check(
    "MIT license and workspaces",
    pkg.license === "MIT" &&
      pkg.workspaces.includes("packages/hardhat") &&
      pkg.workspaces.includes("packages/nextjs"),
    "Retain the MIT license and frontend/contracts workspaces.",
  );
  const tracked = execFileSync("git", ["ls-files", "-z"], {
    cwd: root,
    encoding: "utf8",
  })
    .split("\0")
    .filter(Boolean);
  const envFiles = tracked.filter(
    (file) => /(^|\/)\.env($|\.)/.test(file) && !file.endsWith(".env.example"),
  );
  check(
    "No tracked runtime env files",
    envFiles.length === 0,
    "Remove runtime env files from version control; rotate any exposed keys.",
  );
} catch {
  check(
    "Source metadata readable",
    false,
    "Run this command from a Git checkout of the source template with valid JSON manifests.",
  );
}

const evidencePath = resolve(
  process.argv[2] || resolve(root, "deployments/payment-evidence.json"),
);
if (!existsSync(evidencePath)) {
  check(
    "Verified testnet payment evidence",
    false,
    "Fund a testnet ECDSA account, run hardhat:deploy then testnet:payment, or provide the JSON downloaded from a verified UI payment: npm run submission:check -- /path/to/receipt.json",
  );
} else {
  try {
    const evidence = JSON.parse(readFileSync(evidencePath, "utf8"));
    if (
      evidence.network !== "testnet" ||
      typeof evidence.checkout !== "string" ||
      typeof evidence.tokenId !== "string" ||
      !/^0x[0-9a-fA-F]{64}$/.test(evidence.paymentHash || "")
    )
      throw new Error(
        "Evidence must identify a testnet checkout, token and payment transaction hash.",
      );
    validateInvoiceId(evidence.invoiceId || "");
    const config = networkConfig(
      "testnet",
      evidence.checkout,
      evidence.tokenId,
    );
    if (BigInt(String(await rpc(config, "eth_chainId", []))) !== 296n)
      throw new Error("The RPC is not Hedera testnet.");
    await assertDeployment(config);
    const invoice = await readInvoice(config, evidence.invoiceId);
    const receipt = await readTransactionReceipt(config, evidence.paymentHash);
    if (!receipt)
      throw new Error("Receipt is not indexed; retry the read later.");
    const payment = verifyPaymentReceipt(config, invoice, receipt);
    if (invoice.status !== "paid" || payment.amountOut !== evidence.amountOut)
      throw new Error(
        "Evidence amount or current invoice state does not match the verified payment.",
      );
    const mirror = `https://testnet.mirrornode.hedera.com/api/v1/contracts/results/${evidence.paymentHash}`;
    const response = await fetch(mirror, {
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok || (await response.json()).result !== "SUCCESS")
      throw new Error(
        "The mirror node does not yet confirm a successful transaction.",
      );
    check("Verified testnet payment evidence", true, "");
    console.log(`Mirror: ${mirror}`);
    console.log(
      `HashScan: https://hashscan.io/testnet/transaction/${evidence.paymentHash}`,
    );
  } catch (error) {
    check(
      "Verified testnet payment evidence",
      false,
      error instanceof Error ? error.message : "Payment verification failed.",
    );
  }
}

if (failures.length) {
  console.log("\nSubmission preflight is incomplete:");
  failures.forEach((failure) => console.log(`- ${failure}`));
  process.exitCode = 1;
} else {
  console.log(
    "\nSource metadata and live payment evidence verified. Also run fresh scaffold/install/lint/build/boot checks and complete the official submission form. This is not the organizer's eligibility validator.",
  );
}
