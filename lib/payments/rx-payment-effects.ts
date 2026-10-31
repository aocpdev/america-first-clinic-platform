import { createHmac } from "node:crypto";
import type { Prisma, PrismaClient } from "@prisma/client";
import { companyAdminUserIds, moneyFromCents, notifyUsers, orderRecipientUserIds, personDisplayName } from "../notifications";
import { phoneForWebhook } from "../phone";
import { RX_PAYMENT_SOURCE } from "./rx-stripe-policy";

/** Prepare the existing clinical/receipt events and in-app notifications atomically.
 * The persisted manifest makes retries reuse delivery IDs (including receiver dedupe).
 * Delivery is at-least-once: receivers must honor x-afc-delivery, never assume exactly-once. */
export async function dispatchRxPaymentCaptured(db: PrismaClient, input: { orderId: string; captureId: string },
  transport: typeof fetch = fetch) {
  const scope = await db.order.findUniqueOrThrow({ where: { id: input.orderId }, select: { customerId: true, companyId: true } });
  const deliveryIds = await db.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "Customer" WHERE id=${scope.customerId}::uuid AND "companyId"=${scope.companyId}::uuid FOR UPDATE`;
    const order = await tx.order.findUniqueOrThrow({ where: { id: input.orderId }, include: {
      customer: true, consultantProfile: { include: { partnerProfile: true, managerProfile: true, groupLeaderProfile: { include: { managerProfile: true } } } },
      partnerProfile: true, managerProfile: true, groupLeaderProfile: { include: { managerProfile: true } }
    } });
    const capture = await tx.paymentTransaction.findFirst({ where: { id: input.captureId, orderId: order.id, companyId: order.companyId,
      status: "CAPTURED", providerCode: "stripe", amountCents: order.totalCents } });
    if (!capture || order.referralSource !== RX_PAYMENT_SOURCE) throw new Error("RX_CLINICAL_CAPTURE_REQUIRED");
    const metadata = order.referralMetadata as Prisma.JsonObject;
    const existing = metadata.rxPaymentEffects as Prisma.JsonObject | undefined;
    if (existing) {
      if (existing.captureId !== capture.id || !Array.isArray(existing.deliveryIds) || existing.deliveryIds.some(id => typeof id !== "string")) throw new Error("RX_CLINICAL_RECONCILIATION_REQUIRED");
      return existing.deliveryIds as string[];
    }
    if (order.paymentStatus === "REFUNDED") return [];
    const customerName = personDisplayName(order.customer);
    const adminIds = await companyAdminUserIds(tx, order.companyId);
    await notifyUsers(tx, [
      ...adminIds.map(userId => ({ userId, title: "New sale ready for Exam",
        body: `${customerName} paid ${moneyFromCents(order.totalCents)}. Start the Exam workflow.`,
        metadata: { type: "order_payment", orderId: order.id, customerId: order.customerId, stage: "NEW_SALE", amountCents: order.totalCents } })),
      ...orderRecipientUserIds(order).map(userId => ({ userId, title: "Payment received", body: `${customerName}'s order is paid and now pending clinical review.`,
        metadata: { type: "order_payment", orderId: order.id, customerId: order.customerId, stage: "NEW_SALE", amountCents: order.totalCents } }))
    ]);
    const payload = { provider: "stripe", providerTransactionId: capture.providerTransactionId, orderId: order.id,
      customerId: order.customerId, customerEmail: order.customer.email, customerPhone: phoneForWebhook(order.customer.phone),
      customerName, amountCents: order.totalCents, currency: "USD", receiptUrl: `https://rx.govirtualhealth.com/account/orders/${order.id}` };
    const partnerProfileId = order.partnerProfileId ?? order.consultantProfile?.partnerProfileId;
    const endpoints = await tx.webhookEndpoint.findMany({ where: { companyId: order.companyId, isActive: true,
      events: { hasSome: ["payment.succeeded", "receipt.ready"] }, OR: [{ partnerProfileId: null }, ...(partnerProfileId ? [{ partnerProfileId }] : [])] } });
    const ids: string[] = [];
    for (const endpoint of endpoints) for (const eventType of ["payment.succeeded", "receipt.ready"]) {
      if (!endpoint.events.includes(eventType)) continue;
      const delivery = await tx.webhookDelivery.create({ data: { companyId: order.companyId, endpointId: endpoint.id, eventType, payload } });
      ids.push(delivery.id);
    }
    await tx.order.update({ where: { id: order.id }, data: { referralMetadata: { ...metadata, rxPaymentEffects: { captureId: capture.id, deliveryIds: ids } } } });
    return ids;
  });
  for (const id of deliveryIds) {
    const delivery = await db.webhookDelivery.findFirstOrThrow({ where: { id, companyId: scope.companyId }, include: { endpoint: true } });
    if (delivery.status === "DELIVERED") continue;
    if (!delivery.endpoint.isActive || delivery.endpoint.companyId !== scope.companyId) throw new Error("RX_CLINICAL_ENDPOINT_REVIEW_REQUIRED");
    const body = JSON.stringify({ id: delivery.id, event: delivery.eventType, createdAt: delivery.createdAt.toISOString(), data: delivery.payload });
    let ok = false;
    let result = "delivery_failed";
    try {
      const response = await transport(delivery.endpoint.url, { method: "POST", redirect: "error", signal: AbortSignal.timeout(10000),
        headers: { "content-type": "application/json", "x-afc-event": delivery.eventType, "x-afc-delivery": delivery.id,
          "x-afc-signature": createHmac("sha256", delivery.endpoint.secret).update(body).digest("hex") }, body });
      ok = response.ok; result = `HTTP ${response.status}`;
    } catch { /* Do not persist response bodies, secrets, or sensitive request details. */ }
    await db.webhookDelivery.updateMany({ where: { id, status: { not: "DELIVERED" } }, data: {
      status: ok ? "DELIVERED" : "FAILED", attempts: { increment: 1 }, lastResponse: result,
      deliveredAt: ok ? new Date() : null, nextRetryAt: ok ? null : new Date(Date.now() + 600000)
    } });
    if (!ok) throw new Error("RX_CLINICAL_DELIVERY_RETRY_REQUIRED");
  }
}
