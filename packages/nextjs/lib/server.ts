import {
  CheckoutError,
  networkConfig,
  type Network,
} from "@hbar-checkout/checkout";

export function getConfig(requested?: string | null) {
  const selected = process.env.HEDERA_NETWORK || "testnet";
  const network = requested || selected;
  if (network !== "testnet" && network !== "mainnet")
    throw new CheckoutError("INVALID_NETWORK", "Use testnet or mainnet.");
  return networkConfig(
    network as Network,
    network === selected ? process.env.HEDERA_CHECKOUT_ADDRESS : undefined,
    network === selected ? process.env.HEDERA_TOKEN_ID : undefined,
    network === selected ? process.env.HEDERA_TOPIC_ID : undefined,
  );
}

export function errorResponse(error: unknown) {
  if (error instanceof CheckoutError) {
    const status =
      error.code === "NOT_FOUND"
        ? 404
        : [
              "NETWORK_UNAVAILABLE",
              "RPC_FAILED",
              "CONTRACT_UNAVAILABLE",
            ].includes(error.code)
          ? 503
          : 400;
    return Response.json(
      { error: error.message, code: error.code },
      { status },
    );
  }
  return Response.json(
    {
      error:
        "The request could not be completed. Check the network configuration and try again.",
      code: "REQUEST_FAILED",
    },
    { status: 500 },
  );
}
