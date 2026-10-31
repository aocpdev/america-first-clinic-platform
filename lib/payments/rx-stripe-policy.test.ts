import assert from "node:assert/strict";
import test from "node:test";
import type Stripe from "stripe";
import { assertRxStripeConfiguration, rxCaptureEvidence, rxCheckoutParameters, RX_PAYMENT_SOURCE, type RxPaymentContract } from "./rx-stripe-policy";

const contract: RxPaymentContract = { version: 1, companyId: crypto.randomUUID(), customerId: crypto.randomUUID(), orderId: crypto.randomUUID(), mode: "live", currency: "usd", totalCents: 22900, grossMarginCents: 11100, createdAt: new Date().toISOString(), sessionId: "cs_live_fixture" };
function event(overrides: Record<string, unknown> = {}) {
  return { id: "evt_fixture", type: "payment_intent.succeeded", livemode: true, data: { object: { object: "payment_intent", id: "pi_fixture", livemode: true, status: "succeeded", amount: 22900, amount_received: 22900, currency: "usd", metadata: { source: RX_PAYMENT_SOURCE, ...contract, stripeMode: "live" }, ...overrides } } } as unknown as Stripe.Event;
}
test("RX requires matching environment keys and a webhook; never pretends payment is configured", () => {
  assert.doesNotThrow(() => assertRxStripeConfiguration({ mode: "live", secretKey: "sk_live_fixture", webhookSecret: "whsec_fixture" }));
  for (const config of [{ mode: "live", secretKey: "sk_test_fixture", webhookSecret: "whsec_fixture" }, { mode: "live", secretKey: "sk_live_fixture" }, { mode: "test" }, { mode: "other" }]) assert.throws(() => assertRxStripeConfiguration(config), /CONFIGURATION_REQUIRED/);
});
test("hosted checkout uses stored totals and does not introduce another agency fee or destination transfer", () => {
  const params = rxCheckoutParameters(contract, [{ name: "Admin product", unitAmount: 22900, quantity: 1 }], "customer@example.test");
  assert.equal(params.metadata?.source, RX_PAYMENT_SOURCE);
  assert.equal(params.payment_intent_data?.application_fee_amount, undefined);
  assert.equal(params.payment_intent_data?.transfer_data, undefined);
  assert.deepEqual(params.automatic_tax, { enabled: false });
  assert.equal(params.line_items?.[0].price_data?.tax_behavior, "inclusive");
  assert.equal(params.line_items?.[0].price_data?.unit_amount, 22900);
  assert.equal(params.shipping_options, undefined);
  assert.equal(params.success_url, `https://rx.govirtualhealth.com/account/orders/${contract.orderId}?checkout=complete`);
  assert.throws(() => rxCheckoutParameters(contract, [{ name: "Changed price", unitAmount: 1, quantity: 1 }], "customer@example.test"), /TOTAL_MISMATCH/);
});
test("capture evidence rejects wrong amount, tenant, currency, status and mode", () => {
  assert.equal(rxCaptureEvidence(event(), contract)?.amountCents, 22900);
  for (const overrides of [{ amount_received: 1 }, { currency: "eur" }, { livemode: false }, { status: "processing" }, { metadata: { ...(event().data.object as Stripe.PaymentIntent).metadata, customerId: crypto.randomUUID() } }]) assert.throws(() => rxCaptureEvidence(event(overrides), contract));
  assert.throws(() => rxCaptureEvidence({ ...event(), livemode: false }, contract), /IDENTITY_MISMATCH/);
});
test("unpaid completed session is not a capture; session must be bound to this order", () => {
  const session = { ...event(), type: "checkout.session.completed", data: { object: { ...event().data.object, object: "checkout.session", id: contract.sessionId, mode: "payment", client_reference_id: contract.orderId, amount_total: 22900, payment_intent: "pi_fixture", payment_status: "unpaid" } } } as unknown as Stripe.Event;
  assert.equal(rxCaptureEvidence(session, contract), null);
  const paid = { ...session, data: { object: { ...session.data.object, payment_status: "paid" } } } as unknown as Stripe.Event;
  assert.equal(rxCaptureEvidence(paid, contract)?.paymentIntentId, "pi_fixture");
  assert.throws(() => rxCaptureEvidence(paid, { ...contract, sessionId: "cs_other" }), /SESSION_MISMATCH/);
});
