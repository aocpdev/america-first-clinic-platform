import Stripe from "stripe";
import type { PrismaClient, Prisma } from "@prisma/client";
import { assertRxStripeConfiguration, rxPaymentContractSchema, RX_PAYMENT_SOURCE } from "./rx-stripe-policy";

/** RX refund recorder, behind the webhook-processing release switch. No Stripe API calls.
 * Internal-ledger recovery still requires review and blocks public checkout activation.
 * charge.refunded supplies a cumulative amount: persist only its positive delta. */
export async function acceptRxStripeRefund(db: PrismaClient, rawBody: string, signature: string,
  config: { mode: "live" | "test"; secretKey?: string; webhookSecret?: string }) {
  assertRxStripeConfiguration(config);
  const event = new Stripe(config.secretKey!).webhooks.constructEvent(rawBody, signature, config.webhookSecret!);
  if (event.livemode !== (config.mode === "live")) throw new Error("RX_PAYMENT_IDENTITY_MISMATCH");
  if (event.type !== "charge.refunded") return { status: "IGNORED" as const };
  const charge = event.data.object as Stripe.Charge;
  if (charge.metadata?.source !== RX_PAYMENT_SOURCE) throw new Error("RX_PAYMENT_SOURCE_REQUIRED");
  const identity = rxPaymentContractSchema.pick({ companyId: true, customerId: true, orderId: true }).parse(charge.metadata);
  return db.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "Customer" WHERE id=${identity.customerId}::uuid AND "companyId"=${identity.companyId}::uuid FOR UPDATE`;
    const order = await tx.order.findFirst({ where: { id: identity.orderId, companyId: identity.companyId,
      customerId: identity.customerId, referralSource: RX_PAYMENT_SOURCE, paymentProviderCode: "stripe" } });
    if (!order) throw new Error("RX_ORDER_REQUIRED");
    const contract = rxPaymentContractSchema.parse((order.referralMetadata as Prisma.JsonObject | null)?.rxCheckout);
    if (contract.companyId !== identity.companyId || contract.customerId !== identity.customerId || contract.orderId !== identity.orderId ||
      contract.totalCents !== order.totalCents || contract.grossMarginCents !== order.grossMarginCents) throw new Error("RX_PAYMENT_CONTRACT_CHANGED");
    const intentId = typeof charge.payment_intent === "string" ? charge.payment_intent : charge.payment_intent?.id;
    if (charge.object !== "charge" || !charge.id.startsWith("ch_") || !intentId?.startsWith("pi_") ||
      charge.livemode !== event.livemode || contract.mode !== config.mode || charge.metadata.stripeMode !== contract.mode ||
      charge.currency !== contract.currency || charge.amount !== contract.totalCents || !charge.paid || !charge.captured ||
      !Number.isSafeInteger(charge.amount_refunded) || charge.amount_refunded <= 0 || charge.amount_refunded > contract.totalCents) {
      throw new Error("RX_REFUND_EVIDENCE_MISMATCH");
    }
    const captures = await tx.paymentTransaction.findMany({ where: { companyId: identity.companyId, orderId: order.id, status: "CAPTURED" }, take: 2 });
    const snapshot = await tx.rxOrderCommission.findUnique({ where: { orderId: order.id } });
    if (captures.length !== 1 || captures[0].providerCode !== "stripe" || captures[0].providerTransactionId !== intentId ||
      captures[0].amountCents !== order.totalCents || !["CAPTURED", "REFUNDED"].includes(order.paymentStatus) ||
      !snapshot || snapshot.companyId !== identity.companyId || snapshot.customerId !== identity.customerId) {
      throw new Error("RX_REFUND_RECONCILIATION_REQUIRED");
    }
    const refunds = await tx.paymentTransaction.findMany({ where: { companyId: identity.companyId, orderId: order.id, status: "REFUNDED" } });
    // A legacy/foreign refund must be reviewed instead of mixed into this delta ledger.
    if (refunds.some(row => row.providerCode !== "stripe" || row.providerTransactionId !== charge.id || row.eventType !== "rx.charge.refunded.delta")) {
      throw new Error("RX_REFUND_RECONCILIATION_REQUIRED");
    }
    const prior = refunds.reduce((total, row) => total + row.amountCents, 0);
    if (!Number.isSafeInteger(prior) || prior < 0 || prior > order.totalCents) throw new Error("RX_REFUND_RECONCILIATION_REQUIRED");
    const cumulative = Math.max(prior, charge.amount_refunded);
    const delta = cumulative - prior;
    if (delta > 0) {
      await tx.paymentTransaction.create({ data: { companyId: identity.companyId, orderId: order.id, providerCode: "stripe",
        providerTransactionId: charge.id, amountCents: delta, status: "REFUNDED", eventType: "rx.charge.refunded.delta",
        rawEvent: { eventId: event.id, source: RX_PAYMENT_SOURCE, livemode: event.livemode, cumulativeAmountCents: cumulative } } });
    }
    const commissionStatus = snapshot.sellerRole === "DIRECT" ? "NOT_PAYABLE" : ["PAID", "RECOVERY_REQUIRED"].includes(snapshot.status) ? "RECOVERY_REQUIRED" : "ON_HOLD";
    await tx.rxOrderCommission.update({ where: { orderId: order.id }, data: { status: commissionStatus } });
    // Do not rewrite paid internal splits or fulfilled/shipped state on a partial refund.
    if (cumulative === order.totalCents && order.paymentStatus !== "REFUNDED") {
      await tx.order.update({ where: { id: order.id }, data: { paymentStatus: "REFUNDED", orderStatus: "REFUNDED",
        orderPipelineStage: "DEFERRED", orderPipelineUpdatedAt: new Date(), commissionStatus: "REJECTED" } });
    }
    return { status: "REFUND_RECORDED" as const, newlyRefundedCents: delta, cumulativeRefundedCents: cumulative,
      commissionStatus, internalLedgerReviewRequired: !["AFFILIATE", "DIRECT"].includes(snapshot.sellerRole),
      // Returned on replays too: an interrupted dispatcher must be able to resume reversal.
      agencyFeeReversalInput: { orderId: order.id, refundedAmountCents: cumulative, livemode: event.livemode, metadataMode: config.mode } };
  });
}
