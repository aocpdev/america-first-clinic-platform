import type Stripe from "stripe";
import { z } from "zod";

export const RX_PAYMENT_SOURCE = "rx_checkout_v1";
export const rxPaymentContractSchema = z.object({
  version: z.literal(1), companyId: z.string().uuid(), customerId: z.string().uuid(), orderId: z.string().uuid(),
  mode: z.enum(["live", "test"]), currency: z.literal("usd"), totalCents: z.number().int().positive().safe(),
  grossMarginCents: z.number().int().safe(), createdAt: z.string().datetime(),
  sessionId: z.string().startsWith("cs_").nullable()
});
export type RxPaymentContract = z.infer<typeof rxPaymentContractSchema>;

/** RX fails closed; unlike the legacy provider it must never return a fake success URL. */
export function assertRxStripeConfiguration(config: { mode: string; secretKey?: string; webhookSecret?: string }) {
  if (!["live", "test"].includes(config.mode) || !config.secretKey?.startsWith(`sk_${config.mode}_`) || !config.webhookSecret?.startsWith("whsec_")) {
    throw new Error("RX_STRIPE_CONFIGURATION_REQUIRED");
  }
}

export function rxCheckoutParameters(contract: RxPaymentContract, items: Array<{ name: string; unitAmount: number; quantity: number }>, email: string): Stripe.Checkout.SessionCreateParams {
  rxPaymentContractSchema.parse(contract);
  let total = 0;
  if (!items.length) throw new Error("RX_ORDER_ITEMS_REQUIRED");
  for (const item of items) {
    if (!item.name || !Number.isSafeInteger(item.unitAmount) || item.unitAmount < 0 || !Number.isSafeInteger(item.quantity) || item.quantity <= 0) throw new Error("RX_INVALID_ORDER_ITEM");
    total += item.unitAmount * item.quantity;
  }
  if (!Number.isSafeInteger(total) || total !== contract.totalCents) throw new Error("RX_ORDER_TOTAL_MISMATCH");
  const metadata = { source: RX_PAYMENT_SOURCE, companyId: contract.companyId, customerId: contract.customerId, orderId: contract.orderId, stripeMode: contract.mode };
  return {
    mode: "payment", payment_method_types: ["card"], client_reference_id: contract.orderId,
    // Admin prices are the final customer charge. This does not calculate a tax liability.
    automatic_tax: { enabled: false },
    customer_email: email,
    // No destination_charge/application_fee_amount: the existing agency-fee transfer remains separate.
    payment_intent_data: { metadata }, metadata,
    line_items: items.map(item => ({ quantity: item.quantity, price_data: { currency: "usd", unit_amount: item.unitAmount, tax_behavior: "inclusive", product_data: { name: item.name } } })),
    success_url: `https://rx.govirtualhealth.com/account/orders/${contract.orderId}?checkout=complete`,
    cancel_url: `https://rx.govirtualhealth.com/account/orders/${contract.orderId}?checkout=cancelled`
  };
}

const captureProof = Symbol("verified-rx-capture");
export type RxCaptureEvidence = {
  readonly [captureProof]: true;
  companyId: string; customerId: string; orderId: string; paymentIntentId: string;
  amountCents: number; mode: "live" | "test"; eventId: string; eventType: string;
};

/** Call only after Stripe signature verification against the expected environment secret.
 * Success-page navigation and an unpaid completed Checkout Session are not payment evidence. */
export function rxCaptureEvidence(event: Stripe.Event, contract: RxPaymentContract): RxCaptureEvidence | null {
  rxPaymentContractSchema.parse(contract);
  if (!["payment_intent.succeeded", "checkout.session.completed", "checkout.session.async_payment_succeeded"].includes(event.type)) return null;
  const object = event.data.object as Stripe.PaymentIntent | Stripe.Checkout.Session;
  const metadata = object.metadata;
  if (event.livemode !== (contract.mode === "live") || object.livemode !== event.livemode ||
      metadata?.source !== RX_PAYMENT_SOURCE || metadata.stripeMode !== contract.mode ||
      metadata.companyId !== contract.companyId || metadata.customerId !== contract.customerId || metadata.orderId !== contract.orderId) {
    throw new Error("RX_PAYMENT_IDENTITY_MISMATCH");
  }
  let amount: number | null;
  let intentId: string | null;
  if (object.object === "checkout.session") {
    if (object.mode !== "payment" || object.client_reference_id !== contract.orderId || !contract.sessionId || object.id !== contract.sessionId) throw new Error("RX_SESSION_MISMATCH");
    if (object.payment_status !== "paid") return null;
    amount = object.amount_total;
    intentId = typeof object.payment_intent === "string" ? object.payment_intent : object.payment_intent?.id ?? null;
  } else if (object.object === "payment_intent") {
    if (object.status !== "succeeded" || object.amount !== contract.totalCents) throw new Error("RX_PAYMENT_NOT_CAPTURED");
    amount = object.amount_received;
    intentId = object.id;
  } else throw new Error("RX_UNEXPECTED_PAYMENT_OBJECT");
  if (object.currency !== contract.currency || amount !== contract.totalCents || !intentId?.startsWith("pi_")) throw new Error("RX_PAYMENT_AMOUNT_MISMATCH");
  return { [captureProof]: true, companyId: contract.companyId, customerId: contract.customerId, orderId: contract.orderId, paymentIntentId: intentId, amountCents: amount, mode: contract.mode, eventId: event.id, eventType: event.type };
}
