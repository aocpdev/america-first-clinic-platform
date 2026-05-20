import type { CommissionParticipantRole, PaymentStatus } from "@prisma/client";
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

async function revenueSeries(input: {
  companyId: string;
  earningsRole?: CommissionParticipantRole;
  partnerProfileId?: string;
  groupLeaderProfileId?: string;
  consultantProfileId?: string;
}) {
  const buckets = recentMonthBuckets();
  const oldest = startOfMonth(new Date(new Date().getFullYear(), new Date().getMonth() - 5, 1));

  const orders = await prisma.order.findMany({
    where: {
      companyId: input.companyId,
      paymentStatus: CAPTURED,
      createdAt: { gte: oldest },
      ...(input.partnerProfileId
        ? {
            OR: [
              { partnerProfileId: input.partnerProfileId },
              { consultantProfile: { partnerProfileId: input.partnerProfileId } }
            ]
          }
        : {}),
      ...(input.groupLeaderProfileId
        ? {
            OR: [
              { groupLeaderProfileId: input.groupLeaderProfileId },
              { consultantProfile: { groupLeaderProfileId: input.groupLeaderProfileId } }
            ]
          }
        : {}),
      ...(input.consultantProfileId ? { consultantProfileId: input.consultantProfileId } : {})
    },
    select: {
      createdAt: true,
      totalCents: true,
      grossMarginCents: true,
      commissionSplits: {
        where: {
          ...(input.earningsRole ? { participantRole: input.earningsRole } : {}),
          ...(input.partnerProfileId ? { partnerProfileId: input.partnerProfileId } : {}),
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
  groupLeaderProfileId?: string;
  consultantProfileId?: string;
}) {
  const result = await prisma.commissionSplit.aggregate({
    where: {
      companyId: input.companyId,
      participantRole: input.participantRole,
      ...(input.partnerProfileId ? { partnerProfileId: input.partnerProfileId } : {}),
      ...(input.groupLeaderProfileId ? { groupLeaderProfileId: input.groupLeaderProfileId } : {}),
      ...(input.consultantProfileId ? { consultantProfileId: input.consultantProfileId } : {}),
      order: { paymentStatus: CAPTURED }
    },
    _sum: { amountCents: true }
  });

  return result._sum.amountCents ?? 0;
}

async function pendingSplitSum(input: {
  companyId: string;
  participantRole: CommissionParticipantRole;
  partnerProfileId?: string;
  groupLeaderProfileId?: string;
  consultantProfileId?: string;
}) {
  const result = await prisma.commissionSplit.aggregate({
    where: {
      companyId: input.companyId,
      participantRole: input.participantRole,
      status: "PENDING",
      ...(input.partnerProfileId ? { partnerProfileId: input.partnerProfileId } : {}),
      ...(input.groupLeaderProfileId ? { groupLeaderProfileId: input.groupLeaderProfileId } : {}),
      ...(input.consultantProfileId ? { consultantProfileId: input.consultantProfileId } : {}),
      order: { paymentStatus: CAPTURED }
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
  const [orders, partnerProfitCents, consultantPayoutCents, leaders, consultants, chartData] = await Promise.all([
    prisma.order.aggregate({
      where: {
        ...paidOrderWhere(companyId),
        OR: [
          { partnerProfileId },
          { consultantProfile: { partnerProfileId } }
        ]
      },
      _count: { id: true },
      _sum: { totalCents: true }
    }),
    splitSum({ companyId, participantRole: "PARTNER", partnerProfileId }),
    pendingSplitSum({ companyId, participantRole: "CONSULTANT", partnerProfileId }),
    prisma.groupLeaderProfile.count({ where: { partnerProfileId } }),
    prisma.consultantProfile.count({ where: { partnerProfileId } }),
    revenueSeries({ companyId, earningsRole: "PARTNER", partnerProfileId })
  ]);

  return {
    revenueCents: orders._sum.totalCents ?? 0,
    paidOrderCount: orders._count.id,
    profitCents: partnerProfitCents,
    pendingConsultantPayoutCents: consultantPayoutCents,
    leaderCount: leaders,
    consultantCount: consultants,
    chartData
  };
}

export async function getGroupLeaderDashboardMetrics(companyId: string, groupLeaderProfileId: string) {
  const [orders, leaderProfitCents, consultantPayoutCents, consultants, chartData] = await Promise.all([
    prisma.order.aggregate({
      where: {
        ...paidOrderWhere(companyId),
        OR: [
          { groupLeaderProfileId },
          { consultantProfile: { groupLeaderProfileId } }
        ]
      },
      _count: { id: true },
      _sum: { totalCents: true }
    }),
    splitSum({ companyId, participantRole: "GROUP_LEADER", groupLeaderProfileId }),
    pendingSplitSum({ companyId, participantRole: "CONSULTANT", groupLeaderProfileId }),
    prisma.consultantProfile.count({ where: { groupLeaderProfileId } }),
    revenueSeries({ companyId, earningsRole: "GROUP_LEADER", groupLeaderProfileId })
  ]);

  return {
    revenueCents: orders._sum.totalCents ?? 0,
    paidOrderCount: orders._count.id,
    profitCents: leaderProfitCents,
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
