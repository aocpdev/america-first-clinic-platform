"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db/prisma";
import { getPaymentProvider } from "@/lib/payments/registry";
import type { PaymentProviderCode } from "@/lib/payments/types";
import { phoneForWebhook } from "@/lib/phone";
import { isOrderPipelineStage, orderPipelineLabel } from "@/lib/sales/pipeline";
import { dispatchWebhookEvent } from "@/lib/webhooks/dispatch";

function appUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
}

function personName(person: { firstName: string | null; lastName: string | null; email?: string }) {
  return [person.firstName, person.lastName].filter(Boolean).join(" ").trim() || person.email || "Customer";
}

function returnPathForRole(role: string, orderId: string) {
  if (role === "CONSULTANT") return `/consultant/orders/${orderId}`;
  if (role === "PARTNER" || role === "GROUP_LEADER") return `/partner/orders/${orderId}`;
  return `/admin/orders/${orderId}`;
}

function jsonSafe(value: unknown) {
  return JSON.parse(JSON.stringify(value));
}

function canManageClinicalPipeline(role: string) {
  return role === "SUPER_ADMIN" || role === "COMPANY_ADMIN";
}

async function ensureOrderAccess(user: Awaited<ReturnType<typeof requireUser>>, orderId: string) {
  if (!user.companyId) return null;

  return prisma.order.findFirst({
    where: {
      id: orderId,
      companyId: user.companyId,
      ...(user.role === "CONSULTANT"
        ? { consultantProfileId: user.consultantProfile?.id ?? "__no_access__" }
        : user.role === "PARTNER"
          ? {
              OR: [
                { partnerProfileId: user.partnerProfile?.id ?? "__no_access__" },
                { consultantProfile: { partnerProfileId: user.partnerProfile?.id ?? "__no_access__" } }
              ]
            }
          : user.role === "GROUP_LEADER"
            ? {
                OR: [
                  { groupLeaderProfileId: user.groupLeaderProfile?.id ?? "__no_access__" },
                  { consultantProfile: { groupLeaderProfileId: user.groupLeaderProfile?.id ?? "__no_access__" } }
                ]
              }
            : {})
    },
    include: {
      customer: true,
      consultantProfile: true,
      paymentTransactions: {
        where: { status: "CAPTURED", providerTransactionId: { not: null } },
        orderBy: { createdAt: "desc" },
        take: 1
      }
    }
  });
}

export async function updateOrderPipelineStage(formData: FormData) {
  const user = await requireUser();
  const orderId = String(formData.get("orderId") || "");
  const requestedStage = String(formData.get("orderPipelineStage") || "");
  const returnPath = returnPathForRole(user.role, orderId);

  if (!orderId || !isOrderPipelineStage(requestedStage) || !canManageClinicalPipeline(user.role)) {
    redirect(`${returnPath}?stage=not_allowed`);
  }

  const order = await ensureOrderAccess(user, orderId);
  if (!order) {
    redirect(`${returnPath}?stage=not_found`);
  }

  const now = new Date();
  const prescriptionDocumentUrl = String(formData.get("prescriptionDocumentUrl") || "").trim();
  const prescriptionNotes = String(formData.get("prescriptionNotes") || "").trim();
  const nextData: {
    orderPipelineStage: string;
    orderPipelineUpdatedAt: Date;
    orderStatus?: "PENDING" | "PROCESSING" | "COMPLETED" | "CANCELLED" | "REFUNDED";
    paymentStatus?: "PENDING" | "AUTHORIZED" | "CAPTURED" | "FAILED" | "REFUNDED";
    commissionStatus?: "PENDING" | "APPROVED" | "REJECTED" | "PAID";
    prescriptionDocumentUrl?: string | null;
    prescriptionNotes?: string | null;
    prescriptionStoredAt?: Date | null;
    prescriptionStoredByUserId?: string | null;
  } = {
    orderPipelineStage: requestedStage,
    orderPipelineUpdatedAt: now
  };

  if (requestedStage === "NEW_SALE") {
    nextData.orderStatus = "PENDING";
  }

  if (requestedStage === "GFE" || requestedStage === "APPROVAL" || requestedStage === "FULFILLMENT") {
    nextData.orderStatus = "PROCESSING";
  }

  if (requestedStage === "APPROVAL" && (prescriptionDocumentUrl || prescriptionNotes)) {
    nextData.prescriptionDocumentUrl = prescriptionDocumentUrl || null;
    nextData.prescriptionNotes = prescriptionNotes || null;
    nextData.prescriptionStoredAt = now;
    nextData.prescriptionStoredByUserId = user.id;
  }

  if (requestedStage === "SHIPPED") {
    nextData.orderStatus = "COMPLETED";
    if (order.paymentStatus === "CAPTURED") {
      nextData.commissionStatus = "APPROVED";
    }
  }

  if (requestedStage === "DEFERRED") {
    const confirmation = String(formData.get("refundConfirmation") || "").trim().toLowerCase();
    if (order.paymentStatus === "CAPTURED" && confirmation !== "refunded") {
      redirect(`${returnPath}?stage=refund_confirmation_required`);
    }

    nextData.orderStatus = "REFUNDED";
    nextData.paymentStatus = order.paymentStatus === "CAPTURED" ? "REFUNDED" : order.paymentStatus;
    nextData.commissionStatus = "REJECTED";

    if (order.paymentStatus === "CAPTURED") {
      const transaction = order.paymentTransactions[0];
      if (!transaction?.providerTransactionId) {
        redirect(`${returnPath}?stage=refund_transaction_missing`);
      }

      const refund = await getPaymentProvider(order.paymentProviderCode as PaymentProviderCode).refundPayment({
        companyId: order.companyId,
        transactionId: transaction.providerTransactionId,
        amount: { amount: order.totalCents, currency: "USD" },
        reason: "requested_by_customer"
      });

      await prisma.paymentTransaction.create({
        data: {
          companyId: order.companyId,
          orderId: order.id,
          providerCode: order.paymentProviderCode,
          providerTransactionId: refund.providerTransactionId,
          amountCents: order.totalCents,
          status: "REFUNDED",
          eventType: "order.deferred_refund",
          rawEvent: jsonSafe(refund.raw ?? refund)
        }
      });
    }
  }

  await prisma.$transaction([
    prisma.order.update({
      where: { id: order.id },
      data: nextData
    }),
    prisma.customer.update({
      where: { id: order.customerId },
      data: {
        pipelineStage: requestedStage,
        pipelineUpdatedAt: now
      }
    }),
    ...(requestedStage === "SHIPPED" && order.paymentStatus === "CAPTURED"
      ? [
          prisma.commission.updateMany({
            where: { orderId: order.id },
            data: { status: "APPROVED", approvedAt: now }
          }),
          prisma.commissionSplit.updateMany({
            where: { orderId: order.id },
            data: { status: "APPROVED" }
          })
        ]
      : []),
    ...(requestedStage === "DEFERRED"
      ? [
          prisma.commission.updateMany({
            where: { orderId: order.id },
            data: { status: "REJECTED" }
          }),
          prisma.commissionSplit.updateMany({
            where: { orderId: order.id },
            data: { status: "REJECTED" }
          })
        ]
      : []),
    prisma.activityLog.create({
      data: {
        companyId: order.companyId,
        userId: user.id,
        customerId: order.customerId,
        action: "ORDER_PIPELINE_UPDATED",
        metadata: {
          orderId: order.id,
          stage: requestedStage,
          label: orderPipelineLabel(requestedStage),
          commissionStatus: requestedStage === "SHIPPED" && order.paymentStatus === "CAPTURED" ? "APPROVED" : nextData.commissionStatus ?? order.commissionStatus
        }
      }
    })
  ]);

  revalidatePath(returnPath);
  revalidatePath("/admin/orders");
  revalidatePath("/partner/orders");
  revalidatePath("/consultant/orders");
  redirect(`${returnPath}?stage=updated`);
}

export async function resendReceiptWebhook(formData: FormData) {
  const user = await requireUser();
  const orderId = String(formData.get("orderId") || "");
  const returnPath = returnPathForRole(user.role, orderId);

  if (!orderId || !user.companyId) {
    redirect(`${returnPath}?receipt=error`);
  }

  const order = await prisma.order.findFirst({
    where: {
      id: orderId,
      companyId: user.companyId,
      paymentStatus: "CAPTURED",
      ...(user.role === "CONSULTANT"
        ? { consultantProfileId: user.consultantProfile?.id ?? "__no_access__" }
        : user.role === "PARTNER"
          ? {
              OR: [
                { partnerProfileId: user.partnerProfile?.id ?? "__no_access__" },
                { consultantProfile: { partnerProfileId: user.partnerProfile?.id ?? "__no_access__" } }
              ]
            }
          : user.role === "GROUP_LEADER"
            ? {
                OR: [
                  { groupLeaderProfileId: user.groupLeaderProfile?.id ?? "__no_access__" },
                  { consultantProfile: { groupLeaderProfileId: user.groupLeaderProfile?.id ?? "__no_access__" } }
                ]
              }
            : {})
    },
    include: {
      customer: true,
      consultantProfile: true,
      items: {
        include: {
          product: { select: { title: true } }
        }
      }
    }
  });

  if (!order) {
    redirect(`${returnPath}?receipt=not_available`);
  }

  const receiptUrl = `${appUrl()}/checkout/success?orderId=${order.id}`;

  await dispatchWebhookEvent({
    companyId: order.companyId,
    partnerProfileId: order.partnerProfileId ?? order.consultantProfile?.partnerProfileId,
    eventType: "receipt.resend_requested",
    payload: {
      orderId: order.id,
      customerId: order.customerId,
      customerName: personName(order.customer),
      customerEmail: order.customer.email,
      customerPhone: phoneForWebhook(order.customer.phone),
      amountCents: order.totalCents,
      currency: "USD",
      receiptUrl,
      items: order.items.map((item) => ({
        productName: item.product.title,
        quantity: item.quantity,
        unitPriceCents: item.unitPriceCents,
        totalCents: item.totalCents
      })),
      source: user.role.toLowerCase()
    }
  });

  await prisma.activityLog.create({
    data: {
      companyId: order.companyId,
      userId: user.id,
      customerId: order.customerId,
      action: "RECEIPT_RESEND_REQUESTED",
      metadata: {
        orderId: order.id,
        receiptUrl
      }
    }
  });

  revalidatePath(returnPath);
  redirect(`${returnPath}?receipt=sent#customer-receipt`);
}
