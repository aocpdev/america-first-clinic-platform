import type { HierarchyLeaderGroup, HierarchyManagerGroup, HierarchyNode, SalesHierarchyTree } from "@/components/network/sales-hierarchy-view";

type UserSummary = {
  firstName: string | null;
  lastName: string | null;
  email: string;
  avatarUrl: string | null;
};

type PartnerSummary = {
  id: string;
  displayName: string;
  companyName: string | null;
  commissionBps: number;
  user: UserSummary;
};

type ManagerSummary = {
  id: string;
  displayName: string;
  commissionBps: number;
  leaderOverrideBps: number;
  user: UserSummary;
};

type GroupLeaderSummary = {
  id: string;
  displayName: string;
  commissionBps: number;
  consultantOverrideBps: number;
  managerProfileId: string | null;
  user: UserSummary;
};

type ConsultantSummary = {
  id: string;
  referralSlug: string;
  referralCode: string;
  commissionBps: number;
  partnerProfileId: string | null;
  managerProfileId: string | null;
  groupLeaderProfileId: string | null;
  user: UserSummary;
};

type CommissionSplitSummary = {
  participantRole: "PARTNER" | "MANAGER" | "GROUP_LEADER" | "CONSULTANT";
  amountCents: number;
  partnerProfileId: string | null;
  managerProfileId: string | null;
  groupLeaderProfileId: string | null;
  consultantProfileId: string | null;
};

export type HierarchyOrderSummary = {
  totalCents: number;
  partnerProfileId: string | null;
  managerProfileId: string | null;
  groupLeaderProfileId: string | null;
  consultantProfileId: string | null;
  consultantProfile: {
    partnerProfileId: string | null;
    managerProfileId: string | null;
    groupLeaderProfileId: string | null;
  } | null;
  groupLeaderProfile?: {
    managerProfileId: string | null;
  } | null;
  commissionSplits: CommissionSplitSummary[];
};

type BuildVisibility = {
  hidePartnerFinancials?: boolean;
  hideCommissionSetup?: boolean;
};

export function percentLabel(bps: number) {
  return `${bps / 100}%`;
}

export function displayPersonName(user: Pick<UserSummary, "firstName" | "lastName" | "email">) {
  return [user.firstName, user.lastName].filter(Boolean).join(" ").trim() || user.email;
}

function sumBy<T>(items: T[], predicate: (item: T) => boolean, amount: (item: T) => number) {
  return items.reduce((sum, item) => (predicate(item) ? sum + amount(item) : sum), 0);
}

function salesCount(orders: HierarchyOrderSummary[], predicate: (order: HierarchyOrderSummary) => boolean) {
  return orders.filter(predicate).length;
}

function partnerOwnsOrder(partnerId: string, order: HierarchyOrderSummary) {
  return order.partnerProfileId === partnerId || order.consultantProfile?.partnerProfileId === partnerId;
}

function leaderOwnsOrder(leaderId: string, order: HierarchyOrderSummary) {
  return order.groupLeaderProfileId === leaderId || order.consultantProfile?.groupLeaderProfileId === leaderId;
}

function managerOwnsOrder(managerId: string, order: HierarchyOrderSummary) {
  return (
    order.managerProfileId === managerId ||
    order.groupLeaderProfile?.managerProfileId === managerId ||
    order.consultantProfile?.managerProfileId === managerId
  );
}

function managerPersonalOrder(managerId: string, order: HierarchyOrderSummary) {
  return order.managerProfileId === managerId && !order.groupLeaderProfileId && !order.consultantProfileId;
}

function leaderPersonalOrder(leaderId: string, order: HierarchyOrderSummary) {
  return order.groupLeaderProfileId === leaderId && !order.consultantProfileId;
}

function consultantOwnsOrder(consultantId: string, order: HierarchyOrderSummary) {
  return order.consultantProfileId === consultantId;
}

function earnedByRole(
  orders: HierarchyOrderSummary[],
  role: CommissionSplitSummary["participantRole"],
  profileId: string
) {
  return orders.reduce((sum, order) => {
    const splitTotal = order.commissionSplits.reduce((splitSum, split) => {
      if (split.participantRole !== role) return splitSum;
      if (role === "PARTNER" && split.partnerProfileId === profileId) return splitSum + split.amountCents;
      if (role === "MANAGER" && split.managerProfileId === profileId) return splitSum + split.amountCents;
      if (role === "GROUP_LEADER" && split.groupLeaderProfileId === profileId) return splitSum + split.amountCents;
      if (role === "CONSULTANT" && split.consultantProfileId === profileId) return splitSum + split.amountCents;
      return splitSum;
    }, 0);

    return sum + splitTotal;
  }, 0);
}

function earnedByRoleForOrders(
  orders: HierarchyOrderSummary[],
  role: CommissionSplitSummary["participantRole"],
  profileId: string,
  orderPredicate: (order: HierarchyOrderSummary) => boolean
) {
  return earnedByRole(orders.filter(orderPredicate), role, profileId);
}

function partnerNode(partner: PartnerSummary, orders: HierarchyOrderSummary[], visibility: BuildVisibility = {}): HierarchyNode {
  return {
    id: `partner-${partner.id}`,
    type: "PARTNER",
    name: partner.companyName || partner.displayName,
    email: partner.user.email,
    avatarUrl: partner.user.avatarUrl,
    commissionLabel: visibility.hidePartnerFinancials ? "Organization" : `${percentLabel(partner.commissionBps)} margin pool`,
    revenueCents: sumBy(orders, (order) => partnerOwnsOrder(partner.id, order), (order) => order.totalCents),
    commissionCents: visibility.hidePartnerFinancials ? 0 : earnedByRole(orders, "PARTNER", partner.id),
    salesCount: salesCount(orders, (order) => partnerOwnsOrder(partner.id, order)),
    showCommissionMetric: !visibility.hidePartnerFinancials,
    showCommissionSetup: !visibility.hidePartnerFinancials,
    subtitle: `Partner owner: ${displayPersonName(partner.user)}`,
    notes: visibility.hidePartnerFinancials
      ? ["This view only includes your assigned team activity."]
      : ["Can view leaders, consultants, sales, and partner-level earned commission."]
  };
}

function managerNode(
  manager: ManagerSummary,
  orders: HierarchyOrderSummary[],
  leaderCount: number,
  directConsultantCount: number,
  visibility: BuildVisibility = {}
): HierarchyNode {
  const totalEarned = earnedByRole(orders, "MANAGER", manager.id);
  const personalEarned = earnedByRoleForOrders(orders, "MANAGER", manager.id, (order) => managerPersonalOrder(manager.id, order));

  return {
    id: `manager-${manager.id}`,
    type: "MANAGER",
    name: manager.displayName,
    email: manager.user.email,
    avatarUrl: manager.user.avatarUrl,
    commissionLabel: `${percentLabel(manager.commissionBps)} direct from partner pool / ${percentLabel(manager.leaderOverrideBps)} team override from partner pool`,
    revenueCents: sumBy(orders, (order) => managerOwnsOrder(manager.id, order), (order) => order.totalCents),
    commissionCents: totalEarned,
    personalCommissionCents: personalEarned,
    groupCommissionCents: Math.max(0, totalEarned - personalEarned),
    salesCount: salesCount(orders, (order) => managerOwnsOrder(manager.id, order)),
    showCommissionSetup: !visibility.hideCommissionSetup,
    subtitle: `${leaderCount} leaders and ${directConsultantCount} direct consultants assigned`,
    notes: [
      "Direct sale percent is paid from this partner's margin pool when the manager creates the sale.",
      "Team override percent is paid from the partner pool when assigned leaders close direct sales."
    ]
  };
}

function leaderNode(
  leader: GroupLeaderSummary,
  orders: HierarchyOrderSummary[],
  consultantCount: number,
  visibility: BuildVisibility = {}
): HierarchyNode {
  const totalEarned = earnedByRole(orders, "GROUP_LEADER", leader.id);
  const personalEarned = earnedByRoleForOrders(orders, "GROUP_LEADER", leader.id, (order) => leaderPersonalOrder(leader.id, order));

  return {
    id: `leader-${leader.id}`,
    type: "GROUP_LEADER",
    name: leader.displayName,
    email: leader.user.email,
    avatarUrl: leader.user.avatarUrl,
    commissionLabel: `${percentLabel(leader.commissionBps)} direct from partner pool / ${percentLabel(leader.consultantOverrideBps)} team override from partner pool`,
    revenueCents: sumBy(orders, (order) => leaderOwnsOrder(leader.id, order), (order) => order.totalCents),
    commissionCents: totalEarned,
    personalCommissionCents: personalEarned,
    groupCommissionCents: Math.max(0, totalEarned - personalEarned),
    salesCount: salesCount(orders, (order) => leaderOwnsOrder(leader.id, order)),
    showCommissionSetup: !visibility.hideCommissionSetup,
    subtitle: `${consultantCount} consultants assigned`,
    notes: [
      "Direct sale percent is paid from this partner's margin pool when the leader creates the sale.",
      "Team override percent is paid from the partner pool when assigned sellers close sales."
    ]
  };
}

function consultantNode(
  consultant: ConsultantSummary,
  orders: HierarchyOrderSummary[],
  visibility: BuildVisibility = {}
): HierarchyNode {
  return {
    id: `consultant-${consultant.id}`,
    type: "CONSULTANT",
    name: displayPersonName(consultant.user),
    email: consultant.user.email,
    avatarUrl: consultant.user.avatarUrl,
    commissionLabel: `${percentLabel(consultant.commissionBps)} of partner pool`,
    revenueCents: sumBy(orders, (order) => consultantOwnsOrder(consultant.id, order), (order) => order.totalCents),
    commissionCents: earnedByRole(orders, "CONSULTANT", consultant.id),
    salesCount: salesCount(orders, (order) => consultantOwnsOrder(consultant.id, order)),
    showCommissionSetup: !visibility.hideCommissionSetup,
    subtitle: `Referral /c/${consultant.referralSlug}`,
    notes: [`Referral code: ${consultant.referralCode}`]
  };
}

export function buildSalesHierarchyTree({
  partner,
  managers,
  groupLeaders,
  consultants,
  orders,
  visibleManagerId = null,
  visibleGroupLeaderId = null,
  hidePartnerFinancials = false,
  hideCommissionSetup = false
}: {
  partner: PartnerSummary;
  managers?: ManagerSummary[];
  groupLeaders: GroupLeaderSummary[];
  consultants: ConsultantSummary[];
  orders: HierarchyOrderSummary[];
  visibleManagerId?: string | null;
  visibleGroupLeaderId?: string | null;
  hidePartnerFinancials?: boolean;
  hideCommissionSetup?: boolean;
}): SalesHierarchyTree {
  const visibility = { hidePartnerFinancials, hideCommissionSetup };
  const allManagers = managers ?? [];
  const scopedManagers = visibleManagerId ? allManagers.filter((manager) => manager.id === visibleManagerId) : allManagers;
  const scopedLeaders = visibleGroupLeaderId
    ? groupLeaders.filter((leader) => leader.id === visibleGroupLeaderId)
    : visibleManagerId
      ? groupLeaders.filter((leader) => leader.managerProfileId === visibleManagerId)
      : groupLeaders;
  const scopedConsultants = visibleGroupLeaderId
    ? consultants.filter((consultant) => consultant.groupLeaderProfileId === visibleGroupLeaderId)
    : visibleManagerId
      ? consultants.filter((consultant) => consultant.managerProfileId === visibleManagerId || scopedLeaders.some((leader) => leader.id === consultant.groupLeaderProfileId))
      : consultants;

  function makeLeaderGroup(leader: GroupLeaderSummary): HierarchyLeaderGroup {
    const leaderConsultants = scopedConsultants.filter((consultant) => consultant.groupLeaderProfileId === leader.id);

    return {
      leader: leaderNode(leader, orders, leaderConsultants.length, visibility),
      consultants: leaderConsultants.map((consultant) => consultantNode(consultant, orders, visibility))
    };
  }

  const managerGroups: HierarchyManagerGroup[] = visibleGroupLeaderId
    ? []
    : scopedManagers.map((manager) => {
        const managerLeaders = scopedLeaders.filter((leader) => leader.managerProfileId === manager.id);
        const directManagerConsultants = scopedConsultants.filter(
          (consultant) => consultant.managerProfileId === manager.id && !consultant.groupLeaderProfileId
        );

        return {
          manager: managerNode(manager, orders, managerLeaders.length, directManagerConsultants.length, visibility),
          leaderGroups: managerLeaders.map(makeLeaderGroup),
          directConsultants: directManagerConsultants.map((consultant) => consultantNode(consultant, orders, visibility))
        };
      });

  const directLeaderGroups: HierarchyLeaderGroup[] = scopedLeaders
    .filter((leader) => (visibleGroupLeaderId ? true : !leader.managerProfileId))
    .map(makeLeaderGroup);

  const directConsultants = visibleGroupLeaderId
    ? []
    : scopedConsultants
        .filter((consultant) => !consultant.groupLeaderProfileId && !consultant.managerProfileId)
        .map((consultant) => consultantNode(consultant, orders, visibility));

  return {
    partner: partnerNode(partner, orders, visibility),
    managerGroups,
    directLeaderGroups,
    directConsultants
  };
}
