import type { User } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

export const defaultRewardLevels = [
  {
    level: 1,
    name: "First Close",
    salesThreshold: 1,
    accentColor: "#073763",
    reward: {
      title: "Recognition Badge",
      description: "Unlocked after the first captured sale. Designed to celebrate momentum.",
      valueCents: 2500,
      imageUrl: ""
    }
  },
  {
    level: 2,
    name: "Momentum Builder",
    salesThreshold: 5,
    accentColor: "#0A5EA8",
    reward: {
      title: "Wellness Credit",
      description: "A small performance credit for sellers who build consistent sales activity.",
      valueCents: 7500,
      imageUrl: ""
    }
  },
  {
    level: 3,
    name: "Revenue Driver",
    salesThreshold: 12,
    accentColor: "#0E7C66",
    reward: {
      title: "America First Clinic Gear",
      description: "Premium branded gear for sellers who consistently convert qualified customers.",
      valueCents: 15000,
      imageUrl: ""
    }
  },
  {
    level: 4,
    name: "Closer",
    salesThreshold: 25,
    accentColor: "#B7791F",
    reward: {
      title: "Performance Bonus Gift",
      description: "A higher-value reward for sellers reaching a meaningful monthly-style milestone.",
      valueCents: 30000,
      imageUrl: ""
    }
  },
  {
    level: 5,
    name: "Elite Seller",
    salesThreshold: 50,
    accentColor: "#DC1F2A",
    reward: {
      title: "Elite Sales Package",
      description: "Premium recognition package for sellers producing strong captured order volume.",
      valueCents: 60000,
      imageUrl: ""
    }
  },
  {
    level: 6,
    name: "President's Circle",
    salesThreshold: 100,
    accentColor: "#111827",
    reward: {
      title: "President's Circle Experience",
      description: "Top-tier reward for exceptional sales production. Final reward can be customized by admin.",
      valueCents: 150000,
      imageUrl: ""
    }
  }
] as const;

export async function ensureDefaultRewardLevels(companyId: string) {
  const existing = await prisma.rewardLevel.count({ where: { companyId } });
  if (existing > 0) return;

  for (const item of defaultRewardLevels) {
    const level = await prisma.rewardLevel.create({
      data: {
        companyId,
        level: item.level,
        name: item.name,
        salesThreshold: item.salesThreshold,
        accentColor: item.accentColor
      }
    });

    await prisma.reward.create({
      data: {
        companyId,
        levelId: level.id,
        title: item.reward.title,
        description: item.reward.description,
        valueCents: item.reward.valueCents,
        imageUrl: item.reward.imageUrl,
        sortOrder: item.level
      }
    });
  }
}

export async function getRewardLevels(companyId: string) {
  await ensureDefaultRewardLevels(companyId);

  return prisma.rewardLevel.findMany({
    where: { companyId, isActive: true },
    include: { rewards: { where: { isActive: true }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] } },
    orderBy: { salesThreshold: "asc" }
  });
}

function displayName(user: Pick<User, "firstName" | "lastName" | "email">) {
  return [user.firstName, user.lastName].filter(Boolean).join(" ").trim() || user.email;
}

export async function getSellerSalesCount(input: {
  companyId: string;
  partnerProfileId?: string | null;
  groupLeaderProfileId?: string | null;
  consultantProfileId?: string | null;
}) {
  if (input.consultantProfileId) {
    return prisma.order.count({
      where: { companyId: input.companyId, consultantProfileId: input.consultantProfileId, paymentStatus: "CAPTURED" }
    });
  }

  if (input.groupLeaderProfileId) {
    return prisma.order.count({
      where: {
        companyId: input.companyId,
        groupLeaderProfileId: input.groupLeaderProfileId,
        consultantProfileId: null,
        paymentStatus: "CAPTURED"
      }
    });
  }

  if (input.partnerProfileId) {
    return prisma.order.count({
      where: {
        companyId: input.companyId,
        partnerProfileId: input.partnerProfileId,
        groupLeaderProfileId: null,
        consultantProfileId: null,
        paymentStatus: "CAPTURED"
      }
    });
  }

  return 0;
}

export async function getRewardProgress(input: {
  companyId: string;
  sellerName: string;
  avatarUrl?: string | null;
  partnerProfileId?: string | null;
  groupLeaderProfileId?: string | null;
  consultantProfileId?: string | null;
}) {
  const [levels, salesCount] = await Promise.all([
    getRewardLevels(input.companyId),
    getSellerSalesCount(input)
  ]);

  const currentLevel = [...levels].reverse().find((level) => salesCount >= level.salesThreshold) ?? null;
  const nextLevel = levels.find((level) => level.salesThreshold > salesCount) ?? null;
  const previousThreshold = currentLevel ? currentLevel.salesThreshold : 0;
  const nextThreshold = nextLevel ? nextLevel.salesThreshold : Math.max(salesCount, previousThreshold);
  const progressDenominator = Math.max(nextThreshold - previousThreshold, 1);
  const progressNumerator = Math.max(Math.min(salesCount - previousThreshold, progressDenominator), 0);
  const progressPercent = nextLevel ? Math.round((progressNumerator / progressDenominator) * 100) : 100;

  return {
    sellerName: input.sellerName,
    avatarUrl: input.avatarUrl ?? null,
    salesCount,
    levels,
    currentLevel,
    nextLevel,
    progressPercent,
    salesToNextLevel: nextLevel ? Math.max(nextLevel.salesThreshold - salesCount, 0) : 0,
    earnedRewards: levels.flatMap((level) =>
      salesCount >= level.salesThreshold ? level.rewards.map((reward) => ({ level, reward })) : []
    )
  };
}

export async function getCompanyRewardLeaderboard(companyId: string) {
  const [consultants, leaders, partners] = await Promise.all([
    prisma.consultantProfile.findMany({
      where: { companyId, user: { status: "ACTIVE", isActive: true } },
      include: { user: true },
      orderBy: { createdAt: "asc" }
    }),
    prisma.groupLeaderProfile.findMany({
      where: { companyId, user: { status: "ACTIVE", isActive: true } },
      include: { user: true },
      orderBy: { createdAt: "asc" }
    }),
    prisma.partnerProfile.findMany({
      where: { companyId, user: { status: "ACTIVE", isActive: true } },
      include: { user: true },
      orderBy: { createdAt: "asc" }
    })
  ]);

  const rows = await Promise.all([
    ...consultants.map(async (profile) => ({
      id: profile.id,
      name: displayName(profile.user),
      email: profile.user.email,
      avatarUrl: profile.user.avatarUrl,
      role: "Consultant",
      salesCount: await getSellerSalesCount({ companyId, consultantProfileId: profile.id })
    })),
    ...leaders.map(async (profile) => ({
      id: profile.id,
      name: profile.displayName || displayName(profile.user),
      email: profile.user.email,
      avatarUrl: profile.user.avatarUrl,
      role: "Group leader",
      salesCount: await getSellerSalesCount({ companyId, groupLeaderProfileId: profile.id })
    })),
    ...partners.map(async (profile) => ({
      id: profile.id,
      name: profile.companyName || profile.displayName || displayName(profile.user),
      email: profile.user.email,
      avatarUrl: profile.user.avatarUrl,
      role: "Partner",
      salesCount: await getSellerSalesCount({ companyId, partnerProfileId: profile.id })
    }))
  ]);

  return rows.sort((a, b) => b.salesCount - a.salesCount).slice(0, 12);
}
