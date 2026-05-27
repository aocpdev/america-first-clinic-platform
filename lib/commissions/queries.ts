import type { CommissionParticipantRole, CommissionStatus, Prisma } from "@prisma/client";

import type { Role } from "@/lib/auth/roles";
import { prisma } from "@/lib/db/prisma";

export type CommissionLedgerScope = "admin" | "partner" | "manager" | "group_leader" | "consultant";

export type CommissionLedgerEntry = {
  id: string;
  orderId: string;
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  participantRole: CommissionParticipantRole;
  participantName: string;
  participantEmail: string;
  amountCents: number;
  grossMarginCents: number;
  commissionPoolCents: number;
  orderTotalCents: number;
  status: CommissionStatus;
  payoutResponsibility: string;
  paidAt: Date | null;
  createdAt: Date;
};

const commissionSplitInclude = {
  order: {
    include: {
      customer: true
    }
  },
  partnerProfile: {
    include: { user: true }
  },
  managerProfile: {
    include: { user: true }
  },
  groupLeaderProfile: {
    include: { user: true }
  },
  consultantProfile: {
    include: { user: true }
  }
} satisfies Prisma.CommissionSplitInclude;

type CommissionSplitWithRelations = Prisma.CommissionSplitGetPayload<{
  include: typeof commissionSplitInclude;
}>;

function personName(person?: { firstName?: string | null; lastName?: string | null; email?: string | null } | null) {
  const name = [person?.firstName, person?.lastName].filter(Boolean).join(" ").trim();
  return name || person?.email || "Unassigned";
}

function orderNumber(orderId: string) {
  return `#${orderId.slice(0, 8).toUpperCase()}`;
}

function participantFor(split: CommissionSplitWithRelations) {
  if (split.participantRole === "PARTNER") {
    return {
      name: split.partnerProfile?.displayName || personName(split.partnerProfile?.user),
      email: split.partnerProfile?.user.email || ""
    };
  }

  if (split.participantRole === "MANAGER") {
    return {
      name: split.managerProfile?.displayName || personName(split.managerProfile?.user),
      email: split.managerProfile?.user.email || ""
    };
  }

  if (split.participantRole === "GROUP_LEADER") {
    return {
      name: split.groupLeaderProfile?.displayName || personName(split.groupLeaderProfile?.user),
      email: split.groupLeaderProfile?.user.email || ""
    };
  }

  return {
    name: personName(split.consultantProfile?.user),
    email: split.consultantProfile?.user.email || ""
  };
}

export function mapCommissionSplit(split: CommissionSplitWithRelations): CommissionLedgerEntry {
  const participant = participantFor(split);

  return {
    id: split.id,
    orderId: split.orderId,
    orderNumber: orderNumber(split.orderId),
    customerName: personName(split.order.customer),
    customerEmail: split.order.customer.email,
    participantRole: split.participantRole,
    participantName: participant.name,
    participantEmail: participant.email,
    amountCents: split.amountCents,
    grossMarginCents: split.grossMarginCents,
    commissionPoolCents: split.commissionPoolCents,
    orderTotalCents: split.order.totalCents,
    status: split.status,
    payoutResponsibility: split.payoutResponsibility,
    paidAt: split.paidAt,
    createdAt: split.createdAt
  };
}

export async function getAdminCommissionLedger(companyId?: string | null) {
  const splits = await prisma.commissionSplit.findMany({
    where: companyId ? { companyId } : undefined,
    include: commissionSplitInclude,
    orderBy: { createdAt: "desc" },
    take: 500
  });

  return splits.map(mapCommissionSplit);
}

export async function getPartnerCommissionLedger(user: {
  id: string;
  role: Role;
  companyId: string | null;
  partnerProfile?: { id: string } | null;
  managerProfile?: { id: string; partnerProfileId: string } | null;
  groupLeaderProfile?: { id: string; partnerProfileId: string; managerProfileId?: string | null } | null;
}) {
  const companyFilter = user.companyId ? { companyId: user.companyId } : {};
  let where: Prisma.CommissionSplitWhereInput | null = null;

  if (user.role === "PARTNER" && user.partnerProfile) {
    where = {
      ...companyFilter,
      order: {
        OR: [
          { partnerProfileId: user.partnerProfile.id },
          { managerProfile: { partnerProfileId: user.partnerProfile.id } },
          { groupLeaderProfile: { partnerProfileId: user.partnerProfile.id } },
          { consultantProfile: { partnerProfileId: user.partnerProfile.id } }
        ]
      }
    };
  }

  if (user.role === "MANAGER" && user.managerProfile) {
    where = {
      ...companyFilter,
      order: {
        OR: [
          { managerProfileId: user.managerProfile.id },
          { groupLeaderProfile: { managerProfileId: user.managerProfile.id } },
          { consultantProfile: { managerProfileId: user.managerProfile.id } },
          { consultantProfile: { groupLeaderProfile: { managerProfileId: user.managerProfile.id } } }
        ]
      }
    };
  }

  if (user.role === "GROUP_LEADER" && user.groupLeaderProfile) {
    where = {
      ...companyFilter,
      order: {
        OR: [
          { groupLeaderProfileId: user.groupLeaderProfile.id },
          { consultantProfile: { groupLeaderProfileId: user.groupLeaderProfile.id } }
        ]
      }
    };
  }

  if (!where) return [];

  const splits = await prisma.commissionSplit.findMany({
    where,
    include: commissionSplitInclude,
    orderBy: { createdAt: "desc" },
    take: 500
  });

  return splits.map(mapCommissionSplit);
}

export async function getConsultantCommissionLedger(user: {
  id: string;
  companyId: string | null;
  consultantProfile?: { id: string } | null;
}) {
  if (!user.consultantProfile) return [];

  const splits = await prisma.commissionSplit.findMany({
    where: {
      ...(user.companyId ? { companyId: user.companyId } : {}),
      consultantProfileId: user.consultantProfile.id,
      participantRole: "CONSULTANT"
    },
    include: commissionSplitInclude,
    orderBy: { createdAt: "desc" },
    take: 500
  });

  return splits.map(mapCommissionSplit);
}
