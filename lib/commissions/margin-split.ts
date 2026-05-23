import { CommissionStatus, type PrismaClient } from "@prisma/client";

export const DEFAULT_MARGIN_POOL_BPS = 2500;
export const DEFAULT_PARTNER_SPLIT_BPS = 5000;
export const DEFAULT_GROUP_LEADER_SHARE_BPS = 2500;
export const DEFAULT_CONSULTANT_SHARE_BPS = 5000;
export const MAX_GROUP_LEADER_POOL_SHARE_BPS = 5000;

export function clampGroupLeaderPoolShareBps(value: number | null | undefined) {
  return Math.max(0, Math.min(MAX_GROUP_LEADER_POOL_SHARE_BPS, value ?? 0));
}

export function calculateMarginCommissionSplit({
  subtotalCents,
  internalCostCents,
  poolBps = DEFAULT_MARGIN_POOL_BPS,
  partnerSplitBps = DEFAULT_PARTNER_SPLIT_BPS,
  partnerPoolBps,
  groupLeaderShareBps = 0,
  consultantShareBps
}: {
  subtotalCents: number;
  internalCostCents: number;
  poolBps?: number;
  partnerSplitBps?: number;
  partnerPoolBps?: number;
  groupLeaderShareBps?: number;
  consultantShareBps?: number;
}) {
  const grossMarginCents = Math.max(0, subtotalCents - internalCostCents);
  const effectivePoolBps = partnerPoolBps ?? poolBps;
  const effectiveGroupLeaderShareBps = clampGroupLeaderPoolShareBps(groupLeaderShareBps);
  const commissionPoolCents = Math.round((grossMarginCents * effectivePoolBps) / 10000);
  const legacyPartnerAmountCents = Math.round((commissionPoolCents * partnerSplitBps) / 10000);
  const groupLeaderAmountCents = Math.round((commissionPoolCents * effectiveGroupLeaderShareBps) / 10000);
  const consultantAmountCents = consultantShareBps == null
    ? commissionPoolCents - legacyPartnerAmountCents
    : Math.round((commissionPoolCents * consultantShareBps) / 10000);
  const partnerAmountCents = partnerPoolBps == null && consultantShareBps == null && groupLeaderShareBps === 0
    ? legacyPartnerAmountCents
    : Math.max(0, commissionPoolCents - groupLeaderAmountCents - consultantAmountCents);

  return {
    grossMarginCents,
    commissionPoolCents,
    partnerAmountCents,
    groupLeaderAmountCents,
    consultantAmountCents
  };
}

export async function createMarginCommissionLedger({
  prisma,
  orderId,
  status = CommissionStatus.PENDING,
  commissionMode = "CONSULTANT_PARTNER_SPLIT"
}: {
  prisma: PrismaClient;
  orderId: string;
  status?: CommissionStatus;
  commissionMode?: "CONSULTANT_PARTNER_SPLIT" | "PARTNER_DIRECT" | "GROUP_LEADER_DIRECT" | "ADMIN_DIRECT";
}) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      items: {
        include: { product: true }
      },
      consultantProfile: {
        include: { partnerProfile: true, groupLeaderProfile: true }
      },
      partnerProfile: true,
      groupLeaderProfile: true
    }
  });

  if (!order) {
    throw new Error("Order not found.");
  }

  const partnerProfile = order.partnerProfile ?? order.consultantProfile?.partnerProfile ?? null;
  const groupLeaderProfile = order.groupLeaderProfile ?? order.consultantProfile?.groupLeaderProfile ?? null;
  const partnerProfileId = partnerProfile?.id ?? null;
  const groupLeaderProfileId = groupLeaderProfile?.id ?? null;

  if (commissionMode === "CONSULTANT_PARTNER_SPLIT" && (!order.consultantProfileId || !partnerProfileId)) {
    throw new Error("Order must have a consultant assigned to a partner before split commissions can be calculated.");
  }

  if (commissionMode === "PARTNER_DIRECT" && !partnerProfileId) {
    throw new Error("Order must have a partner assigned before partner direct commissions can be calculated.");
  }

  if (commissionMode === "GROUP_LEADER_DIRECT" && (!partnerProfileId || !groupLeaderProfileId)) {
    throw new Error("Order must have a group leader assigned before leader direct commissions can be calculated.");
  }

  const internalCostCents = order.items.reduce(
    (total, item) => total + item.product.internalCostCents * item.quantity,
    0
  );
  const isConsultantSale = commissionMode === "CONSULTANT_PARTNER_SPLIT";
  const isGroupLeaderDirectSale = commissionMode === "GROUP_LEADER_DIRECT";
  const groupLeaderShareBps = isConsultantSale
    ? clampGroupLeaderPoolShareBps(groupLeaderProfile?.consultantOverrideBps)
    : isGroupLeaderDirectSale
      ? clampGroupLeaderPoolShareBps(groupLeaderProfile?.commissionBps)
      : 0;
  const consultantShareBps = isConsultantSale
    ? Math.max(0, (order.consultantProfile?.commissionBps ?? DEFAULT_CONSULTANT_SHARE_BPS) - groupLeaderShareBps)
    : undefined;

  const split = calculateMarginCommissionSplit({
    subtotalCents: order.subtotalCents,
    internalCostCents,
    partnerPoolBps: commissionMode === "CONSULTANT_PARTNER_SPLIT" || commissionMode === "GROUP_LEADER_DIRECT" ? partnerProfile?.commissionBps : undefined,
    groupLeaderShareBps,
    consultantShareBps
  });

  await prisma.$transaction(async (tx) => {
    await tx.order.update({
      where: { id: order.id },
      data: {
        grossMarginCents: split.grossMarginCents,
        commissionPoolCents: split.commissionPoolCents,
        commissionStatus: status
      }
    });

    if (commissionMode === "ADMIN_DIRECT") {
      return;
    }

    if (commissionMode === "PARTNER_DIRECT") {
      await tx.commissionSplit.create({
        data: {
          companyId: order.companyId,
          orderId: order.id,
          partnerProfileId,
          participantRole: "PARTNER",
          amountCents: split.commissionPoolCents,
          grossMarginCents: split.grossMarginCents,
          commissionPoolCents: split.commissionPoolCents,
          status,
          payoutResponsibility: "COMPANY"
        }
      });
      return;
    }

    if (commissionMode === "GROUP_LEADER_DIRECT") {
      await tx.commissionSplit.createMany({
        data: [
          {
            companyId: order.companyId,
            orderId: order.id,
            partnerProfileId,
            groupLeaderProfileId,
            participantRole: "PARTNER",
            amountCents: split.partnerAmountCents,
            grossMarginCents: split.grossMarginCents,
            commissionPoolCents: split.commissionPoolCents,
            status,
            payoutResponsibility: "COMPANY"
          },
          {
            companyId: order.companyId,
            orderId: order.id,
            partnerProfileId,
            groupLeaderProfileId,
            participantRole: "GROUP_LEADER",
            amountCents: split.groupLeaderAmountCents,
            grossMarginCents: split.grossMarginCents,
            commissionPoolCents: split.commissionPoolCents,
            status,
            payoutResponsibility: "PARTNER"
          }
        ],
        skipDuplicates: true
      });
      return;
    }

    await tx.commission.create({
      data: {
        companyId: order.companyId,
        consultantProfileId: order.consultantProfileId!,
        orderId: order.id,
        amountCents: split.consultantAmountCents,
        grossMarginCents: split.grossMarginCents,
        commissionPoolCents: split.commissionPoolCents,
        partnerAmountCents: split.partnerAmountCents,
        consultantAmountCents: split.consultantAmountCents,
        status
      }
    });

    await tx.commissionSplit.createMany({
      data: [
        {
          companyId: order.companyId,
          orderId: order.id,
          consultantProfileId: order.consultantProfileId!,
          partnerProfileId,
          groupLeaderProfileId,
          participantRole: "PARTNER",
          amountCents: split.partnerAmountCents,
          grossMarginCents: split.grossMarginCents,
          commissionPoolCents: split.commissionPoolCents,
          status,
          payoutResponsibility: "COMPANY"
        },
        ...(groupLeaderProfileId && split.groupLeaderAmountCents > 0
          ? [
              {
                companyId: order.companyId,
                orderId: order.id,
                consultantProfileId: order.consultantProfileId!,
                partnerProfileId,
                groupLeaderProfileId,
                participantRole: "GROUP_LEADER" as const,
                amountCents: split.groupLeaderAmountCents,
                grossMarginCents: split.grossMarginCents,
                commissionPoolCents: split.commissionPoolCents,
                status,
                payoutResponsibility: "PARTNER" as const
              }
            ]
          : []),
        {
          companyId: order.companyId,
          orderId: order.id,
          consultantProfileId: order.consultantProfileId!,
          partnerProfileId,
          groupLeaderProfileId,
          participantRole: "CONSULTANT",
          amountCents: split.consultantAmountCents,
          grossMarginCents: split.grossMarginCents,
          commissionPoolCents: split.commissionPoolCents,
          status,
          payoutResponsibility: "PARTNER"
        }
      ],
      skipDuplicates: true
    });
  });

  return split;
}
