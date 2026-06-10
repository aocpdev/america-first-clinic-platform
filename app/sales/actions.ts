"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { requireApprovedConsultant, requirePartner, requireRole } from "@/lib/auth/current-user";
import { createMarginCommissionLedger } from "@/lib/commissions/margin-split";
import { prisma } from "@/lib/db/prisma";
import { calculateDiscountApplication, isDiscountActive, normalizeDiscountCode } from "@/lib/discounts/calculations";
import { getPaymentProvider } from "@/lib/payments/registry";
import { appBaseUrl, fallbackOrderPaymentUrl, invoiceShortUrl, paymentShortUrl } from "@/lib/payments/short-links";
import type { PaymentProviderCode } from "@/lib/payments/types";
import { normalizePhoneToE164, phoneForWebhook } from "@/lib/phone";
import { isUsStateCode } from "@/lib/locations/us-states";
import { isCustomerPipelineStage } from "@/lib/sales/pipeline";
import { publicSiteBaseUrl } from "@/lib/urls";
import { dispatchWebhookEvent } from "@/lib/webhooks/dispatch";

const newCustomerSchema = z.object({
  firstName: z.string().trim().min(1),
  lastName: z.string().trim().min(1),
  email: z.string().trim().email(),
  phone: z
    .string()
    .trim()
    .min(1)
    .transform((value) => normalizePhoneToE164(value))
    .refine((value) => Boolean(value), "Phone is required"),
  dateOfBirth: z.string().trim().min(1),
  birthSex: z.enum(["MALE", "FEMALE", "PREFER_NOT_TO_SAY"])
});

const shippingAddressSchema = z.object({
  line1: z.string().trim().min(1),
  line2: z.string().trim().optional(),
  city: z.string().trim().min(1),
  state: z
    .string()
    .trim()
    .toUpperCase()
    .refine((value) => isUsStateCode(value), "Select a valid state"),
  postalCode: z.string().trim().min(1),
  country: z.string().trim().min(1).default("US")
});

function formString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function optionalDate(value?: string) {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function hasQualiphyRequiredCustomerData(customer: { firstName: string | null; lastName: string | null; phone: string | null; dateOfBirth: Date | null; birthSex: string | null }) {
  return Boolean(customer.firstName && customer.lastName && customer.phone && customer.dateOfBirth && customer.birthSex);
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
  return fallbackOrderPaymentUrl(orderId, providerCode);
}

function orderDetailPath(workspace: "consultant" | "partner" | "manager" | "group_leader" | "admin", orderId: string) {
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
      customerPhone: phoneForWebhook(input.customer.phone),
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
        customerPhone: phoneForWebhook(input.customer.phone),
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
    workspace: "consultant" | "partner" | "manager" | "group_leader" | "admin";
    companyId: string;
    actorUserId: string;
    consultantProfileId?: string | null;
    partnerProfileId?: string | null;
    managerProfileId?: string | null;
    groupLeaderProfileId?: string | null;
    redirectBasePath: string;
  }
) {
  const {
    workspace,
    companyId,
    actorUserId,
    consultantProfileId = null,
    partnerProfileId = null,
    managerProfileId = null,
    groupLeaderProfileId = null,
    redirectBasePath
  } = context;
  const customerMode = formString(formData, "customerMode") || "existing";
  const pipelineStageInput = formString(formData, "pipelineStage");
  const pipelineStage = isCustomerPipelineStage(pipelineStageInput) ? pipelineStageInput : "AWAITING_PAYMENT";
  const notes = formString(formData, "notes");
  const paymentWorkflow = paymentWorkflowFromForm(formData);
  const shippingAddressMode = formString(formData, "shippingAddressMode") === "saved" ? "saved" : "new";
  const selectedShippingAddressId = formString(formData, "shippingAddressId");
  const makeShippingAddressDefault = formString(formData, "shippingAddressDefault") === "true";
  const selectedItems = selectedProductQuantities(formData);
  const couponCode = normalizeDiscountCode(formString(formData, "couponCode"));
  const providerCode = await activePaymentProviderCode(companyId);

  if (selectedItems.length === 0) {
    redirect(`${redirectBasePath}?error=empty_order`);
  }

  let customerId = formString(formData, "customerId");

  if (customerMode === "new") {
    const shippingPreflight = shippingAddressSchema.safeParse({
      line1: formData.get("shippingAddressLine1"),
      line2: formData.get("shippingAddressLine2"),
      city: formData.get("shippingCity"),
      state: formData.get("shippingState"),
      postalCode: formData.get("shippingPostalCode"),
      country: formData.get("shippingCountry") || "US"
    });

    if (!shippingPreflight.success) {
      redirect(`${redirectBasePath}?error=invalid_shipping_address`);
    }

    const parsed = newCustomerSchema.safeParse({
      firstName: formData.get("firstName"),
      lastName: formData.get("lastName"),
      email: formData.get("email"),
      phone: formData.get("phone"),
      dateOfBirth: formData.get("dateOfBirth"),
      birthSex: formData.get("birthSex") || undefined
    });

    if (!parsed.success) {
      redirect(`${redirectBasePath}?error=invalid_customer`);
    }

    const email = parsed.data.email.toLowerCase();
    const existingCustomers = await prisma.customer.findMany({
      where: {
        companyId,
        OR: [
          { email },
          ...(parsed.data.phone ? [{ phone: parsed.data.phone }] : [])
        ]
      },
      select: {
        id: true,
        email: true,
        phone: true,
        consultantProfileId: true,
        partnerProfileId: true,
        managerProfileId: true,
        groupLeaderProfileId: true
      }
    });
    const emailMatch = existingCustomers.find((customer) => customer.email.toLowerCase() === email);
    const phoneMatch = parsed.data.phone ? existingCustomers.find((customer) => customer.phone === parsed.data.phone) : null;

    if (emailMatch && phoneMatch && emailMatch.id !== phoneMatch.id) {
      redirect(`${redirectBasePath}?error=duplicate_customer_contact`);
    }

    const existingCustomer = emailMatch ?? phoneMatch ?? null;

    if (workspace === "consultant" && existingCustomer?.consultantProfileId && existingCustomer.consultantProfileId !== consultantProfileId) {
      redirect(`${redirectBasePath}?error=customer_not_assigned`);
    }

    if (workspace === "partner" && existingCustomer?.partnerProfileId && existingCustomer.partnerProfileId !== partnerProfileId) {
      redirect(`${redirectBasePath}?error=customer_not_assigned`);
    }

    if (workspace === "manager" && existingCustomer?.managerProfileId && existingCustomer.managerProfileId !== managerProfileId) {
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
            partnerProfileId: workspace === "partner" || workspace === "manager" || workspace === "group_leader" ? partnerProfileId : existingCustomer.partnerProfileId,
            managerProfileId: workspace === "consultant" || workspace === "manager" || workspace === "group_leader" ? managerProfileId : existingCustomer.managerProfileId,
            groupLeaderProfileId: workspace === "consultant" || workspace === "group_leader" ? groupLeaderProfileId : existingCustomer.groupLeaderProfileId,
            pipelineStage,
            pipelineUpdatedAt: new Date(),
            firstName: parsed.data.firstName,
            lastName: parsed.data.lastName || null,
            dateOfBirth: optionalDate(parsed.data.dateOfBirth),
            birthSex: parsed.data.birthSex || null,
            phone: parsed.data.phone || null,
            notes: notes || undefined
          }
        })
      : await prisma.customer.create({
          data: {
            companyId,
            consultantProfileId: workspace === "consultant" ? consultantProfileId : null,
            partnerProfileId: workspace === "partner" || workspace === "manager" || workspace === "group_leader" || workspace === "consultant" ? partnerProfileId : null,
            managerProfileId: workspace === "consultant" || workspace === "manager" || workspace === "group_leader" ? managerProfileId : null,
            groupLeaderProfileId: workspace === "consultant" || workspace === "group_leader" ? groupLeaderProfileId : null,
            email,
            pipelineStage,
            pipelineUpdatedAt: new Date(),
            firstName: parsed.data.firstName,
            lastName: parsed.data.lastName || null,
            dateOfBirth: optionalDate(parsed.data.dateOfBirth),
            birthSex: parsed.data.birthSex || null,
            phone: parsed.data.phone || null,
            notes: notes || null
          }
        });

    customerId = customer.id;
  }

  let customerWhere: Prisma.CustomerWhereInput = { id: customerId, companyId };

  if (workspace === "consultant") {
    if (!consultantProfileId) redirect(`${redirectBasePath}?error=customer_not_assigned`);
    customerWhere = { id: customerId, companyId, consultantProfileId };
  }

  if (workspace === "partner") {
    if (!partnerProfileId) redirect(`${redirectBasePath}?error=customer_not_assigned`);
    customerWhere = {
      id: customerId,
      companyId,
      OR: [
        { partnerProfileId },
        { managerProfile: { partnerProfileId } },
        { groupLeaderProfile: { partnerProfileId } },
        { consultantProfile: { partnerProfileId } }
      ]
    };
  }

  if (workspace === "manager") {
    if (!managerProfileId) redirect(`${redirectBasePath}?error=customer_not_assigned`);
    customerWhere = {
      id: customerId,
      companyId,
      OR: [
        { managerProfileId },
        { groupLeaderProfile: { managerProfileId } },
        { consultantProfile: { managerProfileId } },
        { consultantProfile: { groupLeaderProfile: { managerProfileId } } }
      ]
    };
  }

  if (workspace === "group_leader") {
    if (!groupLeaderProfileId) redirect(`${redirectBasePath}?error=customer_not_assigned`);
    customerWhere = {
      id: customerId,
      companyId,
      OR: [
        { groupLeaderProfileId },
        { consultantProfile: { groupLeaderProfileId } }
      ]
    };
  }

  const customer = await prisma.customer.findFirst({ where: customerWhere });

  if (!customer) {
    redirect(`${redirectBasePath}?error=customer_not_assigned`);
  }

  if (!hasQualiphyRequiredCustomerData(customer)) {
    redirect(`${redirectBasePath}?error=customer_qualiphy_required`);
  }

  await prisma.customer.update({
    where: { id: customer.id },
    data: {
      pipelineStage,
      pipelineUpdatedAt: new Date(),
      notes: notes || customer.notes
    }
  });

  let shippingAddressData: z.infer<typeof shippingAddressSchema>;
  let persistedShippingAddressId: string | null = null;

  if (shippingAddressMode === "saved" && selectedShippingAddressId) {
    const savedAddress = await prisma.customerAddress.findFirst({
      where: {
        id: selectedShippingAddressId,
        customerId: customer.id
      }
    });

    if (!savedAddress) {
      redirect(`${redirectBasePath}?error=invalid_shipping_address`);
    }

    if (!isUsStateCode(savedAddress.state)) {
      redirect(`${redirectBasePath}?error=invalid_shipping_address`);
    }

    await prisma.customerAddress.update({
      where: { id: savedAddress.id },
      data: { lastUsedAt: new Date() }
    });

    persistedShippingAddressId = savedAddress.id;
    shippingAddressData = {
      line1: savedAddress.line1,
      line2: savedAddress.line2 || undefined,
      city: savedAddress.city,
      state: savedAddress.state,
      postalCode: savedAddress.postalCode,
      country: savedAddress.country
    };
  } else {
    const shippingAddress = shippingAddressSchema.safeParse({
      line1: formData.get("shippingAddressLine1"),
      line2: formData.get("shippingAddressLine2"),
      city: formData.get("shippingCity"),
      state: formData.get("shippingState"),
      postalCode: formData.get("shippingPostalCode"),
      country: formData.get("shippingCountry") || "US"
    });

    if (!shippingAddress.success) {
      redirect(`${redirectBasePath}?error=invalid_shipping_address`);
    }

    const existingAddressCount = await prisma.customerAddress.count({
      where: { customerId: customer.id }
    });
    const isDefault = makeShippingAddressDefault || existingAddressCount === 0;

    if (isDefault) {
      await prisma.customerAddress.updateMany({
        where: { customerId: customer.id },
        data: { isDefault: false }
      });
    }

    const savedAddress = await prisma.customerAddress.create({
      data: {
        customerId: customer.id,
        label: null,
        line1: shippingAddress.data.line1,
        line2: shippingAddress.data.line2 || null,
        city: shippingAddress.data.city,
        state: shippingAddress.data.state,
        postalCode: shippingAddress.data.postalCode,
        country: shippingAddress.data.country,
        isDefault,
        lastUsedAt: new Date()
      }
    });

    persistedShippingAddressId = savedAddress.id;
    shippingAddressData = shippingAddress.data;
  }

  const productIds = selectedItems.map((item) => item.productId);
  const products = await prisma.product.findMany({
    where: {
      id: { in: productIds },
      companyId,
      active: true
    },
    include: { category: true }
  });
  const productMap = new Map(products.map((product) => [product.id, product]));

  if (products.length !== selectedItems.length) {
    redirect(`${redirectBasePath}?error=invalid_products`);
  }

  const subtotalCents = selectedItems.reduce((sum, item) => {
    const product = productMap.get(item.productId);
    return sum + (product?.priceCents ?? 0) * item.quantity;
  }, 0);
  const discountLines = selectedItems.map((item) => {
    const product = productMap.get(item.productId)!;
    return {
      productId: product.id,
      categoryName: product.category.name,
      priceCents: product.priceCents,
      internalCostCents: product.internalCostCents,
      quantity: item.quantity
    };
  });
  const discount = couponCode
    ? await prisma.discount.findUnique({
        where: {
          companyId_code: {
            companyId,
            code: couponCode
          }
        }
      })
    : null;

  if (couponCode && (!discount || !isDiscountActive(discount))) {
    redirect(`${redirectBasePath}?error=invalid_discount`);
  }

  const appliedDiscount = discount ? calculateDiscountApplication(discount, discountLines) : null;

  if (couponCode && (!appliedDiscount || appliedDiscount.discountCents <= 0)) {
    redirect(`${redirectBasePath}?error=discount_not_applicable`);
  }

  const discountCents = appliedDiscount?.discountCents ?? 0;
  const totalCents = appliedDiscount?.totalCents ?? subtotalCents;
  const discountMetadata = appliedDiscount
    ? {
        discountId: discount!.id,
        code: discount!.code,
        name: discount!.name,
        discountType: discount!.discountType,
        discountCents,
        requestedDiscountCents: appliedDiscount.requestedDiscountCents,
        subtotalCents,
        totalCents,
        ownerProtectedProfitCents: appliedDiscount.ownerProtectedProfitCents,
        commissionableMarginCents: appliedDiscount.commissionableMarginCents,
        eligibleSubtotalCents: appliedDiscount.eligibleSubtotalCents,
        affectsCommissions: discount!.affectsCommissions
      }
    : null;

  const commissionMode =
    workspace === "consultant"
      ? "CONSULTANT_PARTNER_SPLIT"
      : workspace === "partner"
        ? "PARTNER_DIRECT"
        : workspace === "manager"
          ? "MANAGER_DIRECT"
          : workspace === "group_leader"
            ? "GROUP_LEADER_DIRECT"
            : "ADMIN_DIRECT";

  const order = await prisma.order.create({
    data: {
      companyId,
      customerId: customer.id,
      consultantProfileId: workspace === "consultant" ? consultantProfileId : null,
      partnerProfileId: workspace === "partner" || workspace === "manager" || workspace === "group_leader" || workspace === "consultant" ? partnerProfileId : null,
      managerProfileId: workspace === "consultant" || workspace === "manager" || workspace === "group_leader" ? managerProfileId : null,
      groupLeaderProfileId: workspace === "consultant" || workspace === "group_leader" ? groupLeaderProfileId : null,
      subtotalCents,
      discountCents,
      totalCents,
      paymentProviderCode: providerCode,
      paymentStatus: "PENDING",
      orderStatus: "PENDING",
      commissionStatus: "PENDING",
      orderPipelineStage: "AWAITING_PAYMENT",
      orderPipelineUpdatedAt: new Date(),
      referralSource: `${workspace}_manual`,
      referralMetadata: {
        pipelineStage,
        notes,
        source: `${workspace}_sales_workspace`,
        commissionMode,
        paymentWorkflow,
        shippingAddress: shippingAddressData,
        shippingAddressId: persistedShippingAddressId,
        discount: discountMetadata,
        provider: providerCode,
        paymentProvider: {
          integration: paymentWorkflow === "collect_payment" ? "hosted_elements" : "checkout_session",
          amountCents: totalCents,
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

  if (appliedDiscount) {
    await prisma.$transaction([
      prisma.discountRedemption.create({
        data: {
          companyId,
          discountId: discount!.id,
          orderId: order.id,
          codeSnapshot: discount!.code,
          nameSnapshot: discount!.name,
          discountTypeSnapshot: discount!.discountType,
          discountCents,
          subtotalCents,
          totalCents,
          ownerProtectedProfitCents: appliedDiscount.ownerProtectedProfitCents,
          commissionableMarginCents: appliedDiscount.commissionableMarginCents
        }
      }),
      prisma.discount.update({
        where: { id: discount!.id },
        data: { redemptionCount: { increment: 1 } }
      })
    ]);
  }

  await createMarginCommissionLedger({ prisma, orderId: order.id, commissionMode });

  const fallbackInvoiceUrl = orderPaymentUrl(order.id, providerCode);
  const portalUrl = appBaseUrl();
  const publicUrl = publicSiteBaseUrl();
  const internalOrderUrl = `${portalUrl}${orderDetailPath(workspace, order.id)}`;
  const customerSuccessUrl = `${publicUrl}/checkout/success?orderId=${order.id}`;
  const shortInvoiceUrl = invoiceShortUrl(order.id);
  const shortPaymentUrl = paymentShortUrl(order.id);
  const checkoutSuccessUrl =
    paymentWorkflow === "collect_payment" ? `${internalOrderUrl}?payment=success` : customerSuccessUrl;
  const checkoutCancelUrl =
    paymentWorkflow === "collect_payment" ? `${internalOrderUrl}?payment=cancelled` : shortInvoiceUrl;
  const checkoutResult = providerCode === "stripe"
    ? await getPaymentProvider(providerCode).createCheckoutSession({
        companyId,
        customerId: customer.id,
        orderId: order.id,
        successUrl: checkoutSuccessUrl,
        cancelUrl: checkoutCancelUrl,
        lineItems: discountCents > 0
          ? [
              {
                name: `Order ${order.id.slice(0, 8)} after discount`,
                quantity: 1,
                unitAmount: { amount: totalCents, currency: "USD" as const }
              }
            ]
          : selectedItems.map((item) => {
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
          commissionMode,
          couponCode: appliedDiscount ? discount!.code : "",
          discountCents: String(discountCents)
        }
      })
    : null;
  const providerPaymentUrl = checkoutResult?.redirectUrl ?? fallbackInvoiceUrl;
  const invoiceUrl = shortInvoiceUrl;

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
        customerSuccessUrl,
        shippingAddress: shippingAddressData,
        shippingAddressId: persistedShippingAddressId,
        discount: discountMetadata,
        provider: providerCode,
        paymentProvider: {
          integration: paymentWorkflow === "collect_payment" ? "hosted_elements" : "checkout_session",
          amountCents: totalCents,
          paymentUrl: invoiceUrl,
          shortPaymentUrl,
          paymentRedirectUrl: shortPaymentUrl,
          providerPaymentUrl,
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
        amountCents: totalCents,
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
        subtotalCents,
        discountCents,
        totalCents,
        discount: discountMetadata,
        commissionMode,
        paymentWorkflow,
        provider: providerCode,
        providerSessionId: checkoutResult?.providerSessionId,
        paymentUrl: invoiceUrl,
        providerPaymentUrl,
        shippingAddress: shippingAddressData,
        shippingAddressId: persistedShippingAddressId
      }
    }
  });

  if (paymentWorkflow === "send_invoice") {
    await queueInvoiceWebhook({
      companyId,
      actorUserId,
      customer,
      orderId: order.id,
      totalCents,
      invoiceUrl,
      providerCode,
      providerSessionId: checkoutResult?.providerSessionId,
      partnerProfileId,
      workspace,
      shippingAddress: shippingAddressData
    });
  }

  revalidatePath(redirectBasePath);
  revalidatePath("/admin/orders");
  revalidatePath("/admin/commissions");
  revalidatePath("/partner/sales");
  revalidatePath("/partner/commissions");
  revalidatePath("/partner/pipeline");
  revalidatePath("/manager/dashboard");
  revalidatePath("/manager/reports");
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
