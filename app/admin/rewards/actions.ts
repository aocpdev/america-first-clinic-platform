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
