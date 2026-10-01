// Creates the public HCS invoice log for the deployed testnet checkout.
const {
  AccountId,
  Client,
  PrivateKey,
  TopicCreateTransaction,
} = require("@hiero-ledger/sdk");
const { readFile, writeFile } = require("node:fs/promises");
const path = require("node:path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const MIRROR = "https://testnet.mirrornode.hedera.com/api/v1";

async function main() {
  if (!process.env.HEDERA_PRIVATE_KEY)
    throw new Error(
      "Set HEDERA_PRIVATE_KEY in packages/hardhat/.env to the funded deployer ECDSA key.",
    );
  const file = path.join(__dirname, "../../../deployments/testnet.json");
  const evidence = JSON.parse(await readFile(file, "utf8"));
  if (!/^0x[0-9a-fA-F]{40}$/.test(evidence.checkout || ""))
    throw new Error("Run npm run hardhat:deploy before creating the topic.");
  if (evidence.topicId) {
    console.log(`Topic already exists for ${evidence.checkout}.`);
    console.log(`HEDERA_TOPIC_ID=${evidence.topicId}`);
    return;
  }
  const key = PrivateKey.fromStringECDSA(process.env.HEDERA_PRIVATE_KEY);
  const response = await fetch(
    `${MIRROR}/accounts/0x${key.publicKey.toEvmAddress()}`,
    { signal: AbortSignal.timeout(15000) },
  );
  const account = response.ok ? (await response.json()).account : undefined;
  if (typeof account !== "string")
    throw new Error("The deployer key has no funded testnet account.");
  const client = Client.forTestnet().setOperator(
    AccountId.fromString(account),
    key,
  );
  try {
    // No submit key: anyone may post. Readers trust only the invoice merchant.
    const response = await new TopicCreateTransaction()
      .setTopicMemo(`saucerpay:${evidence.checkout}`)
      .setAdminKey(key.publicKey)
      .execute(client);
    const receipt = await response.getReceipt(client);
    const topicId = receipt.topicId.toString();
    const topicTransactionId = response.transactionId.toString();
    await writeFile(
      file,
      JSON.stringify({ ...evidence, topicId, topicTransactionId }, null, 2) +
        "\n",
    );
    console.log(`Created by ${topicTransactionId}.`);
    console.log(`HEDERA_TOPIC_ID=${topicId}`);
    console.log(`https://hashscan.io/testnet/topic/${topicId}`);
    console.log(
      "Saved deployments/testnet.json. Add HEDERA_TOPIC_ID to packages/nextjs/.env.local and restart Next.js.",
    );
  } finally {
    client.close();
  }
}

main().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});
