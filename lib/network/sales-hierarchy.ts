import type { HierarchyLeaderGroup, HierarchyNode, SalesHierarchyTree } from "@/components/network/sales-hierarchy-view";

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

type GroupLeaderSummary = {
  id: string;
  displayName: string;
  commissionBps: number;
  consultantOverrideBps: number;
  user: UserSummary;
};

type ConsultantSummary = {
  id: string;
  referralSlug: string;
  referralCode: string;
  commissionBps: number;
  partnerProfileId: string | null;
  groupLeaderProfileId: string | null;
  user: UserSummary;
};

type CommissionSplitSummary = {
  participantRole: "PARTNER" | "GROUP_LEADER" | "CONSULTANT";
  amountCents: number;
  partnerProfileId: string | null;
  groupLeaderProfileId: string | null;
  consultantProfileId: string | null;
};

export type HierarchyOrderSummary = {
  totalCents: number;
  partnerProfileId: string | null;
  groupLeaderProfileId: string | null;
  consultantProfileId: string | null;
  consultantProfile: {
    partnerProfileId: string | null;
    groupLeaderProfileId: string | null;
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
      if (role === "GROUP_LEADER" && split.groupLeaderProfileId === profileId) return splitSum + split.amountCents;
      if (role === "CONSULTANT" && split.consultantProfileId === profileId) return splitSum + split.amountCents;
      return splitSum;
    }, 0);

    return sum + splitTotal;
  }, 0);
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

function leaderNode(
  leader: GroupLeaderSummary,
  orders: HierarchyOrderSummary[],
  consultantCount: number,
  visibility: BuildVisibility = {}
): HierarchyNode {
  return {
    id: `leader-${leader.id}`,
    type: "GROUP_LEADER",
    name: leader.displayName,
    email: leader.user.email,
    avatarUrl: leader.user.avatarUrl,
    commissionLabel: `${percentLabel(leader.commissionBps)} direct / ${percentLabel(leader.consultantOverrideBps)} override`,
    revenueCents: sumBy(orders, (order) => leaderOwnsOrder(leader.id, order), (order) => order.totalCents),
    commissionCents: earnedByRole(orders, "GROUP_LEADER", leader.id),
    salesCount: salesCount(orders, (order) => leaderOwnsOrder(leader.id, order)),
    showCommissionSetup: !visibility.hideCommissionSetup,
    subtitle: `${consultantCount} consultants assigned`,
    notes: [
      "Direct sale percent applies when the leader creates the sale.",
      "Override percent applies only to consultants assigned under this leader."
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
  groupLeaders,
  consultants,
  orders,
  visibleGroupLeaderId = null,
  hidePartnerFinancials = false,
  hideCommissionSetup = false
}: {
  partner: PartnerSummary;
  groupLeaders: GroupLeaderSummary[];
  consultants: ConsultantSummary[];
  orders: HierarchyOrderSummary[];
  visibleGroupLeaderId?: string | null;
  hidePartnerFinancials?: boolean;
  hideCommissionSetup?: boolean;
}): SalesHierarchyTree {
  const visibility = { hidePartnerFinancials, hideCommissionSetup };
  const visibleLeaders = visibleGroupLeaderId
    ? groupLeaders.filter((leader) => leader.id === visibleGroupLeaderId)
    : groupLeaders;
  const visibleConsultants = visibleGroupLeaderId
    ? consultants.filter((consultant) => consultant.groupLeaderProfileId === visibleGroupLeaderId)
    : consultants;

  const leaderGroups: HierarchyLeaderGroup[] = visibleLeaders.map((leader) => {
    const leaderConsultants = visibleConsultants.filter((consultant) => consultant.groupLeaderProfileId === leader.id);

    return {
      leader: leaderNode(leader, orders, leaderConsultants.length, visibility),
      consultants: leaderConsultants.map((consultant) => consultantNode(consultant, orders, visibility))
    };
  });

  const directConsultants = visibleGroupLeaderId
    ? []
    : visibleConsultants
        .filter((consultant) => !consultant.groupLeaderProfileId)
        .map((consultant) => consultantNode(consultant, orders, visibility));

  return {
    partner: partnerNode(partner, orders, visibility),
    leaderGroups,
    directConsultants
  };
}
