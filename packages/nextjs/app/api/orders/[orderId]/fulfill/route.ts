import {
  validateInvoiceId,
  validatePaymentReference,
  verifyInvoicePayment,
  CheckoutError,
  type PaymentReceipt,
} from "@saucerpay/checkout";
import { getConfig, errorResponse } from "@/lib/server";
export const dynamic = "force-dynamic";

/**
 * EXAMPLE ONLY: stands in for your order database. Your app creates the order
 * for an authenticated customer, creates its on-chain invoice and stores the
 * binding. The entry is the paid testnet invoice from docs/VALIDATION.md.
 */
const exampleOrders = new Map([
  [
    "example-order",
    {
      invoiceId:
        "0x08c3361023db4b0b2097fe1b82f90ed5477056e570daca65967f81c521357791",
    },
  ],
]);
/** In your app, record fulfillment in the same database transaction that delivers. */
const exampleFulfillments = new Map<string, PaymentReceipt>();

/** Body: `{ invoiceId, reference }`, where reference is the payer's transaction hash or Hedera transaction ID. */
export async function POST(
  request: Request,
  context: { params: Promise<{ orderId: string }> },
) {
  try {
    const { orderId } = await context.params;
    const body: unknown = await request.json().catch(() => null);
    const fields = typeof body === "object" && body !== null ? body : {};
    const invoiceId: unknown = Reflect.get(fields, "invoiceId");
    const reference: unknown = Reflect.get(fields, "reference");
    if (typeof invoiceId !== "string" || typeof reference !== "string")
      throw new CheckoutError(
        "INVALID_REQUEST",
        "Send JSON with invoiceId and reference strings.",
      );
    validateInvoiceId(invoiceId);
    validatePaymentReference(reference);

    const order = exampleOrders.get(orderId);
    if (!order) throw new CheckoutError("NOT_FOUND", "Unknown order.");
    if (order.invoiceId.toLowerCase() !== invoiceId.toLowerCase())
      return Response.json(
        {
          error: "This order is bound to a different invoice.",
          code: "INVOICE_MISMATCH",
        },
        { status: 409 },
      );
    const fulfilled = exampleFulfillments.get(orderId);
    if (fulfilled)
      return Response.json({ fulfilled: true, orderId, payment: fulfilled });

    const result = await verifyInvoicePayment(getConfig(), {
      invoiceId: order.invoiceId,
      reference,
    });
    if (result.status === "pending")
      return Response.json(
        { fulfilled: false, orderId, status: "pending" },
        { status: 202 },
      );
    // A concurrent request may have finished while this one awaited. Nothing
    // awaits between this check and the set, so only one request gets past it.
    const existing = exampleFulfillments.get(orderId);
    if (existing)
      return Response.json({ fulfilled: true, orderId, payment: existing });
    exampleFulfillments.set(orderId, result.payment);
    // Deliver the product or credit the account here, exactly once. This example delivers nothing.
    return Response.json({ fulfilled: true, orderId, payment: result.payment });
  } catch (error) {
    return errorResponse(error);
  }
}
