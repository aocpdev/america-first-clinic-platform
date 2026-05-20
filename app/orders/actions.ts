"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db/prisma";
import { phoneForWebhook } from "@/lib/phone";
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
