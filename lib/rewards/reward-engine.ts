import type { RewardParticipantRole, RewardValueType, User } from "@prisma/client";
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

export async function getRewardLevelAdminModels(companyId: string) {
  await ensureDefaultRewardLevels(companyId);

  const [levels, products] = await Promise.all([
    prisma.rewardLevel.findMany({
      where: { companyId },
      include: { rewards: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] } },
      orderBy: { salesThreshold: "asc" }
    }),
    prisma.product.findMany({
      where: { companyId, active: true },
      select: { priceCents: true, internalCostCents: true }
    })
  ]);

  const productCount = Math.max(products.length, 1);
  const averageRevenueCents = Math.round(products.reduce((sum, product) => sum + product.priceCents, 0) / productCount);
  const averageMarginCents = Math.round(
    products.reduce((sum, product) => sum + Math.max(product.priceCents - product.internalCostCents, 0), 0) / productCount
  );

  return levels.map((level) => ({
    ...level,
    projectedRevenueCents: level.salesThreshold * averageRevenueCents,
    projectedMarginCents: level.salesThreshold * averageMarginCents,
    averageRevenueCents,
    averageMarginCents
  }));
}

export async function getRewardProducts(companyId: string) {
  return prisma.product.findMany({
    where: { companyId, active: true },
    select: {
      id: true,
      title: true,
      priceCents: true,
      internalCostCents: true,
      category: { select: { name: true } }
    },
    orderBy: [{ category: { name: "asc" } }, { title: "asc" }]
  });
}

function displayName(user: Pick<User, "firstName" | "lastName" | "email">) {
  return [user.firstName, user.lastName].filter(Boolean).join(" ").trim() || user.email;
}

export async function getSellerSalesCount(input: {
  companyId: string;
  partnerProfileId?: string | null;
  managerProfileId?: string | null;
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

  if (input.managerProfileId) {
    return prisma.order.count({
      where: {
        companyId: input.companyId,
        managerProfileId: input.managerProfileId,
        groupLeaderProfileId: null,
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
  managerProfileId?: string | null;
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
  const [consultants, groupLeaders, managers] = await Promise.all([
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
    prisma.managerProfile.findMany({
      where: { companyId, user: { status: "ACTIVE", isActive: true } },
      include: { user: true },
      orderBy: { createdAt: "asc" }
    })
  ]);

  const consultantRows = await Promise.all(
    consultants.map(async (profile) => ({
      id: profile.id,
      name: displayName(profile.user),
      email: profile.user.email,
      avatarUrl: profile.user.avatarUrl,
      role: "Consultant",
      salesCount: await getSellerSalesCount({ companyId, consultantProfileId: profile.id })
    }))
  );

  const leaderRows = await Promise.all(
    groupLeaders.map(async (profile) => ({
      id: profile.id,
      name: profile.displayName || displayName(profile.user),
      email: profile.user.email,
      avatarUrl: profile.user.avatarUrl,
      role: "Group leader",
      salesCount: await getSellerSalesCount({ companyId, groupLeaderProfileId: profile.id })
    }))
  );

  const managerRows = await Promise.all(
    managers.map(async (profile) => ({
      id: profile.id,
      name: profile.displayName || displayName(profile.user),
      email: profile.user.email,
      avatarUrl: profile.user.avatarUrl,
      role: "Manager",
      salesCount: await getSellerSalesCount({ companyId, managerProfileId: profile.id })
    }))
  );

  const rows = [...consultantRows, ...leaderRows, ...managerRows];
  return rows.sort((a, b) => b.salesCount - a.salesCount).slice(0, 12);
}

export async function getScopedRewardLeaderboard(input: {
  companyId: string;
  partnerProfileId?: string | null;
  managerProfileId?: string | null;
  groupLeaderProfileId?: string | null;
}) {
  const [consultants, groupLeaders, managers] = await Promise.all([
    prisma.consultantProfile.findMany({
      where: {
        companyId: input.companyId,
        user: { status: "ACTIVE", isActive: true },
        ...(input.groupLeaderProfileId
          ? { groupLeaderProfileId: input.groupLeaderProfileId }
          : input.managerProfileId
            ? { managerProfileId: input.managerProfileId }
          : input.partnerProfileId
            ? { partnerProfileId: input.partnerProfileId }
            : {})
      },
      include: { user: true },
      orderBy: { createdAt: "asc" }
    }),
    (input.partnerProfileId || input.managerProfileId) && !input.groupLeaderProfileId
      ? prisma.groupLeaderProfile.findMany({
          where: {
            companyId: input.companyId,
            ...(input.managerProfileId
              ? { managerProfileId: input.managerProfileId }
              : input.partnerProfileId
                ? { partnerProfileId: input.partnerProfileId }
                : {}),
            user: { status: "ACTIVE", isActive: true }
          },
          include: { user: true },
          orderBy: { createdAt: "asc" }
        })
      : Promise.resolve([]),
    input.partnerProfileId && !input.managerProfileId && !input.groupLeaderProfileId
      ? prisma.managerProfile.findMany({
          where: {
            companyId: input.companyId,
            partnerProfileId: input.partnerProfileId,
            user: { status: "ACTIVE", isActive: true }
          },
          include: { user: true },
          orderBy: { createdAt: "asc" }
        })
      : Promise.resolve([])
  ]);

  const consultantRows = await Promise.all(
    consultants.map(async (profile) => ({
      id: profile.id,
      name: displayName(profile.user),
      email: profile.user.email,
      avatarUrl: profile.user.avatarUrl,
      role: "Consultant",
      salesCount: await getSellerSalesCount({ companyId: input.companyId, consultantProfileId: profile.id })
    }))
  );

  const leaderRows = await Promise.all(
    groupLeaders.map(async (profile) => ({
      id: profile.id,
      name: profile.displayName || displayName(profile.user),
      email: profile.user.email,
      avatarUrl: profile.user.avatarUrl,
      role: "Group leader",
      salesCount: await getSellerSalesCount({ companyId: input.companyId, groupLeaderProfileId: profile.id })
    }))
  );

  const managerRows = await Promise.all(
    managers.map(async (profile) => ({
      id: profile.id,
      name: profile.displayName || displayName(profile.user),
      email: profile.user.email,
      avatarUrl: profile.user.avatarUrl,
      role: "Manager",
      salesCount: await getSellerSalesCount({ companyId: input.companyId, managerProfileId: profile.id })
    }))
  );

  const rows = [...consultantRows, ...leaderRows, ...managerRows];
  return rows.sort((a, b) => b.salesCount - a.salesCount).slice(0, 12);
}

export async function getRewardCampaigns(companyId: string) {
  const now = new Date();

  const campaigns = await prisma.rewardCampaign.findMany({
    where: { companyId },
    include: {
      products: {
        include: {
          product: {
            select: {
              id: true,
              title: true,
              priceCents: true,
              internalCostCents: true,
              category: { select: { name: true } }
            }
          }
        },
        orderBy: { createdAt: "asc" }
      }
    },
    orderBy: [{ startsAt: "desc" }, { createdAt: "desc" }]
  });

  return campaigns.map((campaign) => {
    const projectedRevenueCents = campaign.products.reduce(
      (sum, item) => sum + item.product.priceCents * item.targetQuantity,
      0
    );
    const projectedMarginCents = campaign.products.reduce(
      (sum, item) => sum + Math.max(item.product.priceCents - item.product.internalCostCents, 0) * item.targetQuantity,
      0
    );

    return {
      ...campaign,
      isLive: campaign.status === "ACTIVE" && campaign.startsAt <= now && campaign.endsAt >= now,
      projectedRevenueCents,
      projectedMarginCents,
      totalTargetQuantity: campaign.products.reduce((sum, item) => sum + item.targetQuantity, 0)
    };
  });
}

export async function getActiveRewardCampaignProgress(input: {
  companyId: string;
  userId?: string | null;
  managerProfileId?: string | null;
  consultantProfileId?: string | null;
  groupLeaderProfileId?: string | null;
}) {
  const now = new Date();
  const campaigns = await prisma.rewardCampaign.findMany({
    where: {
      companyId: input.companyId,
      status: "ACTIVE",
      startsAt: { lte: now },
      endsAt: { gte: now }
    },
    include: {
      products: {
        include: {
          product: {
            select: {
              id: true,
              title: true,
              priceCents: true,
              internalCostCents: true
            }
          }
        }
      }
    },
    orderBy: { endsAt: "asc" }
  });

  const participant = resolveRewardParticipant(input);

  return Promise.all(
    campaigns.map(async (campaign) => {
      const productIds = campaign.products.map((item) => item.productId);
      const targetQuantity = Math.max(campaign.products.reduce((sum, item) => sum + item.targetQuantity, 0), 1);
      const orderItems = await prisma.orderItem.findMany({
        where: {
          productId: { in: productIds },
          order: {
            companyId: input.companyId,
            ...(input.consultantProfileId
              ? { consultantProfileId: input.consultantProfileId }
              : input.groupLeaderProfileId
                ? { groupLeaderProfileId: input.groupLeaderProfileId, consultantProfileId: null }
                : input.managerProfileId
                  ? { managerProfileId: input.managerProfileId, groupLeaderProfileId: null, consultantProfileId: null }
                  : { id: "00000000-0000-0000-0000-000000000000" }),
            paymentStatus: "CAPTURED",
            createdAt: { gte: campaign.startsAt, lte: campaign.endsAt }
          }
        },
        include: { product: { select: { priceCents: true, internalCostCents: true } } }
      });

      const soldQuantityByProduct = new Map<string, number>();
      for (const item of orderItems) {
        soldQuantityByProduct.set(item.productId, (soldQuantityByProduct.get(item.productId) ?? 0) + item.quantity);
      }
      const productProgress = campaign.products.map((item) => {
        const soldQuantity = soldQuantityByProduct.get(item.productId) ?? 0;
        return {
          productId: item.productId,
          title: item.product.title,
          targetQuantity: item.targetQuantity,
          soldQuantity,
          remainingQuantity: Math.max(item.targetQuantity - soldQuantity, 0),
          isCompleted: soldQuantity >= item.targetQuantity
        };
      });
      const rawSoldQuantity = orderItems.reduce((sum, item) => sum + item.quantity, 0);
      const qualifiedSoldQuantity =
        campaign.goalMode === "PRODUCT_BUNDLE"
          ? productProgress.reduce((sum, item) => sum + Math.min(item.soldQuantity, item.targetQuantity), 0)
          : rawSoldQuantity;
      const revenueCents = orderItems.reduce((sum, item) => sum + item.totalCents, 0);
      const marginCents = orderItems.reduce(
        (sum, item) => sum + Math.max(item.product.priceCents - item.product.internalCostCents, 0) * item.quantity,
        0
      );
      const isCompleted =
        campaign.goalMode === "PRODUCT_BUNDLE"
          ? productProgress.length > 0 && productProgress.every((item) => item.isCompleted)
          : rawSoldQuantity >= targetQuantity;
      const claim = isCompleted && input.userId && participant
        ? await ensureCampaignClaim({
            campaignId: campaign.id,
            companyId: input.companyId,
            userId: input.userId,
            participantRole: participant.role,
            consultantProfileId: input.consultantProfileId ?? null,
            managerProfileId: input.managerProfileId ?? null,
            groupLeaderProfileId: input.groupLeaderProfileId ?? null,
            rewardValueType: campaign.rewardValueType,
            rewardValueCents: campaign.rewardValueCents
          })
        : input.userId
          ? await prisma.rewardCampaignClaim.findUnique({
              where: { campaignId_userId: { campaignId: campaign.id, userId: input.userId } },
              select: { id: true, status: true, rewardValueType: true, rewardValueCents: true }
            })
          : null;

      return {
        ...campaign,
        soldQuantity: qualifiedSoldQuantity,
        rawSoldQuantity,
        targetQuantity,
        productProgress,
        revenueCents,
        marginCents,
        isCompleted,
        claimId: claim?.id ?? null,
        claimStatus: claim?.status ?? null,
        claimRewardValueType: claim?.rewardValueType ?? null,
        claimRewardValueCents: claim?.rewardValueCents ?? null,
        progressPercent: Math.min(Math.round((qualifiedSoldQuantity / targetQuantity) * 100), 100),
        remainingQuantity: Math.max(targetQuantity - qualifiedSoldQuantity, 0)
      };
    })
  );
}

function resolveRewardParticipant(input: {
  managerProfileId?: string | null;
  groupLeaderProfileId?: string | null;
  consultantProfileId?: string | null;
}): { role: RewardParticipantRole } | null {
  if (input.consultantProfileId) return { role: "CONSULTANT" };
  if (input.groupLeaderProfileId) return { role: "GROUP_LEADER" };
  if (input.managerProfileId) return { role: "MANAGER" };
  return null;
}

async function ensureCampaignClaim(input: {
  companyId: string;
  campaignId: string;
  userId: string;
  participantRole: RewardParticipantRole;
  consultantProfileId?: string | null;
  managerProfileId?: string | null;
  groupLeaderProfileId?: string | null;
  rewardValueType: RewardValueType;
  rewardValueCents: number;
}) {
  const existing = await prisma.rewardCampaignClaim.findUnique({
    where: { campaignId_userId: { campaignId: input.campaignId, userId: input.userId } },
    select: { id: true, status: true, rewardValueType: true, rewardValueCents: true }
  });
  if (existing) return existing;

  return prisma.rewardCampaignClaim.create({
    data: {
      companyId: input.companyId,
      campaignId: input.campaignId,
      userId: input.userId,
      participantRole: input.participantRole,
      consultantProfileId: input.consultantProfileId,
      managerProfileId: input.managerProfileId,
      groupLeaderProfileId: input.groupLeaderProfileId,
      rewardValueType: input.rewardValueType,
      rewardValueCents: input.rewardValueCents,
      status: input.rewardValueType === "CASH" ? "PAYOUT_PENDING" : "EARNED"
    },
    select: { id: true, status: true, rewardValueType: true, rewardValueCents: true }
  });
}

export async function getRewardClaimQueue(companyId: string) {
  return prisma.rewardCampaignClaim.findMany({
    where: { companyId, status: { in: ["PAYOUT_PENDING", "REDEEM_REQUESTED"] } },
    include: {
      user: { select: { firstName: true, lastName: true, email: true, avatarUrl: true } },
      campaign: { select: { id: true, title: true, rewardTitle: true, rewardImageUrl: true, rewardValueType: true } }
    },
    orderBy: { createdAt: "desc" }
  });
}

export type RewardCampaignClaimQueueItem = Awaited<ReturnType<typeof getRewardClaimQueue>>[number];
