"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db/prisma";

const levelSchema = z.object({
  levelId: z.string().uuid(),
  name: z.string().min(2),
  salesThreshold: z.coerce.number().int().min(0),
  accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#073763")
});

const rewardSchema = z.object({
  levelId: z.string().uuid(),
  rewardId: z.string().uuid().optional(),
  title: z.string().min(2),
  description: z.string().optional(),
  imageUrl: z.string().url().optional().or(z.literal("")),
  valueDollars: z.coerce.number().min(0)
});

const rewardLevelBundleSchema = levelSchema.merge(
  z.object({
    rewardId: z.string().uuid().optional(),
    rewardTitle: z.string().min(2),
    rewardDescription: z.string().optional(),
    rewardImageUrl: z.string().url().optional().or(z.literal("")),
    rewardValueDollars: z.coerce.number().min(0)
  })
);

const campaignSchema = z
  .object({
    campaignId: z.string().uuid().optional(),
    title: z.string().min(2),
    description: z.string().optional(),
    startsAt: z.coerce.date(),
    endsAt: z.coerce.date(),
    status: z.enum(["DRAFT", "ACTIVE", "PAUSED", "COMPLETED"]),
    rewardTitle: z.string().min(2),
    rewardDescription: z.string().optional(),
    rewardImageUrl: z.string().url().optional().or(z.literal("")),
    rewardValueType: z.enum(["CASH", "NON_CASH"]),
    rewardValueDollars: z.coerce.number().min(0)
  })
  .refine((data) => data.endsAt > data.startsAt, {
    message: "The campaign end date must be after the start date.",
    path: ["endsAt"]
  });

export async function updateRewardLevel(formData: FormData) {
  const user = await requireRole("COMPANY_ADMIN");
  if (!user.companyId) return;

  const parsed = levelSchema.parse({
    levelId: formData.get("levelId"),
    name: formData.get("name"),
    salesThreshold: formData.get("salesThreshold"),
    accentColor: formData.get("accentColor") || "#073763"
  });

  await prisma.rewardLevel.updateMany({
    where: { id: parsed.levelId, companyId: user.companyId },
    data: {
      name: parsed.name,
      salesThreshold: parsed.salesThreshold,
      accentColor: parsed.accentColor
    }
  });

  revalidatePath("/admin/rewards");
}

export async function saveReward(formData: FormData) {
  const user = await requireRole("COMPANY_ADMIN");
  if (!user.companyId) return;

  const parsed = rewardSchema.parse({
    levelId: formData.get("levelId"),
    rewardId: formData.get("rewardId") || undefined,
    title: formData.get("title"),
    description: formData.get("description") || "",
    imageUrl: formData.get("imageUrl") || "",
    valueDollars: formData.get("valueDollars")
  });

  const level = await prisma.rewardLevel.findFirst({
    where: { id: parsed.levelId, companyId: user.companyId },
    select: { id: true, level: true }
  });
  if (!level) return;

  const data = {
    companyId: user.companyId,
    levelId: parsed.levelId,
    title: parsed.title,
    description: parsed.description,
    imageUrl: parsed.imageUrl,
    valueCents: Math.round(parsed.valueDollars * 100),
    sortOrder: level.level
  };

  if (parsed.rewardId) {
    await prisma.reward.updateMany({
      where: { id: parsed.rewardId, companyId: user.companyId },
      data
    });
  } else {
    await prisma.reward.create({ data });
  }

  revalidatePath("/admin/rewards");
  revalidatePath("/consultant/rewards");
  revalidatePath("/partner/rewards");
}

export async function saveRewardLevelBundle(formData: FormData) {
  const user = await requireRole("COMPANY_ADMIN");
  if (!user.companyId) return;

  const parsed = rewardLevelBundleSchema.parse({
    levelId: formData.get("levelId"),
    name: formData.get("name"),
    salesThreshold: formData.get("salesThreshold"),
    accentColor: formData.get("accentColor") || "#073763",
    rewardId: formData.get("rewardId") || undefined,
    rewardTitle: formData.get("rewardTitle"),
    rewardDescription: formData.get("rewardDescription") || "",
    rewardImageUrl: formData.get("rewardImageUrl") || "",
    rewardValueDollars: formData.get("rewardValueDollars")
  });

  const level = await prisma.rewardLevel.findFirst({
    where: { id: parsed.levelId, companyId: user.companyId },
    select: { id: true, level: true }
  });
  if (!level) return;

  await prisma.rewardLevel.update({
    where: { id: level.id },
    data: {
      name: parsed.name,
      salesThreshold: parsed.salesThreshold,
      accentColor: parsed.accentColor
    }
  });

  const rewardData = {
    companyId: user.companyId,
    levelId: level.id,
    title: parsed.rewardTitle,
    description: parsed.rewardDescription,
    imageUrl: parsed.rewardImageUrl,
    valueCents: Math.round(parsed.rewardValueDollars * 100),
    sortOrder: level.level
  };

  if (parsed.rewardId) {
    await prisma.reward.updateMany({
      where: { id: parsed.rewardId, companyId: user.companyId },
      data: rewardData
    });
  } else {
    await prisma.reward.create({ data: rewardData });
  }

  revalidatePath("/admin/rewards");
  revalidatePath("/consultant/rewards");
  revalidatePath("/partner/rewards");
}

export async function saveRewardCampaign(formData: FormData) {
  const user = await requireRole("COMPANY_ADMIN");
  if (!user.companyId) return;

  const parsed = campaignSchema.parse({
    campaignId: formData.get("campaignId") || undefined,
    title: formData.get("title"),
    description: formData.get("description") || "",
    startsAt: formData.get("startsAt"),
    endsAt: formData.get("endsAt"),
    status: formData.get("status") || "ACTIVE",
    rewardTitle: formData.get("rewardTitle"),
    rewardDescription: formData.get("rewardDescription") || "",
    rewardImageUrl: formData.get("rewardImageUrl") || "",
    rewardValueType: formData.get("rewardValueType") || "NON_CASH",
    rewardValueDollars: formData.get("rewardValueDollars")
  });

  const productIds = formData.getAll("productId").map(String).filter(Boolean);
  const uniqueProductIds = [...new Set(productIds)];
  if (uniqueProductIds.length === 0) {
    throw new Error("Select at least one product for the reward campaign.");
  }

  const products = await prisma.product.findMany({
    where: { id: { in: uniqueProductIds }, companyId: user.companyId, active: true },
    select: { id: true }
  });
  const allowedProductIds = new Set(products.map((product) => product.id));
  const campaignProducts = uniqueProductIds
    .filter((productId) => allowedProductIds.has(productId))
    .map((productId) => ({
      productId,
      targetQuantity: Math.max(Number(formData.get(`targetQuantity:${productId}`) || 1), 1)
    }));

  if (campaignProducts.length === 0) {
    throw new Error("Selected products are not available for this company.");
  }

  const data = {
    companyId: user.companyId,
    title: parsed.title,
    description: parsed.description,
    startsAt: parsed.startsAt,
    endsAt: parsed.endsAt,
    status: parsed.status,
    rewardTitle: parsed.rewardTitle,
    rewardDescription: parsed.rewardDescription,
    rewardImageUrl: parsed.rewardImageUrl,
    rewardValueType: parsed.rewardValueType,
    rewardValueCents: Math.round(parsed.rewardValueDollars * 100)
  };

  if (parsed.campaignId) {
    const existingCampaign = await prisma.rewardCampaign.findFirst({
      where: { id: parsed.campaignId, companyId: user.companyId },
      select: { id: true }
    });
    if (!existingCampaign) return;

    await prisma.rewardCampaign.update({
      where: { id: existingCampaign.id },
      data: {
        ...data,
        products: {
          deleteMany: {},
          create: campaignProducts
        }
      }
    });
  } else {
    await prisma.rewardCampaign.create({
      data: {
        ...data,
        products: { create: campaignProducts }
      }
    });
  }

  revalidatePath("/admin/rewards");
  revalidatePath("/consultant/rewards");
  revalidatePath("/partner/rewards");
}
