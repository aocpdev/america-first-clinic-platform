import type { CommissionParticipantRole, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import type { DashboardDateRange } from "@/lib/dashboard/date-range";

const CAPTURED = "CAPTURED" as const;

export type ReportRole = "admin" | "partner" | "manager" | "group_leader" | "consultant";
export type ReportExportType = "sales" | "products" | "team";

export type ReportInput = {
  companyId: string;
  role: ReportRole;
  partnerProfileId?: string | null;
  managerProfileId?: string | null;
  groupLeaderProfileId?: string | null;
  consultantProfileId?: string | null;
  dateRange?: DashboardDateRange;
};

const reportOrderInclude = {
  customer: true,
  partnerProfile: { include: { user: true } },
  managerProfile: { include: { user: true, partnerProfile: { include: { user: true } } } },
  groupLeaderProfile: {
    include: {
      user: true,
      partnerProfile: { include: { user: true } },
      managerProfile: { include: { user: true, partnerProfile: { include: { user: true } } } }
    }
  },
  consultantProfile: {
    include: {
      user: true,
      partnerProfile: { include: { user: true } },
      managerProfile: { include: { user: true, partnerProfile: { include: { user: true } } } },
      groupLeaderProfile: {
        include: {
          user: true,
          partnerProfile: { include: { user: true } },
          managerProfile: { include: { user: true, partnerProfile: { include: { user: true } } } }
        }
      }
    }
  },
  items: { include: { product: { select: { title: true, sku: true } } } },
  commissionSplits: true
} satisfies Prisma.OrderInclude;

type ReportOrder = Prisma.OrderGetPayload<{ include: typeof reportOrderInclude }>;

function createdAtFilter(dateRange?: DashboardDateRange): Prisma.DateTimeFilter | undefined {
  if (!dateRange?.from && !dateRange?.to) return undefined;
  return {
    ...(dateRange.from ? { gte: dateRange.from } : {}),
    ...(dateRange.to ? { lte: dateRange.to } : {})
  };
}

function paidOrderWhere(companyId: string, dateRange?: DashboardDateRange): Prisma.OrderWhereInput {
  return {
    companyId,
    paymentStatus: CAPTURED,
    ...(createdAtFilter(dateRange) ? { createdAt: createdAtFilter(dateRange) } : {})
  };
}

function reportOrderWhere(input: ReportInput): Prisma.OrderWhereInput {
  if (input.role === "consultant" && input.consultantProfileId) {
    return { ...paidOrderWhere(input.companyId, input.dateRange), consultantProfileId: input.consultantProfileId };
  }

  if (input.role === "group_leader" && input.groupLeaderProfileId) {
    return {
      ...paidOrderWhere(input.companyId, input.dateRange),
      OR: [
        { groupLeaderProfileId: input.groupLeaderProfileId },
        { consultantProfile: { groupLeaderProfileId: input.groupLeaderProfileId } }
      ]
    };
  }

  if (input.role === "manager" && input.managerProfileId) {
    return {
      ...paidOrderWhere(input.companyId, input.dateRange),
      OR: [
        { managerProfileId: input.managerProfileId },
        { groupLeaderProfile: { managerProfileId: input.managerProfileId } },
        { consultantProfile: { managerProfileId: input.managerProfileId } },
        { consultantProfile: { groupLeaderProfile: { managerProfileId: input.managerProfileId } } }
      ]
    };
  }

  if (input.role === "partner" && input.partnerProfileId) {
    return {
      ...paidOrderWhere(input.companyId, input.dateRange),
      OR: [
        { partnerProfileId: input.partnerProfileId },
        { managerProfile: { partnerProfileId: input.partnerProfileId } },
        { groupLeaderProfile: { partnerProfileId: input.partnerProfileId } },
        { consultantProfile: { partnerProfileId: input.partnerProfileId } }
      ]
    };
  }

  return paidOrderWhere(input.companyId, input.dateRange);
}

function personName(person: { firstName: string | null; lastName: string | null; email?: string | null }) {
  return [person.firstName, person.lastName].filter(Boolean).join(" ").trim() || person.email || "Unassigned";
}

function metadata(order: ReportOrder) {
  const value = order.referralMetadata;
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function originator(order: ReportOrder) {
  const commissionMode = metadata(order)?.commissionMode;
  if (commissionMode === "CONSULTANT_PARTNER_SPLIT") return { name: personName(order.consultantProfile?.user ?? order.customer), role: "Agent" };
  if (commissionMode === "GROUP_LEADER_DIRECT") return { name: personName(order.groupLeaderProfile?.user ?? order.customer), role: "Leader" };
  if (commissionMode === "MANAGER_DIRECT") return { name: personName(order.managerProfile?.user ?? order.customer), role: "Manager" };
  if (commissionMode === "PARTNER_DIRECT") return { name: personName(order.partnerProfile?.user ?? order.customer), role: "Partner" };
  if (commissionMode === "ADMIN_DIRECT") return { name: "Go Virtual Health direct", role: "Go Virtual Health" };

  if (order.consultantProfile) return { name: personName(order.consultantProfile.user), role: "Agent" };
  if (order.groupLeaderProfile) return { name: personName(order.groupLeaderProfile.user), role: "Leader" };
  if (order.managerProfile) return { name: personName(order.managerProfile.user), role: "Manager" };
  if (order.partnerProfile) return { name: personName(order.partnerProfile.user), role: "Partner" };
  return { name: "Go Virtual Health direct", role: "Go Virtual Health" };
}

function splitForRole(order: ReportOrder, input: ReportInput) {
  const roleMap: Partial<Record<ReportRole, CommissionParticipantRole>> = {
    partner: "PARTNER",
    manager: "MANAGER",
    group_leader: "GROUP_LEADER",
    consultant: "CONSULTANT"
  };
  const participantRole = roleMap[input.role];
  if (!participantRole) return order.grossMarginCents;

  return order.commissionSplits
    .filter((split) => split.participantRole === participantRole)
    .filter((split) => !input.partnerProfileId || split.partnerProfileId === input.partnerProfileId)
    .filter((split) => !input.managerProfileId || split.managerProfileId === input.managerProfileId)
    .filter((split) => !input.groupLeaderProfileId || split.groupLeaderProfileId === input.groupLeaderProfileId)
    .filter((split) => !input.consultantProfileId || split.consultantProfileId === input.consultantProfileId)
    .reduce((sum, split) => sum + split.amountCents, 0);
}

function managerForOrder(order: ReportOrder) {
  const profile = order.managerProfile ?? order.groupLeaderProfile?.managerProfile ?? order.consultantProfile?.managerProfile ?? order.consultantProfile?.groupLeaderProfile?.managerProfile ?? null;
  if (!profile) return null;
  return { id: profile.id, name: profile.displayName || personName(profile.user), role: "Manager" };
}

function leaderForOrder(order: ReportOrder) {
  const profile = order.groupLeaderProfile ?? order.consultantProfile?.groupLeaderProfile ?? null;
  if (!profile) return null;
  return { id: profile.id, name: profile.displayName || personName(profile.user), role: "Leader" };
}

function agentForOrder(order: ReportOrder) {
  const profile = order.consultantProfile ?? null;
  if (!profile) return null;
  return { id: profile.id, name: personName(profile.user), role: "Agent" };
}

type PerformanceEntity = {
  id: string;
  name: string;
  role: string;
};

type PerformanceAccumulator = PerformanceEntity & {
  orders: number;
  revenueCents: number;
  earningsCents: number;
  lastSaleAt: Date | null;
};

type TeamReportRow = {
  name: string;
  partnerName: string;
  role: string;
  orders: number;
  revenueCents: number;
  agencyFeeCents: number;
  agentCommissionCents: number;
  partnerOverrideCents: number;
  managerOverrideCents: number;
  leaderOverrideCents: number;
  totalPayoutCents: number;
};

function addPerformanceRow(
  map: Map<string, PerformanceAccumulator>,
  entity: PerformanceEntity | null,
  order: ReportOrder,
  earningsCents: number
) {
  if (!entity) return;
  const key = `${entity.role}:${entity.id}`;
  const current = map.get(key) ?? { ...entity, orders: 0, revenueCents: 0, earningsCents: 0, lastSaleAt: null };
  current.orders += 1;
  current.revenueCents += order.totalCents;
  current.earningsCents += earningsCents;
  current.lastSaleAt = !current.lastSaleAt || order.createdAt > current.lastSaleAt ? order.createdAt : current.lastSaleAt;
  map.set(key, current);
}

function performanceRows(map: Map<string, PerformanceAccumulator>) {
  return Array.from(map.values())
    .map((row) => ({
      ...row,
      averageOrderCents: row.orders ? Math.round(row.revenueCents / row.orders) : 0
    }))
    .sort((a, b) => b.revenueCents - a.revenueCents);
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
    const date = new Date(now.getFullYear(), now.getMonth() - (count - 1 - index), 1);
    return { key: monthKey(date), month: monthLabel(date), revenue: 0, earnings: 0 };
  });
}

function csvEscape(value: string | number) {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll("\"", "\"\"")}"` : text;
}

function directOrder(order: ReportOrder, input: ReportInput) {
  if (input.role === "partner") return Boolean(order.partnerProfileId && !order.managerProfileId && !order.groupLeaderProfileId && !order.consultantProfileId);
  if (input.role === "manager") return Boolean(order.managerProfileId && !order.groupLeaderProfileId && !order.consultantProfileId);
  if (input.role === "group_leader") return Boolean(order.groupLeaderProfileId && !order.consultantProfileId);
  if (input.role === "consultant") return Boolean(order.consultantProfileId);
  return Boolean(!order.partnerProfileId && !order.managerProfileId && !order.groupLeaderProfileId && !order.consultantProfileId);
}

function splitAmount(order: ReportOrder, role: CommissionParticipantRole) {
  return order.commissionSplits
    .filter((split) => split.participantRole === role)
    .reduce((sum, split) => sum + split.amountCents, 0);
}

function agentParticipantRole(role: string): CommissionParticipantRole | null {
  if (role === "Agent") return "CONSULTANT";
  if (role === "Leader") return "GROUP_LEADER";
  if (role === "Manager") return "MANAGER";
  if (role === "Partner") return "PARTNER";
  return null;
}

function partnerForOrder(order: ReportOrder) {
  const profile =
    order.partnerProfile ??
    order.managerProfile?.partnerProfile ??
    order.groupLeaderProfile?.partnerProfile ??
    order.groupLeaderProfile?.managerProfile?.partnerProfile ??
    order.consultantProfile?.partnerProfile ??
    order.consultantProfile?.managerProfile?.partnerProfile ??
    order.consultantProfile?.groupLeaderProfile?.partnerProfile ??
    order.consultantProfile?.groupLeaderProfile?.managerProfile?.partnerProfile ??
    null;

  return profile ? personName(profile.user) : "No partner";
}

export async function getReportData(input: ReportInput) {
  const orders = await prisma.order.findMany({
    where: reportOrderWhere(input),
    include: reportOrderInclude,
    orderBy: { createdAt: "desc" },
    take: 500
  });

  const totalRevenueCents = orders.reduce((sum, order) => sum + order.totalCents, 0);
  const totalEarningsCents = orders.reduce((sum, order) => sum + splitForRole(order, input), 0);
  const totalAgencyFeeCents = input.role === "admin" ? orders.reduce((sum, order) => sum + order.agencyFeeCents, 0) : 0;
  const directRevenueCents = orders.filter((order) => directOrder(order, input)).reduce((sum, order) => sum + order.totalCents, 0);
  const directEarningsCents = orders.filter((order) => directOrder(order, input)).reduce((sum, order) => sum + splitForRole(order, input), 0);

  const productMap = new Map<string, { title: string; sku: string; quantity: number; revenueCents: number }>();
  const teamMap = new Map<string, TeamReportRow>();
  const managerMap = new Map<string, PerformanceAccumulator>();
  const leaderMap = new Map<string, PerformanceAccumulator>();
  const agentMap = new Map<string, PerformanceAccumulator>();
  const bucketMap = new Map(recentMonthBuckets().map((bucket) => [bucket.key, bucket]));

  for (const order of orders) {
    const orderEarningsCents = splitForRole(order, input);
    const bucket = bucketMap.get(monthKey(order.createdAt));
    if (bucket) {
      bucket.revenue += order.totalCents / 100;
      bucket.earnings += orderEarningsCents / 100;
    }

    const agent = originator(order);
    const partnerName = partnerForOrder(order);
    const agentRole = agentParticipantRole(agent.role);
    const partnerAmountCents = splitAmount(order, "PARTNER");
    const managerAmountCents = splitAmount(order, "MANAGER");
    const leaderAmountCents = splitAmount(order, "GROUP_LEADER");
    const agentCommissionCents = agentRole ? splitAmount(order, agentRole) : 0;
    const teamKey = `${partnerName}:${agent.role}:${agent.name}`;
    const teamCurrent = teamMap.get(teamKey) ?? {
      ...agent,
      partnerName,
      orders: 0,
      revenueCents: 0,
      agencyFeeCents: 0,
      agentCommissionCents: 0,
      partnerOverrideCents: 0,
      managerOverrideCents: 0,
      leaderOverrideCents: 0,
      totalPayoutCents: 0
    };
    teamCurrent.orders += 1;
    teamCurrent.revenueCents += order.totalCents;
    teamCurrent.agencyFeeCents += input.role === "admin" ? order.agencyFeeCents : 0;
    teamCurrent.agentCommissionCents += agentCommissionCents;
    teamCurrent.partnerOverrideCents += agentRole === "PARTNER" ? 0 : partnerAmountCents;
    teamCurrent.managerOverrideCents += agentRole === "MANAGER" ? 0 : managerAmountCents;
    teamCurrent.leaderOverrideCents += agentRole === "GROUP_LEADER" ? 0 : leaderAmountCents;
    teamCurrent.totalPayoutCents += partnerAmountCents + managerAmountCents + leaderAmountCents + splitAmount(order, "CONSULTANT");
    teamMap.set(teamKey, teamCurrent);

    addPerformanceRow(managerMap, managerForOrder(order), order, orderEarningsCents);
    addPerformanceRow(leaderMap, leaderForOrder(order), order, orderEarningsCents);
    addPerformanceRow(agentMap, agentForOrder(order), order, orderEarningsCents);

    for (const item of order.items) {
      const current = productMap.get(item.productId) ?? { title: item.product.title, sku: item.product.sku, quantity: 0, revenueCents: 0 };
      current.quantity += item.quantity;
      current.revenueCents += item.totalCents;
      productMap.set(item.productId, current);
    }
  }

  const productRows = Array.from(productMap.values()).sort((a, b) => b.revenueCents - a.revenueCents);
  const teamRows = Array.from(teamMap.values()).sort((a, b) => b.revenueCents - a.revenueCents);
  const managerRows = performanceRows(managerMap);
  const leaderRows = performanceRows(leaderMap);
  const agentRows = performanceRows(agentMap);
  const orderRows = orders.map((order) => {
    const agent = originator(order);
    const agentRole = agentParticipantRole(agent.role);
    const partnerAmountCents = splitAmount(order, "PARTNER");
    const managerAmountCents = splitAmount(order, "MANAGER");
    const leaderAmountCents = splitAmount(order, "GROUP_LEADER");
    const consultantAmountCents = splitAmount(order, "CONSULTANT");
    return {
      id: order.id,
      createdAt: order.createdAt,
      customerName: personName(order.customer),
      customerEmail: order.customer.email,
      agentName: agent.name,
      agentRole: agent.role,
      partnerName: partnerForOrder(order),
      totalCents: order.totalCents,
      agencyFeeCents: input.role === "admin" ? order.agencyFeeCents : 0,
      earningsCents: splitForRole(order, input),
      agentCommissionCents: agentRole ? splitAmount(order, agentRole) : 0,
      partnerOverrideCents: agentRole === "PARTNER" ? 0 : partnerAmountCents,
      managerOverrideCents: agentRole === "MANAGER" ? 0 : managerAmountCents,
      leaderOverrideCents: agentRole === "GROUP_LEADER" ? 0 : leaderAmountCents,
      totalPayoutCents: partnerAmountCents + managerAmountCents + leaderAmountCents + consultantAmountCents,
      products: order.items.map((item) => `${item.quantity}x ${item.product.title}`).join(", ")
    };
  });

  return {
    totalRevenueCents,
    totalEarningsCents,
    totalAgencyFeeCents,
    directRevenueCents,
    directEarningsCents,
    paidOrderCount: orders.length,
    averageOrderCents: orders.length ? Math.round(totalRevenueCents / orders.length) : 0,
    chartData: Array.from(bucketMap.values()),
    topProducts: productRows.slice(0, 8),
    teamRows,
    recentOrders: orderRows.slice(0, 12),
    managerRows,
    leaderRows,
    agentRows,
    exportProducts: productRows,
    exportTeamRows: teamRows,
    exportOrders: orderRows
  };
}

export async function getReportCsv(input: ReportInput, type: ReportExportType) {
  const report = await getReportData(input);
  const partnerPayoutLabel = input.role === "partner" ? "Partner Commission" : "Partner Override";
  const showAgencyFee = input.role === "admin";

  if (type === "products") {
    return [
      ["Product", "SKU", "Quantity", "Revenue"].join(","),
      ...report.exportProducts.map((row) => [row.title, row.sku, row.quantity, (row.revenueCents / 100).toFixed(2)].map(csvEscape).join(","))
    ].join("\n");
  }

  if (type === "team") {
    const headers = ["Agent Name", "Partner", "Role", "Orders", "Revenue", "Agent Commission", partnerPayoutLabel, "Manager Override", "Leader Override", "Total Payout"];
    if (showAgencyFee) headers.push("Agency Fee");
    return [
      headers.join(","),
      ...report.exportTeamRows.map((row) => [
        row.name,
        row.partnerName,
        row.role,
        row.orders,
        (row.revenueCents / 100).toFixed(2),
        (row.agentCommissionCents / 100).toFixed(2),
        (row.partnerOverrideCents / 100).toFixed(2),
        (row.managerOverrideCents / 100).toFixed(2),
        (row.leaderOverrideCents / 100).toFixed(2),
        (row.totalPayoutCents / 100).toFixed(2),
        ...(showAgencyFee ? [(row.agencyFeeCents / 100).toFixed(2)] : [])
      ].map(csvEscape).join(","))
    ].join("\n");
  }

  const headers = [
    "Order ID",
    "Date",
    "Customer",
    "Email",
    "Agent Name",
    "Partner",
    "Role",
    "Products",
    "Revenue",
    "Agent Commission",
    partnerPayoutLabel,
    "Manager Override",
    "Leader Override",
    "Total Payout",
    ...(showAgencyFee ? ["Agency Fee"] : []),
    "Viewer Earnings"
  ];

  return [
    headers.join(","),
    ...report.exportOrders.map((row) => [
      row.id,
      row.createdAt.toISOString(),
      row.customerName,
      row.customerEmail,
      row.agentName,
      row.partnerName,
      row.agentRole,
      row.products,
      (row.totalCents / 100).toFixed(2),
      (row.agentCommissionCents / 100).toFixed(2),
      (row.partnerOverrideCents / 100).toFixed(2),
      (row.managerOverrideCents / 100).toFixed(2),
      (row.leaderOverrideCents / 100).toFixed(2),
      (row.totalPayoutCents / 100).toFixed(2),
      ...(showAgencyFee ? [(row.agencyFeeCents / 100).toFixed(2)] : []),
      (row.earningsCents / 100).toFixed(2)
    ].map(csvEscape).join(","))
  ].join("\n");
}
