import { quotePayment } from "@hbar-checkout/checkout";
import { getConfig, errorResponse } from "@/lib/server";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const query = new URL(request.url).searchParams;
    const config = getConfig(query.get("network"));
    const quote = await quotePayment(config, {
      amount: query.get("amount") || undefined,
      invoiceId: query.get("invoiceId") || undefined,
      slippageBps: Number(query.get("slippageBps") ?? "50"),
    });
    return Response.json({ quote });
  } catch (error) {
    return errorResponse(error);
  }
}
