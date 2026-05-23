"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db/prisma";
import { getPaymentProvider } from "@/lib/payments/registry";
import type { PaymentProviderCode } from "@/lib/payments/types";
import { phoneForWebhook } from "@/lib/phone";
import { isCustomerPipelineStage, isOrderPipelineStage, orderPipelineLabel } from "@/lib/sales/pipeline";
import { dispatchWebhookEvent } from "@/lib/webhooks/dispatch";

function value(formData: FormData, key: string) {
  const entry = formData.get(key);
  return typeof entry === "string" ? entry.trim() : "";
}

function returnPipelinePath(role: string) {
  if (role === "CONSULTANT") return "/consultant/pipeline";
  if (role === "PARTNER" || role === "GROUP_LEADER") return "/partner/pipeline";
  return "/admin/pipeline";
}

function personName(person: { firstName: string | null; lastName: string | null; email?: string }) {
  return [person.firstName, person.lastName].filter(Boolean).join(" ").trim() || person.email || "Customer";
}

function carrierTrackingUrl(carrier: string | null, trackingCode: string | null) {
  if (!carrier || !trackingCode) return null;
  const code = encodeURIComponent(trackingCode);
  if (carrier === "fedex") return `https://www.fedex.com/fedextrack/?trknbr=${code}`;
  if (carrier === "ups") return `https://www.ups.com/track?tracknum=${code}`;
  if (carrier === "usps") return `https://tools.usps.com/go/TrackConfirmAction?tLabels=${code}`;
  if (carrier === "dhl") return `https://www.dhl.com/us-en/home/tracking/tracking-express.html?submit=1&tracking-id=${code}`;
  return null;
}

function jsonSafe(value: unknown) {
  return JSON.parse(JSON.stringify(value));
}

async function accessibleOrder(user: Awaited<ReturnType<typeof requireUser>>, orderId: string) {
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

export async function updateCustomerPipelineStage(formData: FormData) {
  const user = await requireUser();
  const customerId = value(formData, "customerId");
  const stage = value(formData, "pipelineStage");

  if (!customerId || !isCustomerPipelineStage(stage)) {
    redirect("/login?error=invalid_pipeline_update");
  }

  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    include: {
      consultantProfile: {
        select: {
          id: true,
          partnerProfileId: true
        }
      },
      partnerProfile: {
        select: { id: true }
      }
    }
  });

  if (!customer || customer.companyId !== user.companyId) {
    redirect("/login?error=access_denied");
  }

  if (user.role === "CONSULTANT") {
    if (!user.consultantProfile?.id || customer.consultantProfileId !== user.consultantProfile.id) {
      redirect("/login?error=access_denied");
    }
  } else if (user.role === "PARTNER") {
    const partnerProfile = await prisma.partnerProfile.findUnique({ where: { userId: user.id } });
    if (!partnerProfile || (customer.partnerProfileId !== partnerProfile.id && customer.consultantProfile?.partnerProfileId !== partnerProfile.id)) {
      redirect("/login?error=access_denied");
    }
  } else if (user.role !== "COMPANY_ADMIN" && user.role !== "SUPER_ADMIN") {
    redirect("/login?error=access_denied");
  }

  await prisma.customer.update({
    where: { id: customer.id },
    data: {
      pipelineStage: stage,
      pipelineUpdatedAt: new Date()
    }
  });

  await prisma.activityLog.create({
    data: {
      companyId: customer.companyId,
      userId: user.id,
      customerId: customer.id,
      action: "CUSTOMER_PIPELINE_STAGE_UPDATED",
      metadata: {
        pipelineStage: stage
      }
    }
  });

  revalidatePath("/consultant/pipeline");
  revalidatePath("/partner/pipeline");
  revalidatePath("/admin/pipeline");
  revalidatePath("/admin/customers");
}

export async function updateOrderOpportunityDetails(formData: FormData) {
  const user = await requireUser();
  const orderId = value(formData, "orderId");
  const returnPath = returnPipelinePath(user.role);
  const order = orderId ? await accessibleOrder(user, orderId) : null;

  if (!order) {
    redirect(`${returnPath}?opportunity=not_found`);
  }

  const canManageInternalDocs = user.role === "COMPANY_ADMIN" || user.role === "SUPER_ADMIN";
  const orderNotes = value(formData, "orderNotes");
  const rxDocumentUrl = value(formData, "rxDocumentUrl");
  const rxNotes = value(formData, "rxNotes");
  const gfeDocumentUrl = value(formData, "gfeDocumentUrl");
  const gfeNotes = value(formData, "gfeNotes");
  const now = new Date();

  await prisma.order.update({
    where: { id: order.id },
    data: {
      orderNotes: orderNotes || null,
      ...(canManageInternalDocs
        ? {
            rxDocumentUrl: rxDocumentUrl || null,
            rxNotes: rxNotes || null,
            rxStoredAt: rxDocumentUrl ? now : null,
            gfeDocumentUrl: gfeDocumentUrl || null,
            gfeNotes: gfeNotes || null,
            gfeStoredAt: gfeDocumentUrl ? now : null
          }
        : {})
    }
  });

  await prisma.activityLog.create({
    data: {
      companyId: order.companyId,
      userId: user.id,
      customerId: order.customerId,
      action: "ORDER_OPPORTUNITY_UPDATED",
      metadata: { orderId: order.id, updatedDocs: canManageInternalDocs }
    }
  });

  revalidatePath("/admin/pipeline");
  revalidatePath("/partner/pipeline");
  revalidatePath("/consultant/pipeline");
  redirect(`${returnPath}?opportunity=updated`);
}

export async function updatePipelineOrderStage(formData: FormData) {
  const user = await requireUser();
  const orderId = value(formData, "orderId");
  const requestedStage = value(formData, "orderPipelineStage");
  const returnPath = returnPipelinePath(user.role);

  if (!orderId || !isOrderPipelineStage(requestedStage) || (user.role !== "COMPANY_ADMIN" && user.role !== "SUPER_ADMIN")) {
    redirect(`${returnPath}?stage=not_allowed`);
  }

  const order = await accessibleOrder(user, orderId);
  if (!order) {
    redirect(`${returnPath}?stage=not_found`);
  }

  const shippingCarrier = value(formData, "shippingCarrier");
  const shippingTrackingCode = value(formData, "shippingTrackingCode");
  const allowWithoutTracking = value(formData, "allowFulfillmentWithoutTracking") === "true";
  const now = new Date();

  if ((requestedStage === "FULFILLMENT" || requestedStage === "SHIPPED") && !shippingTrackingCode && !order.shippingTrackingCode && !allowWithoutTracking) {
    redirect(`${returnPath}?stage=tracking_required`);
  }

  const nextCarrier = shippingCarrier || order.shippingCarrier;
  const nextTrackingCode = shippingTrackingCode || order.shippingTrackingCode;

  const nextPaymentStatus = requestedStage === "DEFERRED" && order.paymentStatus === "CAPTURED" ? "REFUNDED" : order.paymentStatus;

  if (requestedStage === "DEFERRED" && order.paymentStatus === "CAPTURED") {
    const confirmation = value(formData, "refundConfirmation").toLowerCase();
    if (confirmation !== "refunded") {
      redirect(`${returnPath}?stage=refund_confirmation_required`);
    }

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

  await prisma.$transaction([
    prisma.order.update({
      where: { id: order.id },
      data: {
        orderPipelineStage: requestedStage,
        orderPipelineUpdatedAt: now,
        orderStatus:
          requestedStage === "SHIPPED"
            ? "COMPLETED"
            : requestedStage === "DEFERRED"
              ? "REFUNDED"
              : requestedStage === "AWAITING_PAYMENT"
                ? "PENDING"
                : "PROCESSING",
        paymentStatus: nextPaymentStatus,
        ...(nextTrackingCode
          ? {
              shippingCarrier: nextCarrier || "other",
              shippingTrackingCode: nextTrackingCode,
              shippedAt: requestedStage === "SHIPPED" ? now : order.shippedAt
            }
          : {}),
        ...(requestedStage === "SHIPPED" && order.paymentStatus === "CAPTURED"
          ? { commissionStatus: "APPROVED" }
          : {}),
        ...(requestedStage === "DEFERRED"
          ? { commissionStatus: "REJECTED" }
          : {})
      }
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
          trackingCode: nextTrackingCode,
          carrier: nextCarrier
        }
      }
    })
  ]);

  if (nextTrackingCode && (requestedStage === "FULFILLMENT" || requestedStage === "SHIPPED")) {
    await dispatchWebhookEvent({
      companyId: order.companyId,
      partnerProfileId: order.partnerProfileId ?? order.consultantProfile?.partnerProfileId,
      eventType: "shipment.tracking_ready",
      payload: {
        orderId: order.id,
        customerId: order.customerId,
        customerName: personName(order.customer),
        customerEmail: order.customer.email,
        customerPhone: phoneForWebhook(order.customer.phone),
        stage: requestedStage,
        carrier: nextCarrier,
        trackingCode: nextTrackingCode,
        trackingUrl: carrierTrackingUrl(nextCarrier, nextTrackingCode)
      }
    });
  }

  revalidatePath("/admin/pipeline");
  revalidatePath("/partner/pipeline");
  revalidatePath("/consultant/pipeline");
  revalidatePath("/admin/orders");
  redirect(`${returnPath}?stage=updated`);
}

export async function deleteUnpaidOrder(formData: FormData) {
  const user = await requireUser();
  const orderId = value(formData, "orderId");
  const returnPath = returnPipelinePath(user.role);
  const order = orderId ? await accessibleOrder(user, orderId) : null;

  if (!order) {
    redirect(`${returnPath}?delete=not_found`);
  }

  if (order.paymentStatus !== "PENDING") {
    redirect(`${returnPath}?delete=payment_collected`);
  }

  const canDelete =
    user.role === "COMPANY_ADMIN" ||
    user.role === "SUPER_ADMIN" ||
    (user.role === "PARTNER" && Boolean(user.partnerProfile?.id)) ||
    (user.role === "GROUP_LEADER" && Boolean(user.groupLeaderProfile?.id)) ||
    (user.role === "CONSULTANT" && order.consultantProfileId === user.consultantProfile?.id);

  if (!canDelete) {
    redirect(`${returnPath}?delete=not_allowed`);
  }

  await prisma.$transaction([
    prisma.commissionSplit.deleteMany({ where: { orderId: order.id } }),
    prisma.commission.deleteMany({ where: { orderId: order.id } }),
    prisma.paymentTransaction.deleteMany({ where: { orderId: order.id } }),
    prisma.orderItem.deleteMany({ where: { orderId: order.id } }),
    prisma.order.delete({ where: { id: order.id } }),
    prisma.activityLog.create({
      data: {
        companyId: order.companyId,
        userId: user.id,
        customerId: order.customerId,
        action: "UNPAID_ORDER_DELETED",
        metadata: { orderId: order.id }
      }
    })
  ]);

  revalidatePath("/admin/pipeline");
  revalidatePath("/partner/pipeline");
  revalidatePath("/consultant/pipeline");
  revalidatePath("/admin/orders");
  redirect(`${returnPath}?delete=deleted`);
}
