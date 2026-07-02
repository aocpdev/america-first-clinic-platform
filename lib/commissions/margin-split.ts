import { CommissionStatus, type PrismaClient } from "@prisma/client";
import { normalizeDiscountFundingStrategy, type DiscountFundingStrategy } from "@/lib/discounts/calculations";

export const DEFAULT_MARGIN_POOL_BPS = 2500;
export const DEFAULT_PARTNER_SPLIT_BPS = 5000;
export const DEFAULT_MANAGER_SHARE_BPS = 5000;
export const DEFAULT_GROUP_LEADER_SHARE_BPS = 5000;
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
  managerShareBps = 0,
  consultantShareBps,
  ownerProtectedProfitCents = 0,
  commissionableMarginCents,
  leaderOverrideFromConsultantShare = false,
  managerOverrideFromLeaderShare = false
}: {
  subtotalCents: number;
  internalCostCents: number;
  poolBps?: number;
  partnerSplitBps?: number;
  partnerPoolBps?: number;
  managerShareBps?: number;
  groupLeaderShareBps?: number;
  consultantShareBps?: number;
  ownerProtectedProfitCents?: number;
  commissionableMarginCents?: number;
  leaderOverrideFromConsultantShare?: boolean;
  managerOverrideFromLeaderShare?: boolean;
}) {
  const grossMarginCents = Math.max(0, subtotalCents - internalCostCents);
  const effectiveCommissionableMarginCents = Math.max(
    0,
    commissionableMarginCents ?? grossMarginCents - ownerProtectedProfitCents
  );
  const effectivePoolBps = partnerPoolBps ?? poolBps;
  const effectiveManagerShareBps = clampGroupLeaderPoolShareBps(managerShareBps);
  const effectiveGroupLeaderShareBps = clampGroupLeaderPoolShareBps(groupLeaderShareBps);
  const commissionPoolCents = Math.round((effectiveCommissionableMarginCents * effectivePoolBps) / 10000);
  const legacyPartnerAmountCents = Math.round((commissionPoolCents * partnerSplitBps) / 10000);
  const usesLegacyConsultantSplit =
    partnerPoolBps == null && consultantShareBps == null && groupLeaderShareBps === 0 && managerShareBps === 0;
  const consultantBaseAmountCents = usesLegacyConsultantSplit
    ? commissionPoolCents - legacyPartnerAmountCents
    : consultantShareBps == null
      ? 0
      : Math.round((commissionPoolCents * consultantShareBps) / 10000);
  const managerBaseAmountCents = Math.round((commissionPoolCents * effectiveManagerShareBps) / 10000);
  const groupLeaderBaseAmountCents = leaderOverrideFromConsultantShare
    ? Math.round((consultantBaseAmountCents * effectiveGroupLeaderShareBps) / 10000)
    : Math.round((commissionPoolCents * effectiveGroupLeaderShareBps) / 10000);
  const managerAmountCents = managerOverrideFromLeaderShare
    ? Math.round((groupLeaderBaseAmountCents * effectiveManagerShareBps) / 10000)
    : managerBaseAmountCents;
  const groupLeaderAmountCents = Math.max(0, groupLeaderBaseAmountCents - (managerOverrideFromLeaderShare ? managerAmountCents : 0));
  const consultantAmountCents = leaderOverrideFromConsultantShare
    ? Math.max(0, consultantBaseAmountCents - groupLeaderBaseAmountCents)
    : consultantBaseAmountCents;
  const partnerAmountCents = usesLegacyConsultantSplit
    ? legacyPartnerAmountCents
    : leaderOverrideFromConsultantShare
      ? Math.max(0, commissionPoolCents - consultantBaseAmountCents)
      : managerOverrideFromLeaderShare
        ? Math.max(0, commissionPoolCents - groupLeaderBaseAmountCents - consultantAmountCents)
        : Math.max(0, commissionPoolCents - managerBaseAmountCents - groupLeaderBaseAmountCents - consultantAmountCents);

  return {
    grossMarginCents,
    ownerProtectedProfitCents,
    commissionableMarginCents: effectiveCommissionableMarginCents,
    commissionPoolCents,
    partnerAmountCents,
    managerAmountCents,
    groupLeaderAmountCents,
    consultantAmountCents
  };
}

function numberFromMetadata(metadata: Record<string, unknown>, key: string) {
  const value = metadata[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function absorbDiscount(amountCents: number, remainingDiscountCents: number) {
  const absorbedCents = Math.min(amountCents, remainingDiscountCents);
  return {
    amountCents: amountCents - absorbedCents,
    remainingDiscountCents: remainingDiscountCents - absorbedCents,
    absorbedCents
  };
}

type CommissionMode = "CONSULTANT_PARTNER_SPLIT" | "PARTNER_DIRECT" | "MANAGER_DIRECT" | "GROUP_LEADER_DIRECT" | "ADMIN_DIRECT";

function applyOriginatorFundedDiscount(
  split: ReturnType<typeof calculateMarginCommissionSplit>,
  commissionMode: CommissionMode,
  discountCents: number
) {
  let remainingDiscountCents = Math.max(0, discountCents);
  let partnerAmountCents = split.partnerAmountCents;
  let managerAmountCents = split.managerAmountCents;
  let groupLeaderAmountCents = split.groupLeaderAmountCents;
  let consultantAmountCents = split.consultantAmountCents;

  if (commissionMode === "ADMIN_DIRECT") {
    return {
      ...split,
      partnerAmountCents: 0,
      managerAmountCents: 0,
      groupLeaderAmountCents: 0,
      consultantAmountCents: 0,
      commissionPoolCents: 0,
      discountAbsorbedByMarginCents: remainingDiscountCents
    };
  }

  if (commissionMode === "PARTNER_DIRECT") {
    const result = absorbDiscount(split.commissionPoolCents, remainingDiscountCents);
    return {
      ...split,
      partnerAmountCents: result.amountCents,
      managerAmountCents: 0,
      groupLeaderAmountCents: 0,
      consultantAmountCents: 0,
      commissionPoolCents: result.amountCents,
      discountAbsorbedByMarginCents: result.remainingDiscountCents
    };
  }

  if (commissionMode === "CONSULTANT_PARTNER_SPLIT") {
    const result = absorbDiscount(consultantAmountCents, remainingDiscountCents);
    consultantAmountCents = result.amountCents;
    remainingDiscountCents = result.remainingDiscountCents;
  }

  if (commissionMode === "GROUP_LEADER_DIRECT") {
    const result = absorbDiscount(groupLeaderAmountCents, remainingDiscountCents);
    groupLeaderAmountCents = result.amountCents;
    remainingDiscountCents = result.remainingDiscountCents;
  }

  if (commissionMode === "MANAGER_DIRECT") {
    const result = absorbDiscount(managerAmountCents, remainingDiscountCents);
    managerAmountCents = result.amountCents;
    remainingDiscountCents = result.remainingDiscountCents;
  }

  const partnerResult = absorbDiscount(partnerAmountCents, remainingDiscountCents);
  partnerAmountCents = partnerResult.amountCents;
  remainingDiscountCents = partnerResult.remainingDiscountCents;

  return {
    ...split,
    partnerAmountCents,
    managerAmountCents,
    groupLeaderAmountCents,
    consultantAmountCents,
    commissionPoolCents: partnerAmountCents + managerAmountCents + groupLeaderAmountCents + consultantAmountCents,
    discountAbsorbedByMarginCents: remainingDiscountCents
  };
}

function applyPartnerFundedDiscount(
  split: ReturnType<typeof calculateMarginCommissionSplit>,
  discountCents: number
) {
  const partnerResult = absorbDiscount(split.partnerAmountCents, Math.max(0, discountCents));
  return {
    ...split,
    partnerAmountCents: partnerResult.amountCents,
    commissionPoolCents: partnerResult.amountCents + split.managerAmountCents + split.groupLeaderAmountCents + split.consultantAmountCents,
    discountAbsorbedByMarginCents: partnerResult.remainingDiscountCents
  };
}

function splitForDiscountFundingStrategy({
  baseSplit,
  sharedPoolSplit,
  commissionMode,
  fundingStrategy,
  discountCents
}: {
  baseSplit: ReturnType<typeof calculateMarginCommissionSplit>;
  sharedPoolSplit: ReturnType<typeof calculateMarginCommissionSplit>;
  commissionMode: CommissionMode;
  fundingStrategy: DiscountFundingStrategy;
  discountCents: number;
}) {
  if (fundingStrategy === "COMPANY_FUNDED") {
    return {
      ...baseSplit,
      discountAbsorbedByMarginCents: Math.max(0, discountCents)
    };
  }

  if (fundingStrategy === "PARTNER_FUNDED") {
    return applyPartnerFundedDiscount(baseSplit, discountCents);
  }

  if (fundingStrategy === "SHARED_POOL") {
    return {
      ...sharedPoolSplit,
      discountAbsorbedByMarginCents: 0
    };
  }

  return applyOriginatorFundedDiscount(baseSplit, commissionMode, discountCents);
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
  commissionMode?: CommissionMode;
}) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      items: {
        include: { product: true }
      },
      consultantProfile: {
        include: {
          partnerProfile: true,
          managerProfile: true,
          groupLeaderProfile: {
            include: { managerProfile: true }
          }
        }
      },
      partnerProfile: true,
      managerProfile: true,
      groupLeaderProfile: {
        include: { managerProfile: true }
      }
    }
  });

  if (!order) {
    throw new Error("Order not found.");
  }

  const partnerProfile = order.partnerProfile ?? order.consultantProfile?.partnerProfile ?? null;
  const groupLeaderProfile = order.groupLeaderProfile ?? order.consultantProfile?.groupLeaderProfile ?? null;
  const managerProfile =
    order.managerProfile ??
    order.groupLeaderProfile?.managerProfile ??
    order.consultantProfile?.managerProfile ??
    order.consultantProfile?.groupLeaderProfile?.managerProfile ??
    null;
  const partnerProfileId = partnerProfile?.id ?? null;
  const managerProfileId = managerProfile?.id ?? null;
  const groupLeaderProfileId = groupLeaderProfile?.id ?? null;

  if (commissionMode === "CONSULTANT_PARTNER_SPLIT" && (!order.consultantProfileId || !partnerProfileId)) {
    throw new Error("Order must have a consultant assigned to a partner before split commissions can be calculated.");
  }

  if (commissionMode === "PARTNER_DIRECT" && !partnerProfileId) {
    throw new Error("Order must have a partner assigned before partner direct commissions can be calculated.");
  }

  if (commissionMode === "MANAGER_DIRECT" && (!partnerProfileId || !managerProfileId)) {
    throw new Error("Order must have a manager assigned before manager direct commissions can be calculated.");
  }

  if (commissionMode === "GROUP_LEADER_DIRECT" && (!partnerProfileId || !groupLeaderProfileId)) {
    throw new Error("Order must have a group leader assigned before leader direct commissions can be calculated.");
  }

  const internalCostCents = order.items.reduce(
    (total, item) => total + item.product.internalCostCents * item.quantity,
    0
  );
  const metadata =
    order.referralMetadata && typeof order.referralMetadata === "object" && !Array.isArray(order.referralMetadata)
      ? (order.referralMetadata as Record<string, unknown>)
      : {};
  const discountMetadata =
    metadata.discount && typeof metadata.discount === "object" && !Array.isArray(metadata.discount)
      ? (metadata.discount as Record<string, unknown>)
      : {};
  const ownerProtectedProfitCents =
    typeof discountMetadata.ownerProtectedProfitCents === "number" ? discountMetadata.ownerProtectedProfitCents : 0;
  const discountCents = numberFromMetadata(discountMetadata, "discountCents") ?? order.discountCents;
  const discountFundingStrategy = normalizeDiscountFundingStrategy(
    discountMetadata.fundingStrategy,
    typeof discountMetadata.affectsCommissions === "boolean" ? discountMetadata.affectsCommissions : true
  );
  const preDiscountSubtotalCents = numberFromMetadata(discountMetadata, "subtotalCents") ?? order.subtotalCents ?? order.totalCents + discountCents;
  const actualGrossMarginCents = Math.max(0, order.totalCents - internalCostCents);
  const preDiscountGrossMarginCents = Math.max(0, preDiscountSubtotalCents - internalCostCents);
  const preDiscountCommissionableMarginCents = Math.max(0, preDiscountGrossMarginCents - ownerProtectedProfitCents);
  const postDiscountCommissionableMarginCents = Math.max(0, actualGrossMarginCents - ownerProtectedProfitCents);
  const isConsultantSale = commissionMode === "CONSULTANT_PARTNER_SPLIT";
  const isManagerDirectSale = commissionMode === "MANAGER_DIRECT";
  const isGroupLeaderDirectSale = commissionMode === "GROUP_LEADER_DIRECT";
  const groupLeaderShareBps = isConsultantSale
    ? clampGroupLeaderPoolShareBps(groupLeaderProfile?.consultantOverrideBps)
    : isGroupLeaderDirectSale
      ? clampGroupLeaderPoolShareBps(groupLeaderProfile?.commissionBps)
      : 0;
  const managerShareBps = isManagerDirectSale
    ? clampGroupLeaderPoolShareBps(managerProfile?.commissionBps)
    : isGroupLeaderDirectSale || isConsultantSale
      ? clampGroupLeaderPoolShareBps(managerProfile?.leaderOverrideBps)
      : 0;
  const consultantShareBps = isConsultantSale
    ? order.consultantProfile?.commissionBps ?? DEFAULT_CONSULTANT_SHARE_BPS
    : undefined;

  const baseSplit = calculateMarginCommissionSplit({
    subtotalCents: preDiscountSubtotalCents,
    internalCostCents,
    ownerProtectedProfitCents,
    commissionableMarginCents: preDiscountCommissionableMarginCents,
    partnerPoolBps: commissionMode === "CONSULTANT_PARTNER_SPLIT" || commissionMode === "GROUP_LEADER_DIRECT" || commissionMode === "MANAGER_DIRECT" ? partnerProfile?.commissionBps : undefined,
    managerShareBps,
    groupLeaderShareBps,
    consultantShareBps,
    leaderOverrideFromConsultantShare: false,
    managerOverrideFromLeaderShare: false
  });
  const sharedPoolSplit = calculateMarginCommissionSplit({
    subtotalCents: order.totalCents,
    internalCostCents,
    ownerProtectedProfitCents,
    commissionableMarginCents: postDiscountCommissionableMarginCents,
    partnerPoolBps: commissionMode === "CONSULTANT_PARTNER_SPLIT" || commissionMode === "GROUP_LEADER_DIRECT" || commissionMode === "MANAGER_DIRECT" ? partnerProfile?.commissionBps : undefined,
    managerShareBps,
    groupLeaderShareBps,
    consultantShareBps,
    leaderOverrideFromConsultantShare: false,
    managerOverrideFromLeaderShare: false
  });
  const split = {
    ...splitForDiscountFundingStrategy({
      baseSplit,
      sharedPoolSplit,
      commissionMode,
      fundingStrategy: discountFundingStrategy,
      discountCents
    }),
    grossMarginCents: actualGrossMarginCents
  };

  await prisma.$transaction(async (tx) => {
    await tx.order.update({
      where: { id: order.id },
      data: {
        grossMarginCents: split.grossMarginCents,
        commissionPoolCents: split.commissionPoolCents,
        managerProfileId,
        groupLeaderProfileId,
        partnerProfileId,
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
            managerProfileId,
            groupLeaderProfileId,
            participantRole: "PARTNER",
            amountCents: split.partnerAmountCents,
            grossMarginCents: split.grossMarginCents,
            commissionPoolCents: split.commissionPoolCents,
            status,
            payoutResponsibility: "COMPANY"
          },
          ...(managerProfileId && split.managerAmountCents > 0
            ? [
                {
                  companyId: order.companyId,
                  orderId: order.id,
                  partnerProfileId,
                  managerProfileId,
                  groupLeaderProfileId,
                  participantRole: "MANAGER" as const,
                  amountCents: split.managerAmountCents,
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
            partnerProfileId,
            managerProfileId,
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

    if (commissionMode === "MANAGER_DIRECT") {
      await tx.commissionSplit.createMany({
        data: [
          {
            companyId: order.companyId,
            orderId: order.id,
            partnerProfileId,
            managerProfileId,
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
            managerProfileId,
            participantRole: "MANAGER",
            amountCents: split.managerAmountCents,
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
          managerProfileId,
          groupLeaderProfileId,
          participantRole: "PARTNER",
          amountCents: split.partnerAmountCents,
          grossMarginCents: split.grossMarginCents,
          commissionPoolCents: split.commissionPoolCents,
          status,
          payoutResponsibility: "COMPANY"
        },
        ...(managerProfileId && split.managerAmountCents > 0
          ? [
              {
                companyId: order.companyId,
                orderId: order.id,
                consultantProfileId: order.consultantProfileId!,
                partnerProfileId,
                managerProfileId,
                groupLeaderProfileId,
                participantRole: "MANAGER" as const,
                amountCents: split.managerAmountCents,
                grossMarginCents: split.grossMarginCents,
                commissionPoolCents: split.commissionPoolCents,
                status,
                payoutResponsibility: "PARTNER" as const
              }
            ]
          : []),
        ...(groupLeaderProfileId && split.groupLeaderAmountCents > 0
          ? [
              {
                companyId: order.companyId,
                orderId: order.id,
                consultantProfileId: order.consultantProfileId!,
                partnerProfileId,
                managerProfileId,
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
          managerProfileId,
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
