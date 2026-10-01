const { ethers } = require("hardhat");
const { mkdir, writeFile } = require("node:fs/promises");
const path = require("node:path");

async function main() {
  const [deployer] = await ethers.getSigners();
  if (!deployer)
    throw new Error(
      "Set HEDERA_PRIVATE_KEY in packages/hardhat/.env to a funded testnet ECDSA key. See docs/DEPLOYMENT.md.",
    );
  if ((await ethers.provider.getNetwork()).chainId !== 296n)
    throw new Error("Deployment is restricted to Hedera testnet.");
  const entity = (id) => {
    if (!/^0\.0\.[1-9]\d*$/.test(id))
      throw new Error("Expected a 0.0.x token ID.");
    return ethers.getAddress(
      "0x" + BigInt(id.slice(4)).toString(16).padStart(40, "0"),
    );
  };
  const router = entity("0.0.19264");
  const whbar = entity("0.0.15058");
  const tokenId = process.env.HEDERA_TOKEN_ID || "0.0.5449";
  const token = entity(tokenId);
  const metadataResponse = await fetch(
    `https://testnet.mirrornode.hedera.com/api/v1/tokens/${tokenId}`,
    { signal: AbortSignal.timeout(15000) },
  );
  if (!metadataResponse.ok)
    throw new Error("Cannot verify the settlement token on the mirror node.");
  const metadata = await metadataResponse.json();
  if (
    metadata.deleted ||
    metadata.type !== "FUNGIBLE_COMMON" ||
    Number(metadata.decimals) > 18 ||
    Object.values(metadata.custom_fees || {}).some(
      (v) => Array.isArray(v) && v.length,
    )
  )
    throw new Error(
      "Select an active fungible HTS token without custom fees and with at most 18 decimals.",
    );
  const routerContract = new ethers.Contract(
    router,
    ["function getAmountsIn(uint256,address[]) view returns (uint256[])"],
    ethers.provider,
  );
  const sample = await routerContract.getAmountsIn(
    ethers.parseUnits("1", Number(metadata.decimals)),
    [whbar, token],
  );
  if (sample[0] <= 0n)
    throw new Error(
      "The configured direct pool cannot quote one settlement token.",
    );
  console.log(
    `Deploying for ${metadata.symbol} (${tokenId}), signer ${deployer.address}.`,
  );
  console.log(
    `Observed quote for 1 token: ${ethers.formatUnits(sample[0], 8)} HBAR (read-only).`,
  );
  const checkout = await (
    await ethers.getContractFactory("SaucerPay")
  ).deploy(router, whbar, token);
  await checkout.waitForDeployment();
  const receipt = await checkout.deploymentTransaction().wait();
  if (!receipt || receipt.status !== 1)
    throw new Error("Deployment receipt was not successful.");
  const address = await checkout.getAddress();
  const evidence = {
    network: "testnet",
    chainId: 296,
    checkout: address,
    router,
    whbar,
    token,
    tokenId,
    deployer: deployer.address,
    transactionHash: receipt.hash,
    hashscan: `https://hashscan.io/testnet/transaction/${receipt.hash}`,
    mirror: `https://testnet.mirrornode.hedera.com/api/v1/contracts/results/${receipt.hash}`,
    timestamp: new Date().toISOString(),
  };
  const directory = path.join(__dirname, "../../../deployments");
  await mkdir(directory, { recursive: true });
  await writeFile(
    path.join(directory, "testnet.json"),
    JSON.stringify(evidence, null, 2) + "\n",
  );
  console.log(`HEDERA_CHECKOUT_ADDRESS=${address}`);
  console.log(evidence.mirror);
  console.log(evidence.hashscan);
  console.log(
    "Saved deployments/testnet.json. Configure packages/nextjs/.env.local and restart Next.js.",
  );
}
main().catch((error) => {
  console.error(error.shortMessage || error.message);
  process.exitCode = 1;
});
