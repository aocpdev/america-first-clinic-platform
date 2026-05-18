"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { requireRole } from "@/lib/auth/current-user";
import {
  calculateMarginBps,
  dollarsToCents,
  productMetadataFromForm,
  slugify
} from "@/lib/products/catalog";
import { prisma } from "@/lib/db/prisma";

const productSchema = z.object({
  title: z.string().min(2),
  description: z.string().min(8),
  categoryName: z.string().min(2),
  sku: z.string().min(2),
  quantityOnHand: z.coerce.number().int().min(0).default(0),
  reorderPoint: z.coerce.number().int().min(0).default(10),
  active: z.boolean().default(true),
  supportsSubscription: z.boolean().default(false),
  supportsRecurring: z.boolean().default(false)
});

async function requireAdminCompany() {
  const user = await requireRole("COMPANY_ADMIN");
  if (!user.companyId) {
    redirect("/admin/settings?error=missing_company");
  }
  return user.companyId;
}

async function upsertCategory(companyId: string, categoryName: string) {
  const name = categoryName.trim();
  const slug = slugify(name);

  return prisma.productCategory.upsert({
    where: {
      companyId_slug: {
        companyId,
        slug
      }
    },
    update: { name },
    create: {
      companyId,
      name,
      slug
    }
  });
}

export async function createProduct(formData: FormData) {
  const companyId = await requireAdminCompany();
  const parsed = productSchema.parse({
    title: formData.get("title"),
    description: formData.get("description"),
    categoryName: formData.get("categoryName"),
    sku: formData.get("sku"),
    quantityOnHand: formData.get("quantityOnHand"),
    reorderPoint: formData.get("reorderPoint"),
    active: formData.get("active") === "on",
    supportsSubscription: formData.get("supportsSubscription") === "on",
    supportsRecurring: formData.get("supportsRecurring") === "on"
  });
  const priceCents = dollarsToCents(formData.get("price"));
  const internalCostCents = dollarsToCents(formData.get("internalCost"));
  const category = await upsertCategory(companyId, parsed.categoryName);

  await prisma.product.create({
    data: {
      companyId,
      categoryId: category.id,
      title: parsed.title.trim(),
      slug: slugify(parsed.title),
      description: parsed.description.trim(),
      priceCents,
      internalCostCents,
      marginBps: calculateMarginBps(priceCents, internalCostCents),
      sku: parsed.sku.trim().toUpperCase(),
      active: parsed.active,
      supportsSubscription: parsed.supportsSubscription,
      supportsRecurring: parsed.supportsRecurring,
      metadata: productMetadataFromForm(formData),
      inventory: {
        create: {
          quantityOnHand: parsed.quantityOnHand,
          reorderPoint: parsed.reorderPoint
        }
      }
    }
  });

  revalidatePath("/admin/products");
  revalidatePath("/partner/products");
  revalidatePath("/shop");
}

export async function updateProduct(formData: FormData) {
  const companyId = await requireAdminCompany();
  const productId = String(formData.get("productId") || "");
  const parsed = productSchema.parse({
    title: formData.get("title"),
    description: formData.get("description"),
    categoryName: formData.get("categoryName"),
    sku: formData.get("sku"),
    quantityOnHand: formData.get("quantityOnHand"),
    reorderPoint: formData.get("reorderPoint"),
    active: formData.get("active") === "on",
    supportsSubscription: formData.get("supportsSubscription") === "on",
    supportsRecurring: formData.get("supportsRecurring") === "on"
  });
  const priceCents = dollarsToCents(formData.get("price"));
  const internalCostCents = dollarsToCents(formData.get("internalCost"));
  const category = await upsertCategory(companyId, parsed.categoryName);
  const existingProduct = await prisma.product.findUnique({
    where: {
      id: productId,
      companyId
    },
    select: { metadata: true }
  });
  const existingMetadata =
    typeof existingProduct?.metadata === "object" && existingProduct.metadata !== null && !Array.isArray(existingProduct.metadata)
      ? existingProduct.metadata
      : {};
  const nextMetadata = {
    ...existingMetadata,
    ...(productMetadataFromForm(formData) as Record<string, unknown>)
  } as Prisma.InputJsonObject;

  await prisma.product.update({
    where: {
      id: productId,
      companyId
    },
    data: {
      categoryId: category.id,
      title: parsed.title.trim(),
      slug: slugify(parsed.title),
      description: parsed.description.trim(),
      priceCents,
      internalCostCents,
      marginBps: calculateMarginBps(priceCents, internalCostCents),
      sku: parsed.sku.trim().toUpperCase(),
      active: parsed.active,
      supportsSubscription: parsed.supportsSubscription,
      supportsRecurring: parsed.supportsRecurring,
      metadata: nextMetadata,
      inventory: {
        upsert: {
          create: {
            quantityOnHand: parsed.quantityOnHand,
            reorderPoint: parsed.reorderPoint
          },
          update: {
            quantityOnHand: parsed.quantityOnHand,
            reorderPoint: parsed.reorderPoint
          }
        }
      }
    }
  });

  revalidatePath("/admin/products");
  revalidatePath("/partner/products");
  revalidatePath("/shop");
}

export async function deleteProduct(formData: FormData) {
  const companyId = await requireAdminCompany();
  const productId = String(formData.get("productId") || "");
  const orderItemCount = await prisma.orderItem.count({
    where: {
      productId,
      product: { companyId }
    }
  });

  if (orderItemCount > 0) {
    await prisma.product.update({
      where: {
        id: productId,
        companyId
      },
      data: { active: false }
    });
  } else {
    await prisma.product.delete({
      where: {
        id: productId,
        companyId
      }
    });
  }

  revalidatePath("/admin/products");
  revalidatePath("/partner/products");
  revalidatePath("/shop");
}
