import type { RewardClaimStatus, RewardParticipantRole, RewardValueType, User } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

const DAY_MS = 86_400_000;

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
      description: "A small performance credit for agents who build consistent sales activity.",
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
      title: "Go Virtual Health Gear",
      description: "Premium branded gear for agents who consistently convert qualified customers.",
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
      description: "A higher-value reward for agents reaching a meaningful monthly-style milestone.",
      valueCents: 30000,
      imageUrl: ""
    }
  },
  {
    level: 5,
    name: "Elite Agent",
    salesThreshold: 50,
    accentColor: "#DC1F2A",
    reward: {
      title: "Elite Sales Package",
      description: "Premium recognition package for agents producing strong captured order volume.",
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
      description: "Top-tier reward for exceptional sales production. Final reward can be customized by Go Virtual Health.",
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
  return prisma.rewardLevel.findMany({
    where: { companyId, isActive: true },
    include: { rewards: { where: { isActive: true }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] } },
    orderBy: { salesThreshold: "asc" }
  });
}

export async function getRewardLevelAdminModels(companyId: string) {
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

function startOfDay(date: Date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function endOfDay(date: Date) {
  const copy = new Date(date);
  copy.setHours(23, 59, 59, 999);
  return copy;
}

function clampDate(date: Date, min: Date, max: Date) {
  if (date < min) return min;
  if (date > max) return max;
  return date;
}

export async function getAgentSalesCount(input: {
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
  agentName: string;
  avatarUrl?: string | null;
  partnerProfileId?: string | null;
  managerProfileId?: string | null;
  groupLeaderProfileId?: string | null;
  consultantProfileId?: string | null;
}) {
  const [levels, salesCount] = await Promise.all([
    getRewardLevels(input.companyId),
    getAgentSalesCount(input)
  ]);

  const currentLevel = [...levels].reverse().find((level) => salesCount >= level.salesThreshold) ?? null;
  const nextLevel = levels.find((level) => level.salesThreshold > salesCount) ?? null;
  const previousThreshold = currentLevel ? currentLevel.salesThreshold : 0;
  const nextThreshold = nextLevel ? nextLevel.salesThreshold : Math.max(salesCount, previousThreshold);
  const progressDenominator = Math.max(nextThreshold - previousThreshold, 1);
  const progressNumerator = Math.max(Math.min(salesCount - previousThreshold, progressDenominator), 0);
  const progressPercent = nextLevel ? Math.round((progressNumerator / progressDenominator) * 100) : 100;

  return {
    agentName: input.agentName,
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
      role: "Agent",
      salesCount: await getAgentSalesCount({ companyId, consultantProfileId: profile.id })
    }))
  );

  const leaderRows = await Promise.all(
    groupLeaders.map(async (profile) => ({
      id: profile.id,
      name: profile.displayName || displayName(profile.user),
      email: profile.user.email,
      avatarUrl: profile.user.avatarUrl,
      role: "Group leader",
      salesCount: await getAgentSalesCount({ companyId, groupLeaderProfileId: profile.id })
    }))
  );

  const managerRows = await Promise.all(
    managers.map(async (profile) => ({
      id: profile.id,
      name: profile.displayName || displayName(profile.user),
      email: profile.user.email,
      avatarUrl: profile.user.avatarUrl,
      role: "Manager",
      salesCount: await getAgentSalesCount({ companyId, managerProfileId: profile.id })
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
      role: "Agent",
      salesCount: await getAgentSalesCount({ companyId: input.companyId, consultantProfileId: profile.id })
    }))
  );

  const leaderRows = await Promise.all(
    groupLeaders.map(async (profile) => ({
      id: profile.id,
      name: profile.displayName || displayName(profile.user),
      email: profile.user.email,
      avatarUrl: profile.user.avatarUrl,
      role: "Group leader",
      salesCount: await getAgentSalesCount({ companyId: input.companyId, groupLeaderProfileId: profile.id })
    }))
  );

  const managerRows = await Promise.all(
    managers.map(async (profile) => ({
      id: profile.id,
      name: profile.displayName || displayName(profile.user),
      email: profile.user.email,
      avatarUrl: profile.user.avatarUrl,
      role: "Manager",
      salesCount: await getAgentSalesCount({ companyId: input.companyId, managerProfileId: profile.id })
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
      },
      _count: { select: { claims: true } }
    },
    orderBy: [{ startsAt: "desc" }, { createdAt: "desc" }]
  });

  return campaigns.map((campaign) => {
    const bundleRevenueCents = campaign.products.reduce((sum, item) => sum + item.product.priceCents * item.targetQuantity, 0);
    const bundleMarginCents = campaign.products.reduce(
      (sum, item) => sum + Math.max(item.product.priceCents - item.product.internalCostCents, 0) * item.targetQuantity,
      0
    );
    const averageRevenueCents = campaign.products.length
      ? Math.round(campaign.products.reduce((sum, item) => sum + item.product.priceCents, 0) / campaign.products.length)
      : 0;
    const averageMarginCents = campaign.products.length
      ? Math.round(
          campaign.products.reduce((sum, item) => sum + Math.max(item.product.priceCents - item.product.internalCostCents, 0), 0) /
            campaign.products.length
        )
      : 0;
    const totalTargetQuantity =
      campaign.goalMode === "TOTAL_UNITS"
        ? Math.max(campaign.targetQuantity, 1)
        : Math.max(campaign.products.reduce((sum, item) => sum + item.targetQuantity, 0), 1);
    const projectedRevenueCents = campaign.goalMode === "TOTAL_UNITS" ? averageRevenueCents * totalTargetQuantity : bundleRevenueCents;
    const projectedMarginCents = campaign.goalMode === "TOTAL_UNITS" ? averageMarginCents * totalTargetQuantity : bundleMarginCents;

    return {
      ...campaign,
      isLive: campaign.status === "ACTIVE" && campaign.startsAt <= now && campaign.endsAt >= now,
      projectedRevenueCents,
      projectedMarginCents,
      totalTargetQuantity,
      claimCount: campaign._count.claims,
      remainingClaimInventory: campaign.maxTotalClaims == null ? null : Math.max(campaign.maxTotalClaims - campaign._count.claims, 0)
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
      },
      _count: { select: { claims: true } }
    },
    orderBy: { endsAt: "asc" }
  });

  const participant = resolveRewardParticipant(input);

  return Promise.all(
    campaigns.map(async (campaign) => {
      const productIds = campaign.products.map((item) => item.productId);
      const targetQuantity =
        campaign.goalMode === "TOTAL_UNITS"
          ? Math.max(campaign.targetQuantity, 1)
          : Math.max(campaign.products.reduce((sum, item) => sum + item.targetQuantity, 0), 1);
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
        include: {
          order: { select: { createdAt: true } },
          product: { select: { priceCents: true, internalCostCents: true } }
        }
      });

      function buildProgress(selectedItems: typeof orderItems) {
        const soldQuantityByProduct = new Map<string, number>();
        for (const item of selectedItems) {
          soldQuantityByProduct.set(item.productId, (soldQuantityByProduct.get(item.productId) ?? 0) + item.quantity);
        }
        const productProgress = campaign.products.map((item) => {
          const soldQuantity = soldQuantityByProduct.get(item.productId) ?? 0;
          const itemTargetQuantity = campaign.goalMode === "TOTAL_UNITS" ? 1 : item.targetQuantity;
          return {
            productId: item.productId,
            title: item.product.title,
            targetQuantity: itemTargetQuantity,
            soldQuantity,
            remainingQuantity: Math.max(itemTargetQuantity - soldQuantity, 0),
            isCompleted: soldQuantity >= itemTargetQuantity
          };
        });
        const rawSoldQuantity = selectedItems.reduce((sum, item) => sum + item.quantity, 0);
        const qualifiedSoldQuantity =
          campaign.goalMode === "PRODUCT_BUNDLE"
            ? productProgress.reduce((sum, item) => sum + Math.min(item.soldQuantity, item.targetQuantity), 0)
            : rawSoldQuantity;
        const completionCount =
          campaign.goalMode === "PRODUCT_BUNDLE"
            ? productProgress.length
              ? Math.min(...productProgress.map((item) => Math.floor(item.soldQuantity / Math.max(item.targetQuantity, 1))))
              : 0
            : Math.floor(rawSoldQuantity / targetQuantity);
        const revenueCents = selectedItems.reduce((sum, item) => sum + item.totalCents, 0);
        const marginCents = selectedItems.reduce(
          (sum, item) => sum + Math.max(item.product.priceCents - item.product.internalCostCents, 0) * item.quantity,
          0
        );
        const isCompleted = completionCount > 0;

        return { productProgress, rawSoldQuantity, qualifiedSoldQuantity, completionCount, revenueCents, marginCents, isCompleted };
      }

      const rollingWindowDays = Math.max(campaign.rollingWindowDays ?? 1, 1);
      const rollingWindows =
        campaign.windowMode === "ROLLING_DAYS" && orderItems.length
          ? [...new Set(orderItems.map((item) => item.order.createdAt.toISOString()))].map((value) => {
              const end = clampDate(endOfDay(new Date(value)), campaign.startsAt, campaign.endsAt);
              const start = clampDate(startOfDay(new Date(end.getTime() - (rollingWindowDays - 1) * DAY_MS)), campaign.startsAt, campaign.endsAt);
              const selectedItems = orderItems.filter((item) => item.order.createdAt >= start && item.order.createdAt <= end);
              return { startsAt: start, endsAt: end, ...buildProgress(selectedItems) };
            })
          : [];
      const fixedProgress = buildProgress(orderItems);
      const bestRollingWindow = rollingWindows.sort((a, b) => {
        if (Number(b.isCompleted) !== Number(a.isCompleted)) return Number(b.isCompleted) - Number(a.isCompleted);
        if (b.qualifiedSoldQuantity !== a.qualifiedSoldQuantity) return b.qualifiedSoldQuantity - a.qualifiedSoldQuantity;
        return b.marginCents - a.marginCents;
      })[0];
      const selectedProgress = bestRollingWindow ?? fixedProgress;
      const activeWindowStartsAt = bestRollingWindow?.startsAt ?? null;
      const activeWindowEndsAt = bestRollingWindow?.endsAt ?? null;
      const claimInventoryRemaining = campaign.maxTotalClaims == null ? null : Math.max(campaign.maxTotalClaims - campaign._count.claims, 0);
      const claim = selectedProgress.isCompleted && input.userId && participant
        ? await ensureCampaignClaims({
            campaignId: campaign.id,
            companyId: input.companyId,
            userId: input.userId,
            participantRole: participant.role,
            consultantProfileId: input.consultantProfileId ?? null,
            managerProfileId: input.managerProfileId ?? null,
            groupLeaderProfileId: input.groupLeaderProfileId ?? null,
            rewardValueType: campaign.rewardValueType,
            rewardValueCents: campaign.rewardValueCents,
            completionCount: selectedProgress.completionCount,
            maxWinsPerParticipant: campaign.maxWinsPerParticipant,
            claimInventoryRemaining,
            progressWindowStartsAt: activeWindowStartsAt,
            progressWindowEndsAt: activeWindowEndsAt
          })
        : input.userId
          ? await prisma.rewardCampaignClaim.findFirst({
              where: { campaignId: campaign.id, userId: input.userId },
              orderBy: { sequence: "desc" },
              select: { id: true, status: true, rewardValueType: true, rewardValueCents: true }
            })
          : null;

      const [earnedCount, globalClaimCount] = await Promise.all([
        input.userId ? prisma.rewardCampaignClaim.count({ where: { campaignId: campaign.id, userId: input.userId } }) : Promise.resolve(0),
        prisma.rewardCampaignClaim.count({ where: { campaignId: campaign.id } })
      ]);
      const maxWinsPerParticipant = Math.max(campaign.maxWinsPerParticipant, 1);
      const remainingWins = Math.max(maxWinsPerParticipant - earnedCount, 0);
      const remainingClaimInventory = campaign.maxTotalClaims == null ? null : Math.max(campaign.maxTotalClaims - globalClaimCount, 0);

      return {
        ...campaign,
        soldQuantity: selectedProgress.qualifiedSoldQuantity,
        rawSoldQuantity: selectedProgress.rawSoldQuantity,
        targetQuantity,
        productProgress: selectedProgress.productProgress,
        revenueCents: selectedProgress.revenueCents,
        marginCents: selectedProgress.marginCents,
        isCompleted: selectedProgress.isCompleted,
        activeWindowStartsAt,
        activeWindowEndsAt,
        earnedCount,
        maxWinsPerParticipant,
        remainingWins,
        isLimitReached: remainingWins === 0 || remainingClaimInventory === 0,
        maxTotalClaims: campaign.maxTotalClaims,
        claimCount: globalClaimCount,
        remainingClaimInventory,
        claimId: claim?.id ?? null,
        claimStatus: claim?.status ?? null,
        claimRewardValueType: claim?.rewardValueType ?? null,
        claimRewardValueCents: claim?.rewardValueCents ?? null,
        progressPercent: Math.min(Math.round((selectedProgress.qualifiedSoldQuantity / targetQuantity) * 100), 100),
        remainingQuantity: Math.max(targetQuantity - selectedProgress.qualifiedSoldQuantity, 0)
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

async function ensureCampaignClaims(input: {
  companyId: string;
  campaignId: string;
  userId: string;
  participantRole: RewardParticipantRole;
  consultantProfileId?: string | null;
  managerProfileId?: string | null;
  groupLeaderProfileId?: string | null;
  rewardValueType: RewardValueType;
  rewardValueCents: number;
  completionCount: number;
  maxWinsPerParticipant: number;
  claimInventoryRemaining: number | null;
  progressWindowStartsAt?: Date | null;
  progressWindowEndsAt?: Date | null;
}) {
  const existing = await prisma.rewardCampaignClaim.findMany({
    where: { campaignId: input.campaignId, userId: input.userId },
    orderBy: { sequence: "desc" },
    select: { id: true, sequence: true, status: true, rewardValueType: true, rewardValueCents: true }
  });
  const latest = existing[0] ?? null;
  const existingCount = existing.length;
  const participantRemaining = Math.max(input.maxWinsPerParticipant - existingCount, 0);
  const globalRemaining = input.claimInventoryRemaining ?? Number.POSITIVE_INFINITY;
  const creatableCount = Math.max(Math.min(input.completionCount - existingCount, participantRemaining, globalRemaining), 0);

  if (creatableCount <= 0) return latest;

  let created: { id: string; status: RewardClaimStatus; rewardValueType: RewardValueType; rewardValueCents: number } | null = null;
  for (let index = 1; index <= creatableCount; index += 1) {
    created = await prisma.rewardCampaignClaim.create({
      data: {
        companyId: input.companyId,
        campaignId: input.campaignId,
        userId: input.userId,
        participantRole: input.participantRole,
        consultantProfileId: input.consultantProfileId,
        managerProfileId: input.managerProfileId,
        groupLeaderProfileId: input.groupLeaderProfileId,
        sequence: existingCount + index,
        rewardValueType: input.rewardValueType,
        rewardValueCents: input.rewardValueCents,
        progressWindowStartsAt: input.progressWindowStartsAt,
        progressWindowEndsAt: input.progressWindowEndsAt,
        status: input.rewardValueType === "CASH" ? "PAYOUT_PENDING" : "EARNED"
      },
      select: { id: true, status: true, rewardValueType: true, rewardValueCents: true }
    });
  }

  return created ?? latest;
}

export async function getRewardClaimHistory(input: {
  companyId: string;
  userId: string;
}) {
  return prisma.rewardCampaignClaim.findMany({
    where: { companyId: input.companyId, userId: input.userId },
    include: {
      campaign: {
        select: {
          title: true,
          rewardTitle: true,
          rewardImageUrl: true,
          rewardValueType: true
        }
      }
    },
    orderBy: [{ completedAt: "desc" }, { sequence: "desc" }],
    take: 100
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

export async function getPartnerCashRewardPayouts(input: {
  companyId: string;
  partnerProfileId: string;
}) {
  return prisma.rewardCampaignClaim.findMany({
    where: {
      companyId: input.companyId,
      rewardValueType: "CASH",
      status: { in: ["PAYOUT_PENDING", "PAYOUT_APPLIED"] },
      OR: [
        { managerProfile: { partnerProfileId: input.partnerProfileId } },
        { groupLeaderProfile: { partnerProfileId: input.partnerProfileId } },
        { consultantProfile: { partnerProfileId: input.partnerProfileId } }
      ]
    },
    include: {
      user: { select: { firstName: true, lastName: true, email: true, avatarUrl: true } },
      campaign: { select: { id: true, title: true, rewardTitle: true, rewardImageUrl: true } },
      managerProfile: { select: { displayName: true, user: { select: { email: true } } } },
      groupLeaderProfile: { select: { displayName: true, user: { select: { email: true } } } },
      consultantProfile: { select: { user: { select: { firstName: true, lastName: true, email: true } } } }
    },
    orderBy: [{ status: "asc" }, { completedAt: "desc" }],
    take: 250
  });
}

export type PartnerCashRewardPayoutItem = Awaited<ReturnType<typeof getPartnerCashRewardPayouts>>[number];
