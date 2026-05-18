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
import { createSupabaseAdminClient } from "@/lib/supabase/server";

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

export async function uploadProductImage(formData: FormData) {
  const companyId = await requireAdminCompany();
  const productId = String(formData.get("productId") || "");
  const image = formData.get("image");

  if (!(image instanceof File) || image.size === 0) {
    redirect("/admin/products?error=missing_image");
  }

  if (!image.type.startsWith("image/")) {
    redirect("/admin/products?error=invalid_image");
  }

  const product = await prisma.product.findUnique({
    where: {
      id: productId,
      companyId
    },
    select: {
      id: true,
      title: true,
      slug: true
    }
  });

  if (!product) {
    redirect("/admin/products?error=product_not_found");
  }

  const supabase = createSupabaseAdminClient();
  const bucket = "product-images";
  const { data: buckets } = await supabase.storage.listBuckets();

  if (!buckets?.some((item) => item.name === bucket)) {
    await supabase.storage.createBucket(bucket, {
      public: true,
      fileSizeLimit: 5 * 1024 * 1024,
      allowedMimeTypes: ["image/jpeg", "image/png", "image/webp", "image/gif"]
    });
  }

  const extension = image.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${companyId}/${product.id}/${Date.now()}.${extension}`;
  const bytes = await image.arrayBuffer();
  const { error } = await supabase.storage.from(bucket).upload(path, bytes, {
    contentType: image.type,
    upsert: true
  });

  if (error) {
    throw new Error(error.message);
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  const nextSortOrder = await prisma.productImage.count({ where: { productId: product.id } });

  await prisma.productImage.create({
    data: {
      productId: product.id,
      url: data.publicUrl,
      alt: product.title,
      sortOrder: nextSortOrder
    }
  });

  revalidatePath("/admin/products");
  revalidatePath("/partner/products");
  revalidatePath("/consultant/products");
  revalidatePath("/shop");
  revalidatePath(`/shop/${product.slug}`);
}

export async function deleteProductImage(formData: FormData) {
  const companyId = await requireAdminCompany();
  const imageId = String(formData.get("imageId") || "");

  const image = await prisma.productImage.findFirst({
    where: {
      id: imageId,
      product: { companyId }
    },
    include: {
      product: {
        select: { slug: true }
      }
    }
  });

  if (!image) {
    redirect("/admin/products?error=image_not_found");
  }

  await prisma.productImage.delete({ where: { id: image.id } });

  revalidatePath("/admin/products");
  revalidatePath("/partner/products");
  revalidatePath("/consultant/products");
  revalidatePath("/shop");
  revalidatePath(`/shop/${image.product.slug}`);
}
