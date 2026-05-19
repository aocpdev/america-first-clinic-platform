"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireApprovedConsultant, requirePartner, requireRole } from "@/lib/auth/current-user";
import { createMarginCommissionLedger } from "@/lib/commissions/margin-split";
import { prisma } from "@/lib/db/prisma";
import { getPaymentProvider } from "@/lib/payments/registry";
import type { PaymentProviderCode } from "@/lib/payments/types";
import { isCustomerPipelineStage } from "@/lib/sales/pipeline";
import { dispatchWebhookEvent } from "@/lib/webhooks/dispatch";

const newCustomerSchema = z.object({
  firstName: z.string().trim().min(1),
  lastName: z.string().trim().optional(),
  email: z.string().trim().email(),
  phone: z.string().trim().optional()
});

const shippingAddressSchema = z.object({
  line1: z.string().trim().min(1),
  line2: z.string().trim().optional(),
  city: z.string().trim().min(1),
  state: z.string().trim().min(1),
  postalCode: z.string().trim().min(1),
  country: z.string().trim().min(1).default("US")
});

function formString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function selectedProductQuantities(formData: FormData) {
  const items = Array.from(formData.entries())
    .filter(([key]) => key.startsWith("quantity:"))
    .map(([key, value]) => ({
      productId: key.replace("quantity:", ""),
      quantity: Number(value)
    }))
    .filter((item) => item.productId && Number.isInteger(item.quantity) && item.quantity > 0);

  const merged = new Map<string, number>();
  for (const item of items) {
    merged.set(item.productId, (merged.get(item.productId) ?? 0) + item.quantity);
  }

  return Array.from(merged.entries()).map(([productId, quantity]) => ({ productId, quantity }));
}

function paymentWorkflowFromForm(formData: FormData) {
  const workflow = formString(formData, "paymentWorkflow");
  return workflow === "send_invoice" ? "send_invoice" : "collect_payment";
}

function orderPaymentUrl(orderId: string, providerCode: PaymentProviderCode) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  return `${appUrl.replace(/\/$/, "")}/checkout?orderId=${orderId}&provider=${providerCode}`;
}

function orderDetailPath(workspace: "consultant" | "partner" | "group_leader" | "admin", orderId: string) {
  if (workspace === "admin") return `/admin/orders/${orderId}`;
  if (workspace === "consultant") return `/consultant/orders/${orderId}`;
  return `/partner/orders/${orderId}`;
}

async function activePaymentProviderCode(companyId: string): Promise<PaymentProviderCode> {
  const provider = await prisma.paymentProvider.findFirst({
    where: {
      companyId,
      isDefault: true,
      active: true
    },
    select: { code: true }
  });

  if (provider?.code === "stripe" || provider?.code === "authorize_net" || provider?.code === "nmi" || provider?.code === "ach") {
    return provider.code;
  }

  return "stripe";
}

async function queueInvoiceWebhook(input: {
  companyId: string;
  actorUserId: string;
  customer: { id: string; email: string; firstName: string | null; lastName: string | null; phone: string | null };
  orderId: string;
  totalCents: number;
  invoiceUrl: string;
  providerCode: PaymentProviderCode;
  providerSessionId?: string | null;
  partnerProfileId?: string | null;
  workspace: string;
  shippingAddress: z.infer<typeof shippingAddressSchema>;
}) {
  const webhookUrl = process.env.GHL_INVOICE_WEBHOOK_URL;

  await prisma.activityLog.create({
    data: {
      companyId: input.companyId,
      userId: input.actorUserId,
      customerId: input.customer.id,
      action: webhookUrl ? "INVOICE_WEBHOOK_QUEUED" : "INVOICE_WEBHOOK_NOT_CONFIGURED",
      metadata: {
        orderId: input.orderId,
        invoiceUrl: input.invoiceUrl,
        totalCents: input.totalCents,
        provider: input.providerCode,
        providerSessionId: input.providerSessionId,
        workflow: "send_invoice",
        destination: "gohighlevel",
        shippingAddress: input.shippingAddress
      }
    }
  });

  await dispatchWebhookEvent({
    companyId: input.companyId,
    partnerProfileId: input.partnerProfileId,
    eventType: "invoice.requested",
    payload: {
      provider: input.providerCode,
      providerSessionId: input.providerSessionId,
      orderId: input.orderId,
      customerId: input.customer.id,
      customerEmail: input.customer.email,
      customerPhone: input.customer.phone,
      customerName: [input.customer.firstName, input.customer.lastName].filter(Boolean).join(" ").trim() || input.customer.email,
      amountCents: input.totalCents,
      currency: "USD",
      invoiceUrl: input.invoiceUrl,
      shippingAddress: input.shippingAddress,
      source: input.workspace
    }
  });

  if (!webhookUrl) {
    return;
  }

  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        event: "invoice.requested",
        provider: input.providerCode,
        providerSessionId: input.providerSessionId,
        orderId: input.orderId,
        customerId: input.customer.id,
        customerEmail: input.customer.email,
        customerPhone: input.customer.phone,
        customerName: [input.customer.firstName, input.customer.lastName].filter(Boolean).join(" ").trim() || input.customer.email,
        amountCents: input.totalCents,
        currency: "USD",
        invoiceUrl: input.invoiceUrl,
        shippingAddress: input.shippingAddress,
        source: input.workspace
      })
    });
  } catch (error) {
    await prisma.activityLog.create({
      data: {
        companyId: input.companyId,
        userId: input.actorUserId,
        customerId: input.customer.id,
        action: "INVOICE_WEBHOOK_FAILED",
        metadata: {
          orderId: input.orderId,
          invoiceUrl: input.invoiceUrl,
          error: error instanceof Error ? error.message : "unknown_error"
        }
      }
    });
  }
}

async function createWorkspaceOrder(
  formData: FormData,
  context: {
    workspace: "consultant" | "partner" | "group_leader" | "admin";
    companyId: string;
    actorUserId: string;
    consultantProfileId?: string | null;
    partnerProfileId?: string | null;
    groupLeaderProfileId?: string | null;
    redirectBasePath: string;
  }
) {
  const { workspace, companyId, actorUserId, consultantProfileId = null, partnerProfileId = null, groupLeaderProfileId = null, redirectBasePath } = context;
  const customerMode = formString(formData, "customerMode") || "existing";
  const pipelineStageInput = formString(formData, "pipelineStage");
  const pipelineStage = isCustomerPipelineStage(pipelineStageInput) ? pipelineStageInput : "CART_BUILT";
  const notes = formString(formData, "notes");
  const paymentWorkflow = paymentWorkflowFromForm(formData);
  const shippingAddress = shippingAddressSchema.safeParse({
    line1: formData.get("shippingAddressLine1"),
    line2: formData.get("shippingAddressLine2"),
    city: formData.get("shippingCity"),
    state: formData.get("shippingState"),
    postalCode: formData.get("shippingPostalCode"),
    country: formData.get("shippingCountry") || "US"
  });
  const selectedItems = selectedProductQuantities(formData);
  const providerCode = await activePaymentProviderCode(companyId);

  if (!shippingAddress.success) {
    redirect(`${redirectBasePath}?error=invalid_shipping_address`);
  }

  if (selectedItems.length === 0) {
    redirect(`${redirectBasePath}?error=empty_order`);
  }

  let customerId = formString(formData, "customerId");

  if (customerMode === "new") {
    const parsed = newCustomerSchema.safeParse({
      firstName: formData.get("firstName"),
      lastName: formData.get("lastName"),
      email: formData.get("email"),
      phone: formData.get("phone")
    });

    if (!parsed.success) {
      redirect(`${redirectBasePath}?error=invalid_customer`);
    }

    const email = parsed.data.email.toLowerCase();
    const existingCustomer = await prisma.customer.findUnique({
      where: { companyId_email: { companyId, email } },
      select: {
        id: true,
        consultantProfileId: true,
        partnerProfileId: true,
        groupLeaderProfileId: true
      }
    });

    if (workspace === "consultant" && existingCustomer?.consultantProfileId && existingCustomer.consultantProfileId !== consultantProfileId) {
      redirect(`${redirectBasePath}?error=customer_not_assigned`);
    }

    if (workspace === "partner" && existingCustomer?.partnerProfileId && existingCustomer.partnerProfileId !== partnerProfileId) {
      redirect(`${redirectBasePath}?error=customer_not_assigned`);
    }

    if (workspace === "group_leader" && existingCustomer?.groupLeaderProfileId && existingCustomer.groupLeaderProfileId !== groupLeaderProfileId) {
      redirect(`${redirectBasePath}?error=customer_not_assigned`);
    }

    const customer = existingCustomer
      ? await prisma.customer.update({
          where: { id: existingCustomer.id },
          data: {
            consultantProfileId: workspace === "consultant" ? consultantProfileId : existingCustomer.consultantProfileId,
            partnerProfileId: workspace === "partner" || workspace === "group_leader" ? partnerProfileId : existingCustomer.partnerProfileId,
            groupLeaderProfileId: workspace === "consultant" || workspace === "group_leader" ? groupLeaderProfileId : existingCustomer.groupLeaderProfileId,
            pipelineStage,
            pipelineUpdatedAt: new Date(),
            firstName: parsed.data.firstName,
            lastName: parsed.data.lastName || null,
            phone: parsed.data.phone || null,
            notes: notes || undefined
          }
        })
      : await prisma.customer.create({
          data: {
            companyId,
            consultantProfileId: workspace === "consultant" ? consultantProfileId : null,
            partnerProfileId: workspace === "partner" || workspace === "group_leader" ? partnerProfileId : null,
            groupLeaderProfileId: workspace === "consultant" || workspace === "group_leader" ? groupLeaderProfileId : null,
            email,
            pipelineStage,
            pipelineUpdatedAt: new Date(),
            firstName: parsed.data.firstName,
            lastName: parsed.data.lastName || null,
            phone: parsed.data.phone || null,
            notes: notes || null
          }
        });

    customerId = customer.id;
  }

  const customerWhere =
    workspace === "consultant"
      ? { id: customerId, companyId, consultantProfileId }
      : workspace === "partner"
        ? {
            id: customerId,
            companyId,
            OR: [
              { partnerProfileId },
              { consultantProfile: { partnerProfileId } }
            ]
          }
        : workspace === "group_leader"
          ? {
              id: customerId,
              companyId,
              OR: [
                { groupLeaderProfileId },
                { consultantProfile: { groupLeaderProfileId } }
              ]
            }
        : { id: customerId, companyId };

  const customer = await prisma.customer.findFirst({ where: customerWhere });

  if (!customer) {
    redirect(`${redirectBasePath}?error=customer_not_assigned`);
  }

  await prisma.customer.update({
    where: { id: customer.id },
    data: {
      pipelineStage,
      pipelineUpdatedAt: new Date(),
      notes: notes || customer.notes
    }
  });

  const productIds = selectedItems.map((item) => item.productId);
  const products = await prisma.product.findMany({
    where: {
      id: { in: productIds },
      companyId,
      active: true
    }
  });
  const productMap = new Map(products.map((product) => [product.id, product]));

  if (products.length !== selectedItems.length) {
    redirect(`${redirectBasePath}?error=invalid_products`);
  }

  const subtotalCents = selectedItems.reduce((sum, item) => {
    const product = productMap.get(item.productId);
    return sum + (product?.priceCents ?? 0) * item.quantity;
  }, 0);

  const commissionMode =
    workspace === "consultant"
      ? "CONSULTANT_PARTNER_SPLIT"
      : workspace === "partner"
        ? "PARTNER_DIRECT"
        : workspace === "group_leader"
          ? "GROUP_LEADER_DIRECT"
          : "ADMIN_DIRECT";

  const order = await prisma.order.create({
    data: {
      companyId,
      customerId: customer.id,
      consultantProfileId: workspace === "consultant" ? consultantProfileId : null,
      partnerProfileId: workspace === "partner" || workspace === "group_leader" ? partnerProfileId : null,
      groupLeaderProfileId: workspace === "consultant" || workspace === "group_leader" ? groupLeaderProfileId : null,
      subtotalCents,
      totalCents: subtotalCents,
      paymentProviderCode: providerCode,
      paymentStatus: "PENDING",
      orderStatus: "PENDING",
      commissionStatus: "PENDING",
      referralSource: `${workspace}_manual`,
      referralMetadata: {
        pipelineStage,
        notes,
        source: `${workspace}_sales_workspace`,
        commissionMode,
        paymentWorkflow,
        shippingAddress: shippingAddress.data,
        provider: providerCode,
        paymentProvider: {
          integration: paymentWorkflow === "collect_payment" ? "hosted_elements" : "checkout_session",
          amountCents: subtotalCents,
          paymentUrl: orderPaymentUrl("ORDER_ID_PLACEHOLDER", providerCode),
          webhookRoute: `/api/webhooks/${providerCode === "authorize_net" ? "authorize-net" : providerCode}`
        }
      },
      items: {
        create: selectedItems.map((item) => {
          const product = productMap.get(item.productId)!;
          return {
            productId: product.id,
            quantity: item.quantity,
            unitPriceCents: product.priceCents,
            totalCents: product.priceCents * item.quantity
          };
        })
      }
    }
  });

  await createMarginCommissionLedger({ prisma, orderId: order.id, commissionMode });

  const fallbackInvoiceUrl = orderPaymentUrl(order.id, providerCode);
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
  const internalOrderUrl = `${appUrl}${orderDetailPath(workspace, order.id)}`;
  const checkoutSuccessUrl =
    paymentWorkflow === "collect_payment" ? `${internalOrderUrl}?payment=success` : `${appUrl}/checkout/success?orderId=${order.id}`;
  const checkoutCancelUrl =
    paymentWorkflow === "collect_payment" ? `${appUrl}${redirectBasePath}?created=${order.id}&payment=cancelled` : `${appUrl}/checkout/cancel?orderId=${order.id}`;
  const checkoutResult = providerCode === "stripe"
    ? await getPaymentProvider(providerCode).createCheckoutSession({
        companyId,
        customerId: customer.id,
        orderId: order.id,
        successUrl: checkoutSuccessUrl,
        cancelUrl: checkoutCancelUrl,
        lineItems: selectedItems.map((item) => {
          const product = productMap.get(item.productId)!;
          return {
            name: product.title,
            quantity: item.quantity,
            unitAmount: { amount: product.priceCents, currency: "USD" as const }
          };
        }),
        metadata: {
          companyId,
          orderId: order.id,
          customerId: customer.id,
          customerEmail: customer.email,
          customerName: [customer.firstName, customer.lastName].filter(Boolean).join(" ").trim() || customer.email,
          workspace,
          commissionMode
        }
      })
    : null;
  const invoiceUrl = checkoutResult?.redirectUrl ?? fallbackInvoiceUrl;

  await prisma.order.update({
    where: { id: order.id },
    data: {
      referralMetadata: {
        pipelineStage,
        notes,
        source: `${workspace}_sales_workspace`,
        commissionMode,
        paymentWorkflow,
        internalOrderUrl,
        customerSuccessUrl: `${appUrl}/checkout/success?orderId=${order.id}`,
        shippingAddress: shippingAddress.data,
        provider: providerCode,
        paymentProvider: {
          integration: paymentWorkflow === "collect_payment" ? "hosted_elements" : "checkout_session",
          amountCents: subtotalCents,
          paymentUrl: invoiceUrl,
          providerSessionId: checkoutResult?.providerSessionId,
          providerCustomerId: checkoutResult?.providerCustomerId,
          webhookRoute: `/api/webhooks/${providerCode === "authorize_net" ? "authorize-net" : providerCode}`
        }
      }
    }
  });

  if (checkoutResult?.providerSessionId) {
    await prisma.paymentTransaction.create({
      data: {
        companyId,
        orderId: order.id,
        providerCode,
        providerTransactionId: checkoutResult.providerSessionId,
        amountCents: subtotalCents,
        status: "PENDING",
        eventType: "checkout.session.created",
        rawEvent: checkoutResult.raw === undefined ? undefined : JSON.parse(JSON.stringify(checkoutResult.raw))
      }
    });
  }

  await prisma.activityLog.create({
    data: {
      companyId,
      userId: actorUserId,
      customerId: customer.id,
      action: `${workspace.toUpperCase()}_ORDER_CREATED`,
      metadata: {
        orderId: order.id,
        pipelineStage,
        totalCents: subtotalCents,
        commissionMode,
        paymentWorkflow,
        provider: providerCode,
        providerSessionId: checkoutResult?.providerSessionId,
        paymentUrl: invoiceUrl,
        shippingAddress: shippingAddress.data
      }
    }
  });

  if (paymentWorkflow === "send_invoice") {
    await queueInvoiceWebhook({
      companyId,
      actorUserId,
      customer,
      orderId: order.id,
      totalCents: subtotalCents,
      invoiceUrl,
      providerCode,
      providerSessionId: checkoutResult?.providerSessionId,
      partnerProfileId,
      workspace,
      shippingAddress: shippingAddress.data
    });
  }

  revalidatePath(redirectBasePath);
  revalidatePath("/admin/orders");
  revalidatePath("/admin/commissions");
  revalidatePath("/partner/sales");
  revalidatePath("/partner/commissions");
  revalidatePath("/partner/pipeline");
  revalidatePath("/consultant/sales");
  revalidatePath("/consultant/commissions");
  revalidatePath("/consultant/pipeline");

  if (paymentWorkflow === "collect_payment" && checkoutResult?.redirectUrl) {
    redirect(checkoutResult.redirectUrl);
  }

  redirect(`${redirectBasePath}?created=${order.id}`);
}

export async function createConsultantOrder(formData: FormData) {
  const user = await requireApprovedConsultant();
  const companyId = user.companyId;
  const consultantProfileId = user.consultantProfile?.id;

  if (!companyId || !consultantProfileId) {
    redirect("/consultant/sales?error=consultant_profile_required");
  }

  if (!user.consultantProfile?.partnerProfileId) {
    redirect("/consultant/sales?error=commission_setup_required");
  }

  await createWorkspaceOrder(formData, {
    workspace: "consultant",
    companyId,
    actorUserId: user.id,
    consultantProfileId,
    partnerProfileId: user.consultantProfile.partnerProfileId,
    groupLeaderProfileId: user.consultantProfile.groupLeaderProfileId,
    redirectBasePath: "/consultant/sales"
  });
}

export async function createPartnerOrder(formData: FormData) {
  const user = await requirePartner();
  const partnerProfile = await prisma.partnerProfile.findUnique({ where: { userId: user.id } });
  const groupLeaderProfile = await prisma.groupLeaderProfile.findUnique({ where: { userId: user.id } });

  if (!user.companyId || (!partnerProfile && !groupLeaderProfile)) {
    redirect("/partner/sales?error=partner_profile_required");
  }

  await createWorkspaceOrder(formData, {
    workspace: partnerProfile ? "partner" : "group_leader",
    companyId: user.companyId,
    actorUserId: user.id,
    partnerProfileId: partnerProfile?.id ?? groupLeaderProfile!.partnerProfileId,
    groupLeaderProfileId: groupLeaderProfile?.id ?? null,
    redirectBasePath: "/partner/sales"
  });
}

export async function createAdminOrder(formData: FormData) {
  const user = await requireRole("COMPANY_ADMIN");

  if (!user.companyId) {
    redirect("/admin/sales?error=company_required");
  }

  await createWorkspaceOrder(formData, {
    workspace: "admin",
    companyId: user.companyId,
    actorUserId: user.id,
    redirectBasePath: "/admin/sales"
  });
}
