import {
  CheckoutError,
  previewConfig,
  quotePayment,
} from "@hbar-checkout/checkout";
import { errorResponse } from "@/lib/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const query = new URL(request.url).searchParams;
    if (query.has("invoiceId"))
      throw new CheckoutError(
        "READ_ONLY",
        "Use the invoice quote endpoint for payment.",
      );
    const config = previewConfig(query.get("preset") || "mainnet-usdc");
    const quote = await quotePayment(config, {
      amount: query.get("amount") || "25",
      slippageBps: Number(query.get("slippageBps") ?? "50"),
    });
    return Response.json({ config, quote, readOnly: true });
  } catch (error) {
    return errorResponse(error);
  }
}
