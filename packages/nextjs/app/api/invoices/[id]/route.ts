import {
  assertDeployment,
  readInvoice,
  readInvoiceLabel,
  readToken,
  verifyInvoicePayment,
  CheckoutError,
  type CheckoutConfig,
} from "@hbar-checkout/checkout";
import { getConfig, errorResponse } from "@/lib/server";
export const dynamic = "force-dynamic";

/** With a `?tx=` reference, the response only carries a verified, settled payment. */
async function readInvoiceState(
  config: CheckoutConfig,
  id: string,
  reference: string | null,
) {
  if (!reference) {
    await assertDeployment(config);
    return { invoice: await readInvoice(config, id), payment: undefined };
  }
  const result = await verifyInvoicePayment(config, {
    invoiceId: id,
    reference,
  });
  if (result.status === "pending")
    throw new CheckoutError(
      "PENDING_RECEIPT",
      "Receipt is not indexed yet. Refresh shortly.",
    );
  return { invoice: result.invoice, payment: result.payment };
}

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const config = getConfig();
    const { id } = await context.params;
    const reference = new URL(request.url).searchParams.get("tx");
    const [{ invoice, payment }, token] = await Promise.all([
      readInvoiceState(config, id, reference),
      readToken(config),
    ]);
    // Merchant-authored HCS metadata is optional: a mirror outage omits it.
    const label = await readInvoiceLabel(config, invoice).catch(
      (error: unknown) => {
        if (error instanceof CheckoutError) return null;
        throw error;
      },
    );
    return Response.json({
      config,
      invoice,
      token,
      payment,
      label: label ?? undefined,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
