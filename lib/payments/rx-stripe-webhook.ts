import type Stripe from "stripe";
import type { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { acceptRxStripePayment } from "./rx-stripe-capture";
import { acceptRxStripeRefund } from "./rx-stripe-refund";
import { RX_PAYMENT_SOURCE } from "./rx-stripe-policy";

/** Only call with an already signature-verified event. Recognize persisted RX orders
 * even if provider metadata is incomplete; they must never enter legacy capture. */
export async function isRxStripeEvent(db: Pick<PrismaClient, "order" | "paymentTransaction">, event: Stripe.Event) {
  const object = event.data.object as Stripe.PaymentIntent | Stripe.Checkout.Session | Stripe.Charge;
  if (object.metadata?.source === RX_PAYMENT_SOURCE) return true;
  const orderId = z.string().uuid().safeParse(object.metadata?.orderId);
  if (orderId.success) {
    const order = await db.order.findUnique({ where: { id: orderId.data }, select: { referralSource: true } });
    if (order?.referralSource === RX_PAYMENT_SOURCE) return true;
  }
  const intent = object.object === "payment_intent" ? object.id : "payment_intent" in object
    ? typeof object.payment_intent === "string" ? object.payment_intent : object.payment_intent?.id : null;
  return Boolean(intent && await db.paymentTransaction.findFirst({ where: { providerCode: "stripe", providerTransactionId: intent,
    order: { referralSource: RX_PAYMENT_SOURCE } }, select: { id: true } }));
}

type Config = { mode: "live" | "test"; secretKey?: string; webhookSecret?: string };
type Capture = Extract<Awaited<ReturnType<typeof acceptRxStripePayment>>, { status: "CAPTURED" }>;
type Refund = Extract<Awaited<ReturnType<typeof acceptRxStripeRefund>>, { status: "REFUND_RECORDED" }>;
export type RxPaymentEffects = {
  // Same agency fee policy and ledger; never a second fee on Checkout.
  transferAgencyFee: (input: Capture["agencyFeeInput"]) => Promise<void>;
  reverseAgencyFee: (input: Refund["agencyFeeReversalInput"]) => Promise<void>;
  paymentCaptured: (input: { captureId: string; orderId: string }) => Promise<void>;
};

/** Explicit dependencies permit local simulation without money movement. Effects must
 * be durable/idempotent before the release interlock is lifted. Never swallow failures:
 * Stripe retries resume from persisted capture/refund evidence, not from browser state. */
export async function processRxStripeWebhook(db: PrismaClient, body: string, signature: string, config: Config,
  eventType: string, effects: RxPaymentEffects) {
  if (eventType === "charge.refunded") {
    const result = await acceptRxStripeRefund(db, body, signature, config);
    if (result.status === "REFUND_RECORDED") {
      await effects.reverseAgencyFee(result.agencyFeeReversalInput);
      if (result.internalLedgerReviewRequired) throw new Error("RX_INTERNAL_REFUND_REVIEW_REQUIRED");
    }
    return result.status;
  }
  const result = await acceptRxStripePayment(db, body, signature, config);
  if (result.status === "CAPTURED") {
    // Both persisted workflows must get a chance to run. A fee retry must not hide
    // a paid patient from clinical operations, nor can an email outage lose the fee.
    const outcomes = await Promise.allSettled([
      effects.transferAgencyFee(result.agencyFeeInput),
      effects.paymentCaptured({ captureId: result.captureId, orderId: result.agencyFeeInput.orderId })
    ]);
    const failure = outcomes.find(outcome => outcome.status === "rejected");
    if (failure?.status === "rejected") throw failure.reason;
  }
  return result.status;
}
