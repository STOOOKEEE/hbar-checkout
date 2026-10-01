import {
  assertAssociated,
  assertDeployment,
  CheckoutError,
} from "@hbar-checkout/checkout";
import { getConfig, errorResponse } from "@/lib/server";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const config = getConfig();
    if (config.network !== "testnet")
      throw new CheckoutError("READ_ONLY", "Use testnet to create invoices.");
    await assertDeployment(config);
    await assertAssociated(
      config,
      new URL(request.url).searchParams.get("merchant") || "",
    );
    return Response.json({ ready: true });
  } catch (error) {
    return errorResponse(error);
  }
}
