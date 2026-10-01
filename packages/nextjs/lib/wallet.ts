import {
  BrowserProvider,
  getAddress,
  getBytes,
  toBeHex,
  type Eip1193Provider,
} from "ethers";
import type { DAppConnector } from "@hashgraph/hedera-wallet-connect";
import {
  bufferedGasLimit,
  readTransactionReceipt,
  rpc,
  rpcWeiToTinybar,
  type CheckoutConfig,
  type TransactionReceipt,
} from "@saucerpay/checkout";

export type WalletKind = "evm" | "hashpack";
/** `value` is RPC wei, as returned by paymentTransaction. */
export type ContractRequest = { to: string; data: string; value?: bigint };
export type Wallet = {
  kind: WalletKind;
  /** EVM address the contract sees as msg.sender. */
  address: string;
  /** Returns an EVM transaction hash (MetaMask) or a Hedera transaction ID (HashPack). */
  send(request: ContractRequest): Promise<string>;
  /** Associates the settlement token with this account and waits for success. */
  associate(): Promise<void>;
};

const ASSOCIATE_CALLDATA = "0x0a754de6"; // HIP-719 token facade associate()

export async function connectWallet(
  config: CheckoutConfig,
  kind: WalletKind,
): Promise<Wallet> {
  if (config.network !== "testnet")
    throw new Error("The reference app supports testnet signing only.");
  return kind === "hashpack"
    ? connectHashPack(config)
    : connectInjected(config);
}

async function estimateGas(
  config: CheckoutConfig,
  from: string,
  request: ContractRequest,
): Promise<bigint> {
  const estimate = await rpc(config, "eth_estimateGas", [
    { from, to: request.to, data: request.data, value: toBeHex(request.value ?? 0n) },
  ]);
  return bufferedGasLimit(BigInt(String(estimate)));
}

async function connectInjected(config: CheckoutConfig): Promise<Wallet> {
  const ethereum = (window as unknown as { ethereum?: Eip1193Provider })
    .ethereum;
  if (!ethereum)
    throw new Error(
      "No EVM browser wallet found. Install MetaMask or choose HashPack.",
    );
  const chainId = "0x128";
  const current = await ethereum.request({ method: "eth_chainId" });
  if (current !== chainId) {
    try {
      await ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId }],
      });
    } catch (error) {
      if ((error as { code?: number }).code !== 4902) throw error;
      await ethereum.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId,
            chainName: "Hedera Testnet",
            rpcUrls: [config.rpcUrl],
            nativeCurrency: { name: "HBAR", symbol: "HBAR", decimals: 18 },
            blockExplorerUrls: ["https://hashscan.io/testnet"],
          },
        ],
      });
      await ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId }],
      });
    }
  }
  await ethereum.request({ method: "eth_requestAccounts" });
  const provider = new BrowserProvider(ethereum);
  if ((await provider.getNetwork()).chainId !== 296n)
    throw new Error("Switch your wallet to Hedera testnet.");
  const signer = await provider.getSigner();
  const address = await signer.getAddress();
  const wallet: Wallet = {
    kind: "evm",
    address,
    async send(request) {
      const tx = await signer.sendTransaction({
        ...request,
        chainId: config.chainId,
        gasLimit: await estimateGas(config, address, request),
      });
      return tx.hash;
    },
    async associate() {
      await confirm(
        config,
        await wallet.send({ to: config.token, data: ASSOCIATE_CALLDATA }),
      );
    },
  };
  return wallet;
}

let connector: Promise<DAppConnector> | null = null;

async function hashPackConnector(): Promise<DAppConnector> {
  const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;
  if (!projectId)
    throw new Error(
      "HashPack needs NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID. Create a free project ID at cloud.reown.com.",
    );
  connector ??= (async () => {
    // Lazy: keeps WalletConnect and the Hedera SDK out of the initial bundle
    // and off the server; MetaMask-only visitors never download them.
    const [wc, sdk] = await Promise.all([
      import("@hashgraph/hedera-wallet-connect"),
      import("@hiero-ledger/sdk"),
    ]);
    const instance = new wc.DAppConnector(
      {
        name: "SaucerPay",
        description: "Invoices paid in HBAR, settled in HTS tokens.",
        url: window.location.origin,
        icons: [`${window.location.origin}/favicon.ico`],
      },
      sdk.LedgerId.TESTNET,
      projectId,
      [wc.HederaJsonRpcMethod.SignAndExecuteTransaction],
      [wc.HederaSessionEvent.ChainChanged, wc.HederaSessionEvent.AccountsChanged],
      [wc.HederaChainId.Testnet],
    );
    await instance.init({ logger: "error" });
    return instance;
  })().catch((error: unknown) => {
    connector = null;
    throw error;
  });
  return connector;
}

/** Native Hedera ContractExecuteTransaction for a request; payable value in tinybar. */
export async function contractExecute(
  config: CheckoutConfig,
  request: ContractRequest,
  gas: bigint,
) {
  const sdk = await import("@hiero-ledger/sdk"); // lazy, see hashPackConnector
  const to = getAddress(request.to);
  // Long-zero addresses (HTS token facades, legacy contracts) encode the entity number.
  const contractId = to.startsWith("0x000000000000000000000000")
    ? sdk.ContractId.fromSolidityAddress(to)
    : sdk.ContractId.fromString(
        await mirrorString(config, `/contracts/${to}`, "contract_id"),
      );
  return new sdk.ContractExecuteTransaction()
    .setContractId(contractId)
    .setGas(Number(gas)) // `long` mishandles bigint input
    .setFunctionParameters(getBytes(request.data))
    .setPayableAmount(
      sdk.Hbar.fromTinybars(rpcWeiToTinybar(request.value ?? 0n).toString()),
    );
}

async function mirrorString(
  config: CheckoutConfig,
  path: string,
  field: string,
): Promise<string> {
  const response = await fetch(`${config.mirrorUrl}${path}`, {
    signal: AbortSignal.timeout(12_000),
  });
  const body: unknown = response.ok ? await response.json() : null;
  const value: unknown =
    body && typeof body === "object" ? Reflect.get(body, field) : undefined;
  if (typeof value !== "string")
    throw new Error(`Hedera testnet mirror node has no ${path}.`);
  return value;
}

async function connectHashPack(config: CheckoutConfig): Promise<Wallet> {
  const instance = await hashPackConnector();
  if (!instance.signers.length) {
    const extension = instance.extensions.find(
      (item) => item.available && /hashpack/i.test(item.name ?? ""),
    );
    if (extension) await instance.connectExtension(extension.id);
    else await instance.openModal();
  }
  const signer = instance.signers[0];
  if (!signer) throw new Error("HashPack did not return an account.");
  const address = getAddress(
    await mirrorString(
      config,
      `/accounts/${signer.getAccountId().toString()}`,
      "evm_address",
    ),
  );
  return {
    kind: "hashpack",
    address,
    async send(request) {
      const transaction = await contractExecute(
        config,
        request,
        await estimateGas(config, address, request),
      );
      await transaction.freezeWithSigner(signer);
      const result = await transaction.executeWithSigner(signer);
      return result.transactionId.toString();
    },
    async associate() {
      const transaction = await tokenAssociate(
        config,
        signer.getAccountId().toString(),
      );
      await transaction.freezeWithSigner(signer);
      const result = await transaction.executeWithSigner(signer);
      await result.getReceiptWithSigner(signer); // throws unless SUCCESS
    },
  };
}

/** Native HTS association: cheaper and more predictable than the facade call. */
export async function tokenAssociate(config: CheckoutConfig, accountId: string) {
  const sdk = await import("@hiero-ledger/sdk"); // lazy, see hashPackConnector
  return new sdk.TokenAssociateTransaction()
    .setAccountId(accountId)
    .setTokenIds([config.tokenId]);
}

/** Polls until the transaction is indexed; throws if it reverted. */
export async function confirm(
  config: CheckoutConfig,
  reference: string,
  timeoutMs = 90_000,
): Promise<TransactionReceipt> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const receipt = await readTransactionReceipt(config, reference);
    if (receipt) {
      if (receipt.status !== 1) throw new Error("The transaction reverted.");
      return receipt;
    }
    if (Date.now() > deadline)
      throw new Error(
        "Receipt not available yet. Use Refresh status to reconcile the transaction.",
      );
    const { promise, resolve } = Promise.withResolvers<void>();
    setTimeout(resolve, 2_000);
    await promise;
  }
}

export async function api<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    cache: "no-store",
    signal: AbortSignal.timeout(60_000),
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || "Request failed.");
  return body as T;
}

export function message(error: unknown): string {
  const value = error as {
    code?: string | number;
    shortMessage?: string;
    message?: string;
  };
  if (value.code === "ACTION_REJECTED" || value.code === 4001)
    return "Wallet request cancelled.";
  return (
    value.shortMessage ||
    value.message ||
    "The operation could not be completed."
  );
}
export const shortAddress = (value: string) =>
  `${value.slice(0, 6)}…${value.slice(-4)}`;
