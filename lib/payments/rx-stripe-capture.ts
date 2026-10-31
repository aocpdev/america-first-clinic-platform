import Stripe from "stripe";
import type { PrismaClient, Prisma } from "@prisma/client";
import { settleRxCommission } from "../referrals/rx-settlement";
import { assertRxStripeConfiguration, rxCaptureEvidence, rxPaymentContractSchema, RX_PAYMENT_SOURCE } from "./rx-stripe-policy";

/** RX adapter only, behind the webhook-processing release switch. Signature verification
 * is mandatory even for tests. Does not send money or alter the existing agency fee.
 * The route retries settlement failures and dispatches the RX durable agency-fee and
 * clinical workflows separately. Checkout activation remains independently blocked. */
export async function acceptRxStripePayment(db: PrismaClient, rawBody: string, signature: string, config: { mode: "live" | "test"; secretKey?: string; webhookSecret?: string }) {
  assertRxStripeConfiguration(config);
  const event = new Stripe(config.secretKey!).webhooks.constructEvent(rawBody, signature, config.webhookSecret!);
  if (event.livemode !== (config.mode === "live")) throw new Error("RX_PAYMENT_IDENTITY_MISMATCH");
  if (!["payment_intent.succeeded", "checkout.session.completed", "checkout.session.async_payment_succeeded"].includes(event.type)) return { status: "IGNORED" as const };
  const metadata = (event.data.object as Stripe.PaymentIntent | Stripe.Checkout.Session).metadata;
  if (metadata?.source !== RX_PAYMENT_SOURCE) throw new Error("RX_PAYMENT_SOURCE_REQUIRED");
  const identity = rxPaymentContractSchema.pick({ companyId: true, customerId: true, orderId: true }).parse(metadata);
  const recorded = await db.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "Customer" WHERE id=${identity.customerId}::uuid AND "companyId"=${identity.companyId}::uuid FOR UPDATE`;
    const order = await tx.order.findFirst({ where: { id: identity.orderId, companyId: identity.companyId, customerId: identity.customerId, referralSource: RX_PAYMENT_SOURCE, paymentProviderCode: "stripe" } });
    if (!order) throw new Error("RX_ORDER_REQUIRED");
    const contract = rxPaymentContractSchema.parse((order.referralMetadata as Prisma.JsonObject | null)?.rxCheckout);
    if (contract.companyId !== order.companyId || contract.customerId !== order.customerId || contract.orderId !== order.id || contract.totalCents !== order.totalCents || contract.grossMarginCents !== order.grossMarginCents) throw new Error("RX_PAYMENT_CONTRACT_CHANGED");
    const proof = rxCaptureEvidence(event, contract);
    if (!proof) return null;
    const snapshot = await tx.rxOrderCommission.findUnique({ where: { orderId: order.id } });
    if (!snapshot || snapshot.companyId !== order.companyId || snapshot.customerId !== order.customerId) throw new Error("RX_COMMISSION_SNAPSHOT_REQUIRED");
    const captures = await tx.paymentTransaction.findMany({ where: { orderId: order.id, companyId: order.companyId, status: "CAPTURED" }, take: 2 });
    const existing = captures[0];
    if (captures.length > 1 || existing && (existing.providerCode !== "stripe" || existing.providerTransactionId !== proof.paymentIntentId || existing.amountCents !== proof.amountCents)) throw new Error("RX_CAPTURE_RECONCILIATION_REQUIRED");
    if (existing) return { captureId: existing.id, proof, newlyCaptured: false, refunded: order.paymentStatus === "REFUNDED" ||
      await tx.paymentTransaction.count({ where: { companyId: order.companyId, orderId: order.id, status: "REFUNDED", amountCents: { gt: 0 } } }) > 0 };
    if (order.paymentStatus !== "PENDING" || snapshot.status !== "AWAITING_PAYMENT") throw new Error("RX_CAPTURE_RECONCILIATION_REQUIRED");
    const capture = await tx.paymentTransaction.create({ data: { companyId: order.companyId, orderId: order.id, providerCode: "stripe", providerTransactionId: proof.paymentIntentId, amountCents: proof.amountCents, status: "CAPTURED", eventType: proof.eventType, rawEvent: { eventId: proof.eventId, livemode: event.livemode, currency: contract.currency, source: RX_PAYMENT_SOURCE } } });
    await tx.order.update({ where: { id: order.id }, data: { paymentStatus: "CAPTURED", orderStatus: "PROCESSING", orderPipelineStage: "NEW_SALE", orderPipelineUpdatedAt: new Date(), commissionStatus: "PENDING" } });
    await tx.customer.update({ where: { id: order.customerId }, data: { lifetimeValueCents: { increment: order.totalCents }, lastPurchaseAt: new Date(), pipelineStage: "NEW_SALE", pipelineUpdatedAt: new Date() } });
    return { captureId: capture.id, proof, newlyCaptured: true, refunded: false };
  });
  if (!recorded) return { status: "AWAITING_PAYMENT" as const };
  if (recorded.refunded) return { status: "ALREADY_REFUNDED" as const };
  // Payment evidence survives a commission-review failure. A webhook retry can resume
  // settlement without repeating the charge, LTV increment or order state transitions.
  const commission = await settleRxCommission(db, { companyId: identity.companyId, orderId: identity.orderId, captureId: recorded.captureId });
  return { status: "CAPTURED" as const, newlyCaptured: recorded.newlyCaptured, commissionStatus: commission.status, captureId: recorded.captureId,
    agencyFeeInput: { orderId: identity.orderId, paymentIntentId: recorded.proof.paymentIntentId, livemode: config.mode === "live", metadataMode: config.mode } };
}
