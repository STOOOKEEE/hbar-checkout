import assert from "node:assert/strict";
const origin = process.env.SMOKE_ORIGIN || "http://localhost:3000";
for (const route of ["/", "/guide", "/examples", "/pay/0x" + "ab".repeat(32)]) {
  const response = await fetch(origin + route);
  assert.equal(
    response.redirected,
    false,
    `${route} must be public without an authentication redirect`,
  );
  assert.equal(
    response.status,
    200,
    `${route} should boot without credentials`,
  );
  assert.match(await response.text(), /<title>HBAR Checkout/);
  console.log(`OK ${route}`);
}
const invalid = await fetch(origin + "/api/quote?network=invalid");
assert.equal(invalid.status, 400);
assert.equal((await invalid.json()).code, "INVALID_NETWORK");
console.log("OK invalid-network error contract");
const unsafe = await fetch(
  origin + "/api/preview?preset=mainnet-usdc&invoiceId=0x" + "ab".repeat(32),
);
assert.equal(unsafe.status, 400);
assert.equal((await unsafe.json()).code, "READ_ONLY");
const unknown = await fetch(origin + "/api/preview?preset=__proto__");
assert.equal(unknown.status, 400);
assert.equal((await unknown.json()).code, "INVALID_PRESET");
console.log("OK preview cannot select an arbitrary asset or quote an invoice");
const fulfill = (orderId, body) =>
  fetch(`${origin}/api/orders/${orderId}/fulfill`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
const malformed = await fulfill("example-order", {
  invoiceId: "0x1234",
  reference: "0x" + "ab".repeat(32),
});
assert.equal(malformed.status, 400);
assert.equal((await malformed.json()).code, "INVALID_INVOICE");
const unknownOrder = await fulfill("missing-order", {
  invoiceId: "0x" + "ab".repeat(32),
  reference: "0.0.1234@1700000000.000000001",
});
assert.equal(unknownOrder.status, 404);
console.log("OK fulfillment rejects malformed input and unknown orders");
