import type { CommissionParticipantRole, PaymentStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

const CAPTURED: PaymentStatus = "CAPTURED";

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(date: Date) {
  return new Intl.DateTimeFormat("en-US", { month: "short" }).format(date);
}

function recentMonthBuckets(count = 6) {
  const now = new Date();
  return Array.from({ length: count }, (_, index) => {
    const date = startOfMonth(new Date(now.getFullYear(), now.getMonth() - (count - 1 - index), 1));
    return {
      key: monthKey(date),
      month: monthLabel(date),
      revenue: 0,
      earnings: 0
    };
  });
}

function paidOrderWhere(companyId: string) {
  return {
    companyId,
    paymentStatus: CAPTURED
  };
}

function partnerOrderScope(partnerProfileId: string): Prisma.OrderWhereInput {
  return {
    OR: [
      { partnerProfileId },
      { managerProfile: { partnerProfileId } },
      { groupLeaderProfile: { partnerProfileId } },
      { consultantProfile: { partnerProfileId } }
    ]
  };
}

function managerOrderScope(managerProfileId: string): Prisma.OrderWhereInput {
  return {
    OR: [
      { managerProfileId },
      { groupLeaderProfile: { managerProfileId } },
      { consultantProfile: { managerProfileId } },
      { consultantProfile: { groupLeaderProfile: { managerProfileId } } }
    ]
  };
}

function groupLeaderOrderScope(groupLeaderProfileId: string): Prisma.OrderWhereInput {
  return {
    OR: [
      { groupLeaderProfileId },
      { consultantProfile: { groupLeaderProfileId } }
    ]
  };
}

function scopedOrderWhere(input: {
  companyId: string;
  partnerProfileId?: string;
  managerProfileId?: string;
  groupLeaderProfileId?: string;
  consultantProfileId?: string;
}): Prisma.OrderWhereInput {
  if (input.consultantProfileId) {
    return { ...paidOrderWhere(input.companyId), consultantProfileId: input.consultantProfileId };
  }

  if (input.groupLeaderProfileId) {
    return { ...paidOrderWhere(input.companyId), ...groupLeaderOrderScope(input.groupLeaderProfileId) };
  }

  if (input.managerProfileId) {
    return { ...paidOrderWhere(input.companyId), ...managerOrderScope(input.managerProfileId) };
  }

  if (input.partnerProfileId) {
    return { ...paidOrderWhere(input.companyId), ...partnerOrderScope(input.partnerProfileId) };
  }

  return paidOrderWhere(input.companyId);
}

async function revenueSeries(input: {
  companyId: string;
  earningsRole?: CommissionParticipantRole;
  partnerProfileId?: string;
  managerProfileId?: string;
  groupLeaderProfileId?: string;
  consultantProfileId?: string;
}) {
  const buckets = recentMonthBuckets();
  const oldest = startOfMonth(new Date(new Date().getFullYear(), new Date().getMonth() - 5, 1));

  const orders = await prisma.order.findMany({
    where: {
      ...scopedOrderWhere(input),
      createdAt: { gte: oldest },
    },
    select: {
      createdAt: true,
      totalCents: true,
      grossMarginCents: true,
      commissionSplits: {
        where: {
          ...(input.earningsRole ? { participantRole: input.earningsRole } : {}),
          ...(input.partnerProfileId ? { partnerProfileId: input.partnerProfileId } : {}),
          ...(input.managerProfileId ? { managerProfileId: input.managerProfileId } : {}),
          ...(input.groupLeaderProfileId ? { groupLeaderProfileId: input.groupLeaderProfileId } : {}),
          ...(input.consultantProfileId ? { consultantProfileId: input.consultantProfileId } : {})
        },
        select: { amountCents: true }
      }
    }
  });

  const bucketMap = new Map(buckets.map((bucket) => [bucket.key, bucket]));

  for (const order of orders) {
    const bucket = bucketMap.get(monthKey(order.createdAt));
    if (!bucket) continue;

    bucket.revenue += order.totalCents / 100;
    bucket.earnings += input.earningsRole
      ? order.commissionSplits.reduce((sum, split) => sum + split.amountCents, 0) / 100
      : order.grossMarginCents / 100;
  }

  return buckets;
}

async function splitSum(input: {
  companyId: string;
  participantRole: CommissionParticipantRole;
  partnerProfileId?: string;
  managerProfileId?: string;
  groupLeaderProfileId?: string;
  consultantProfileId?: string;
  orderWhere?: Prisma.OrderWhereInput;
}) {
  const result = await prisma.commissionSplit.aggregate({
    where: {
      companyId: input.companyId,
      participantRole: input.participantRole,
      ...(input.partnerProfileId ? { partnerProfileId: input.partnerProfileId } : {}),
      ...(input.managerProfileId ? { managerProfileId: input.managerProfileId } : {}),
      ...(input.groupLeaderProfileId ? { groupLeaderProfileId: input.groupLeaderProfileId } : {}),
      ...(input.consultantProfileId ? { consultantProfileId: input.consultantProfileId } : {}),
      order: input.orderWhere ?? { paymentStatus: CAPTURED }
    },
    _sum: { amountCents: true }
  });

  return result._sum.amountCents ?? 0;
}

async function pendingSplitSum(input: {
  companyId: string;
  participantRole: CommissionParticipantRole;
  partnerProfileId?: string;
  managerProfileId?: string;
  groupLeaderProfileId?: string;
  consultantProfileId?: string;
  orderWhere?: Prisma.OrderWhereInput;
}) {
  const result = await prisma.commissionSplit.aggregate({
    where: {
      companyId: input.companyId,
      participantRole: input.participantRole,
      status: "PENDING",
      ...(input.partnerProfileId ? { partnerProfileId: input.partnerProfileId } : {}),
      ...(input.managerProfileId ? { managerProfileId: input.managerProfileId } : {}),
      ...(input.groupLeaderProfileId ? { groupLeaderProfileId: input.groupLeaderProfileId } : {}),
      ...(input.consultantProfileId ? { consultantProfileId: input.consultantProfileId } : {}),
      order: input.orderWhere ?? { paymentStatus: CAPTURED }
    },
    _sum: { amountCents: true }
  });

  return result._sum.amountCents ?? 0;
}

export async function getAdminDashboardMetrics(companyId: string) {
  const [orders, adminDirectOrders, splitsPending, customers, chartData] = await Promise.all([
    prisma.order.aggregate({
      where: paidOrderWhere(companyId),
      _count: { id: true },
      _sum: { totalCents: true, grossMarginCents: true }
    }),
    prisma.order.aggregate({
      where: {
        ...paidOrderWhere(companyId),
        consultantProfileId: null,
        partnerProfileId: null,
        managerProfileId: null,
        groupLeaderProfileId: null
      },
      _count: { id: true },
      _sum: { totalCents: true, grossMarginCents: true }
    }),
    prisma.commissionSplit.aggregate({
      where: {
        companyId,
        status: "PENDING",
        order: { paymentStatus: CAPTURED }
      },
      _sum: { amountCents: true }
    }),
    prisma.customer.count({ where: { companyId } }),
    revenueSeries({ companyId })
  ]);

  return {
    revenueCents: orders._sum.totalCents ?? 0,
    grossProfitCents: orders._sum.grossMarginCents ?? 0,
    adminDirectRevenueCents: adminDirectOrders._sum.totalCents ?? 0,
    adminDirectProfitCents: adminDirectOrders._sum.grossMarginCents ?? 0,
    adminDirectOrderCount: adminDirectOrders._count.id,
    paidOrderCount: orders._count.id,
    pendingPayoutCents: splitsPending._sum.amountCents ?? 0,
    customerCount: customers,
    chartData
  };
}

export async function getPartnerDashboardMetrics(companyId: string, partnerProfileId: string) {
  const directPartnerOrderWhere: Prisma.OrderWhereInput = {
    ...paidOrderWhere(companyId),
    partnerProfileId,
    managerProfileId: null,
    groupLeaderProfileId: null,
    consultantProfileId: null
  };

  const [orders, directOrders, partnerProfitCents, directProfitCents, downlinePayoutCents, managers, leaders, consultants, chartData] = await Promise.all([
    prisma.order.aggregate({
      where: scopedOrderWhere({ companyId, partnerProfileId }),
      _count: { id: true },
      _sum: { totalCents: true }
    }),
    prisma.order.aggregate({
      where: directPartnerOrderWhere,
      _count: { id: true },
      _sum: { totalCents: true }
    }),
    splitSum({ companyId, participantRole: "PARTNER", partnerProfileId }),
    splitSum({ companyId, participantRole: "PARTNER", partnerProfileId, orderWhere: directPartnerOrderWhere }),
    prisma.commissionSplit.aggregate({
      where: {
        companyId,
        status: "PENDING",
        participantRole: { in: ["MANAGER", "GROUP_LEADER", "CONSULTANT"] },
        partnerProfileId,
        order: { paymentStatus: CAPTURED }
      },
      _sum: { amountCents: true }
    }),
    prisma.managerProfile.count({ where: { partnerProfileId } }),
    prisma.groupLeaderProfile.count({ where: { partnerProfileId } }),
    prisma.consultantProfile.count({ where: { partnerProfileId } }),
    revenueSeries({ companyId, earningsRole: "PARTNER", partnerProfileId })
  ]);

  return {
    revenueCents: orders._sum.totalCents ?? 0,
    personalRevenueCents: directOrders._sum.totalCents ?? 0,
    paidOrderCount: orders._count.id,
    personalOrderCount: directOrders._count.id,
    profitCents: partnerProfitCents,
    personalProfitCents: directProfitCents,
    pendingDownlinePayoutCents: downlinePayoutCents._sum.amountCents ?? 0,
    managerCount: managers,
    leaderCount: leaders,
    consultantCount: consultants,
    chartData
  };
}

export async function getManagerDashboardMetrics(companyId: string, managerProfileId: string) {
  const directManagerOrderWhere: Prisma.OrderWhereInput = {
    ...paidOrderWhere(companyId),
    managerProfileId,
    groupLeaderProfileId: null,
    consultantProfileId: null
  };

  const [orders, directOrders, managerProfitCents, directProfitCents, downlinePayoutCents, leaders, consultants, customers, chartData] = await Promise.all([
    prisma.order.aggregate({
      where: scopedOrderWhere({ companyId, managerProfileId }),
      _count: { id: true },
      _sum: { totalCents: true }
    }),
    prisma.order.aggregate({
      where: directManagerOrderWhere,
      _count: { id: true },
      _sum: { totalCents: true }
    }),
    splitSum({ companyId, participantRole: "MANAGER", managerProfileId }),
    splitSum({ companyId, participantRole: "MANAGER", managerProfileId, orderWhere: directManagerOrderWhere }),
    prisma.commissionSplit.aggregate({
      where: {
        companyId,
        status: "PENDING",
        participantRole: { in: ["GROUP_LEADER", "CONSULTANT"] },
        order: {
          paymentStatus: CAPTURED,
          ...managerOrderScope(managerProfileId)
        }
      },
      _sum: { amountCents: true }
    }),
    prisma.groupLeaderProfile.count({ where: { managerProfileId } }),
    prisma.consultantProfile.count({
      where: {
        OR: [
          { managerProfileId },
          { groupLeaderProfile: { managerProfileId } }
        ]
      }
    }),
    prisma.customer.count({
      where: {
        companyId,
        OR: [
          { managerProfileId },
          { groupLeaderProfile: { managerProfileId } },
          { consultantProfile: { managerProfileId } },
          { consultantProfile: { groupLeaderProfile: { managerProfileId } } }
        ]
      }
    }),
    revenueSeries({ companyId, earningsRole: "MANAGER", managerProfileId })
  ]);

  return {
    revenueCents: orders._sum.totalCents ?? 0,
    personalRevenueCents: directOrders._sum.totalCents ?? 0,
    paidOrderCount: orders._count.id,
    personalOrderCount: directOrders._count.id,
    profitCents: managerProfitCents,
    personalProfitCents: directProfitCents,
    pendingDownlinePayoutCents: downlinePayoutCents._sum.amountCents ?? 0,
    leaderCount: leaders,
    consultantCount: consultants,
    customerCount: customers,
    chartData
  };
}

export async function getGroupLeaderDashboardMetrics(companyId: string, groupLeaderProfileId: string) {
  const directLeaderOrderWhere: Prisma.OrderWhereInput = {
    ...paidOrderWhere(companyId),
    groupLeaderProfileId,
    consultantProfileId: null
  };

  const [orders, directOrders, leaderProfitCents, directProfitCents, consultantPayoutCents, consultants, chartData] = await Promise.all([
    prisma.order.aggregate({
      where: scopedOrderWhere({ companyId, groupLeaderProfileId }),
      _count: { id: true },
      _sum: { totalCents: true }
    }),
    prisma.order.aggregate({
      where: directLeaderOrderWhere,
      _count: { id: true },
      _sum: { totalCents: true }
    }),
    splitSum({ companyId, participantRole: "GROUP_LEADER", groupLeaderProfileId }),
    splitSum({ companyId, participantRole: "GROUP_LEADER", groupLeaderProfileId, orderWhere: directLeaderOrderWhere }),
    pendingSplitSum({ companyId, participantRole: "CONSULTANT", groupLeaderProfileId }),
    prisma.consultantProfile.count({ where: { groupLeaderProfileId } }),
    revenueSeries({ companyId, earningsRole: "GROUP_LEADER", groupLeaderProfileId })
  ]);

  return {
    revenueCents: orders._sum.totalCents ?? 0,
    personalRevenueCents: directOrders._sum.totalCents ?? 0,
    paidOrderCount: orders._count.id,
    personalOrderCount: directOrders._count.id,
    profitCents: leaderProfitCents,
    personalProfitCents: directProfitCents,
    pendingConsultantPayoutCents: consultantPayoutCents,
    consultantCount: consultants,
    chartData
  };
}

export async function getConsultantDashboardMetrics(companyId: string, consultantProfileId: string) {
  const [orders, commissionCents, pendingCommissionCents, customers, chartData, topItems] = await Promise.all([
    prisma.order.aggregate({
      where: {
        ...paidOrderWhere(companyId),
        consultantProfileId
      },
      _count: { id: true },
      _sum: { totalCents: true }
    }),
    splitSum({ companyId, participantRole: "CONSULTANT", consultantProfileId }),
    pendingSplitSum({ companyId, participantRole: "CONSULTANT", consultantProfileId }),
    prisma.customer.count({ where: { companyId, consultantProfileId } }),
    revenueSeries({ companyId, earningsRole: "CONSULTANT", consultantProfileId }),
    prisma.orderItem.findMany({
      where: {
        order: {
          companyId,
          consultantProfileId,
          paymentStatus: CAPTURED
        }
      },
      include: {
        product: {
          select: { title: true }
        }
      },
      orderBy: { order: { createdAt: "desc" } },
      take: 50
    })
  ]);

  const productMap = new Map<string, { title: string; quantity: number; revenueCents: number }>();
  for (const item of topItems) {
    const current = productMap.get(item.productId) ?? { title: item.product.title, quantity: 0, revenueCents: 0 };
    current.quantity += item.quantity;
    current.revenueCents += item.totalCents;
    productMap.set(item.productId, current);
  }

  return {
    revenueCents: orders._sum.totalCents ?? 0,
    paidOrderCount: orders._count.id,
    commissionCents,
    pendingCommissionCents,
    customerCount: customers,
    chartData,
    topProducts: Array.from(productMap.values())
      .sort((a, b) => b.revenueCents - a.revenueCents)
      .slice(0, 5)
  };
}
