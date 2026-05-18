"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireApprovedConsultant } from "@/lib/auth/current-user";
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

  const customerMode = formString(formData, "customerMode") || "existing";
  const pipelineStageInput = formString(formData, "pipelineStage");
  const pipelineStage = isCustomerPipelineStage(pipelineStageInput) ? pipelineStageInput : "CART_BUILT";
  const notes = formString(formData, "notes");
  const selectedItems = selectedProductQuantities(formData);

  if (selectedItems.length === 0) {
    redirect("/consultant/sales?error=empty_order");
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
      redirect("/consultant/sales?error=invalid_customer");
    }

    const email = parsed.data.email.toLowerCase();
    const existingCustomer = await prisma.customer.findUnique({
      where: {
        companyId_email: { companyId, email }
      },
      select: {
        id: true,
        consultantProfileId: true
      }
    });

    if (existingCustomer?.consultantProfileId && existingCustomer.consultantProfileId !== consultantProfileId) {
      redirect("/consultant/sales?error=customer_not_assigned");
    }

    const customer = existingCustomer
      ? await prisma.customer.update({
        where: { id: existingCustomer.id },
        data: {
          consultantProfileId,
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
          consultantProfileId,
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

  const customer = await prisma.customer.findFirst({
    where: {
      id: customerId,
      companyId,
      consultantProfileId
    }
  });

  if (!customer) {
    redirect("/consultant/sales?error=customer_not_assigned");
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
    redirect("/consultant/sales?error=invalid_products");
  }

  const subtotalCents = selectedItems.reduce((sum, item) => {
    const product = productMap.get(item.productId);
    return sum + (product?.priceCents ?? 0) * item.quantity;
  }, 0);
  const totalCents = subtotalCents;

  const order = await prisma.order.create({
    data: {
      companyId,
      customerId: customer.id,
      consultantProfileId,
      subtotalCents,
      totalCents,
      paymentProviderCode: "manual_pending",
      paymentStatus: "PENDING",
      orderStatus: "PENDING",
      commissionStatus: "PENDING",
      referralSource: "consultant_manual",
      referralMetadata: {
        pipelineStage,
        notes,
        source: "consultant_sales_workspace"
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

  await createMarginCommissionLedger({ prisma, orderId: order.id });

  await prisma.activityLog.create({
    data: {
      companyId,
      userId: user.id,
      customerId: customer.id,
      action: "CONSULTANT_ORDER_CREATED",
      metadata: {
        orderId: order.id,
        pipelineStage,
        totalCents
      }
    }
  });

  revalidatePath("/consultant/sales");
  revalidatePath("/consultant/commissions");
  revalidatePath("/admin/orders");
  revalidatePath("/admin/commissions");
  redirect(`/consultant/sales?created=${order.id}`);
}
