"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireApprovedConsultant, requirePartner, requireRole } from "@/lib/auth/current-user";
import { createMarginCommissionLedger } from "@/lib/commissions/margin-split";
import { prisma } from "@/lib/db/prisma";
import { isCustomerPipelineStage } from "@/lib/sales/pipeline";

const newCustomerSchema = z.object({
  firstName: z.string().trim().min(1),
  lastName: z.string().trim().optional(),
  email: z.string().trim().email(),
  phone: z.string().trim().optional()
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

async function createWorkspaceOrder(
  formData: FormData,
  context: {
    workspace: "consultant" | "partner" | "admin";
    companyId: string;
    actorUserId: string;
    consultantProfileId?: string | null;
    partnerProfileId?: string | null;
    redirectBasePath: string;
  }
) {
  const { workspace, companyId, actorUserId, consultantProfileId = null, partnerProfileId = null, redirectBasePath } = context;
  const customerMode = formString(formData, "customerMode") || "existing";
  const pipelineStageInput = formString(formData, "pipelineStage");
  const pipelineStage = isCustomerPipelineStage(pipelineStageInput) ? pipelineStageInput : "CART_BUILT";
  const notes = formString(formData, "notes");
  const selectedItems = selectedProductQuantities(formData);

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
        partnerProfileId: true
      }
    });

    if (workspace === "consultant" && existingCustomer?.consultantProfileId && existingCustomer.consultantProfileId !== consultantProfileId) {
      redirect(`${redirectBasePath}?error=customer_not_assigned`);
    }

    if (workspace === "partner" && existingCustomer?.partnerProfileId && existingCustomer.partnerProfileId !== partnerProfileId) {
      redirect(`${redirectBasePath}?error=customer_not_assigned`);
    }

    const customer = existingCustomer
      ? await prisma.customer.update({
          where: { id: existingCustomer.id },
          data: {
            consultantProfileId: workspace === "consultant" ? consultantProfileId : existingCustomer.consultantProfileId,
            partnerProfileId: workspace === "partner" ? partnerProfileId : existingCustomer.partnerProfileId,
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
            partnerProfileId: workspace === "partner" ? partnerProfileId : null,
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
        : "ADMIN_DIRECT";

  const order = await prisma.order.create({
    data: {
      companyId,
      customerId: customer.id,
      consultantProfileId: workspace === "consultant" ? consultantProfileId : null,
      partnerProfileId: workspace === "partner" ? partnerProfileId : null,
      subtotalCents,
      totalCents: subtotalCents,
      paymentProviderCode: "manual_pending",
      paymentStatus: "PENDING",
      orderStatus: "PENDING",
      commissionStatus: "PENDING",
      referralSource: `${workspace}_manual`,
      referralMetadata: {
        pipelineStage,
        notes,
        source: `${workspace}_sales_workspace`,
        commissionMode
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
        commissionMode
      }
    }
  });

  revalidatePath(redirectBasePath);
  revalidatePath("/admin/orders");
  revalidatePath("/admin/commissions");
  revalidatePath("/partner/sales");
  revalidatePath("/partner/commissions");
  revalidatePath("/partner/pipeline");
  revalidatePath("/consultant/sales");
  revalidatePath("/consultant/commissions");
  revalidatePath("/consultant/pipeline");

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
    redirectBasePath: "/consultant/sales"
  });
}

export async function createPartnerOrder(formData: FormData) {
  const user = await requirePartner();
  const partnerProfile = await prisma.partnerProfile.findUnique({ where: { userId: user.id } });

  if (!user.companyId || !partnerProfile) {
    redirect("/partner/sales?error=partner_profile_required");
  }

  await createWorkspaceOrder(formData, {
    workspace: "partner",
    companyId: user.companyId,
    actorUserId: user.id,
    partnerProfileId: partnerProfile.id,
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
