import { CommissionStatus, type PrismaClient } from "@prisma/client";

export const DEFAULT_MARGIN_POOL_BPS = 2500;
export const DEFAULT_PARTNER_SPLIT_BPS = 5000;

export function calculateMarginCommissionSplit({
  subtotalCents,
  internalCostCents,
  poolBps = DEFAULT_MARGIN_POOL_BPS,
  partnerSplitBps = DEFAULT_PARTNER_SPLIT_BPS
}: {
  subtotalCents: number;
  internalCostCents: number;
  poolBps?: number;
  partnerSplitBps?: number;
}) {
  const grossMarginCents = Math.max(0, subtotalCents - internalCostCents);
  const commissionPoolCents = Math.round((grossMarginCents * poolBps) / 10000);
  const partnerAmountCents = Math.round((commissionPoolCents * partnerSplitBps) / 10000);
  const consultantAmountCents = commissionPoolCents - partnerAmountCents;

  return {
    grossMarginCents,
    commissionPoolCents,
    partnerAmountCents,
    consultantAmountCents
  };
}

export async function createMarginCommissionLedger({
  prisma,
  orderId,
  status = CommissionStatus.PENDING
}: {
  prisma: PrismaClient;
  orderId: string;
  status?: CommissionStatus;
}) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      items: {
        include: { product: true }
      },
      consultantProfile: {
        include: { partnerProfile: true }
      }
    }
  });

  if (!order?.consultantProfileId || !order.consultantProfile?.partnerProfileId) {
    throw new Error("Order must have a consultant assigned to a partner before commissions can be calculated.");
  }

  const internalCostCents = order.items.reduce(
    (total, item) => total + item.product.internalCostCents * item.quantity,
    0
  );
  const split = calculateMarginCommissionSplit({
    subtotalCents: order.subtotalCents,
    internalCostCents
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
          partnerProfileId: order.consultantProfile!.partnerProfileId!,
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
          consultantProfileId: order.consultantProfileId!,
          partnerProfileId: order.consultantProfile!.partnerProfileId!,
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
