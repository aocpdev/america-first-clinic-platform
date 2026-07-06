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
    goalMode: z.enum(["TOTAL_UNITS", "PRODUCT_BUNDLE"]).default("TOTAL_UNITS"),
    windowMode: z.enum(["CAMPAIGN_RANGE", "ROLLING_DAYS"]).default("CAMPAIGN_RANGE"),
    rollingWindowDays: z.coerce.number().int().min(1).max(365).optional(),
    targetQuantity: z.coerce.number().int().min(1).max(999).default(1),
    maxWinsPerParticipant: z.coerce.number().int().min(1).max(999).default(1),
    maxTotalClaims: z.coerce.number().int().min(1).max(9999).optional(),
    rewardTitle: z.string().min(2),
    rewardDescription: z.string().optional(),
    rewardImageUrl: z.string().url().optional().or(z.literal("")),
    rewardValueType: z.enum(["CASH", "NON_CASH"]),
    rewardValueDollars: z.coerce.number().min(0)
  })
  .refine((data) => data.endsAt > data.startsAt, {
    message: "The campaign end date must be after the start date.",
    path: ["endsAt"]
  })
  .refine((data) => data.windowMode === "CAMPAIGN_RANGE" || Boolean(data.rollingWindowDays), {
    message: "Rolling day campaigns need a day window.",
    path: ["rollingWindowDays"]
  });

const deleteCampaignSchema = z.object({
  campaignId: z.string().uuid()
});

export type RewardCampaignActionState = {
  ok: boolean;
  message: string | null;
  error: string | null;
  savedAt: number | null;
};

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

async function persistRewardCampaign(formData: FormData) {
  const user = await requireRole("COMPANY_ADMIN");
  if (!user.companyId) {
    throw new Error("Your Go Virtual Health profile is not connected to a company.");
  }

  const parsed = campaignSchema.parse({
    campaignId: formData.get("campaignId") || undefined,
    title: formData.get("title"),
    description: formData.get("description") || "",
    startsAt: formData.get("startsAt"),
    endsAt: formData.get("endsAt"),
    status: formData.get("status") || "ACTIVE",
    goalMode: formData.get("goalMode") || "TOTAL_UNITS",
    windowMode: formData.get("windowMode") || "CAMPAIGN_RANGE",
    rollingWindowDays: formData.get("rollingWindowDays") || undefined,
    targetQuantity: formData.get("targetQuantity") || 1,
    maxWinsPerParticipant: formData.get("maxWinsPerParticipant") || 1,
    maxTotalClaims: formData.get("maxTotalClaims") || undefined,
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
      targetQuantity:
        parsed.goalMode === "PRODUCT_BUNDLE"
          ? Math.max(Number(formData.get(`targetQuantity:${productId}`) || 1), 1)
          : 1
    }));

  if (campaignProducts.length === 0) {
    throw new Error("Selected products are not available for this company.");
  }

  const totalTargetQuantity =
    parsed.goalMode === "PRODUCT_BUNDLE"
      ? campaignProducts.reduce((sum, item) => sum + item.targetQuantity, 0)
      : parsed.targetQuantity;

  const data = {
    companyId: user.companyId,
    title: parsed.title,
    description: parsed.description,
    startsAt: parsed.startsAt,
    endsAt: parsed.endsAt,
    status: parsed.status,
    goalMode: parsed.goalMode,
    windowMode: parsed.windowMode,
    rollingWindowDays: parsed.windowMode === "ROLLING_DAYS" ? parsed.rollingWindowDays ?? 1 : null,
    targetQuantity: totalTargetQuantity,
    maxWinsPerParticipant: parsed.maxWinsPerParticipant,
    maxTotalClaims: parsed.maxTotalClaims ?? null,
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
    if (!existingCampaign) {
      throw new Error("This reward campaign no longer exists or is not available for your company.");
    }

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
    revalidatePath("/admin/rewards");
    revalidatePath("/consultant/rewards");
    revalidatePath("/partner/rewards");

    return { mode: "updated" as const, title: parsed.title };
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

  return { mode: "created" as const, title: parsed.title };
}

function actionErrorMessage(error: unknown) {
  if (error instanceof z.ZodError) {
    return error.issues[0]?.message ?? "Review the campaign fields and try again.";
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "The campaign could not be saved. Please try again.";
}

export async function saveRewardCampaign(formData: FormData) {
  await persistRewardCampaign(formData);
}

export async function saveRewardCampaignWithState(
  _previousState: RewardCampaignActionState,
  formData: FormData
): Promise<RewardCampaignActionState> {
  try {
    const result = await persistRewardCampaign(formData);

    return {
      ok: true,
      message:
        result.mode === "created"
          ? "Campaign created successfully. Agent progress is now tracking."
          : "Campaign saved successfully. Agent progress has been refreshed.",
      error: null,
      savedAt: Date.now()
    };
  } catch (error) {
    return {
      ok: false,
      message: null,
      error: actionErrorMessage(error),
      savedAt: Date.now()
    };
  }
}

export async function deleteRewardCampaign(formData: FormData) {
  const user = await requireRole("COMPANY_ADMIN");
  if (!user.companyId) return;

  const parsed = deleteCampaignSchema.parse({
    campaignId: formData.get("campaignId")
  });

  await prisma.rewardCampaign.deleteMany({
    where: {
      id: parsed.campaignId,
      companyId: user.companyId
    }
  });

  revalidatePath("/admin/rewards");
  revalidatePath("/consultant/rewards");
  revalidatePath("/partner/rewards");
}

export async function markRewardPayoutApplied(formData: FormData) {
  const user = await requireRole("COMPANY_ADMIN");
  if (!user.companyId) return;

  const claimId = String(formData.get("claimId") ?? "");
  if (!claimId) return;

  await prisma.rewardCampaignClaim.updateMany({
    where: {
      id: claimId,
      companyId: user.companyId,
      status: "PAYOUT_PENDING",
      rewardValueType: "CASH"
    },
    data: {
      status: "PAYOUT_APPLIED",
      payoutAppliedAt: new Date()
    }
  });

  revalidatePath("/admin/rewards");
  revalidatePath("/consultant/rewards");
  revalidatePath("/partner/rewards");
}

export async function fulfillRewardClaim(formData: FormData) {
  const user = await requireRole("COMPANY_ADMIN");
  if (!user.companyId) return;

  const claimId = String(formData.get("claimId") ?? "");
  if (!claimId) return;

  await prisma.rewardCampaignClaim.updateMany({
    where: {
      id: claimId,
      companyId: user.companyId,
      status: "REDEEM_REQUESTED"
    },
    data: {
      status: "FULFILLED",
      fulfilledAt: new Date()
    }
  });

  revalidatePath("/admin/rewards");
  revalidatePath("/consultant/rewards");
  revalidatePath("/partner/rewards");
}
