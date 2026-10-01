import {
  assertDeployment,
  readInvoice,
  readToken,
  readTransactionReceipt,
  verifyPaymentReceipt,
  CheckoutError,
} from "@saucerpay/checkout";
import { getConfig, errorResponse } from "@/lib/server";
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const config = getConfig();
    await assertDeployment(config);
    const { id } = await context.params;
    const [invoice, token] = await Promise.all([
      readInvoice(config, id),
      readToken(config),
    ]);
    const reference = new URL(request.url).searchParams.get("tx");
    let payment;
    if (reference) {
      const receipt = await readTransactionReceipt(config, reference);
      if (!receipt)
        throw new CheckoutError(
          "PENDING_RECEIPT",
          "Receipt is not indexed yet. Refresh shortly.",
        );
      payment = verifyPaymentReceipt(config, invoice, receipt);
    }
    return Response.json({
      config,
      invoice,
      token,
      ...(payment ? { payment } : {}),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
