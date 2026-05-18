import { CommissionStatus } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

export async function getPartnerMetrics(partnerProfileId: string) {
  const [partnerSplits, consultantSplits, consultants, orders] = await Promise.all([
    prisma.commissionSplit.aggregate({
      where: { partnerProfileId, participantRole: "PARTNER" },
      _sum: { amountCents: true, grossMarginCents: true, commissionPoolCents: true }
    }),
    prisma.commissionSplit.groupBy({
      by: ["status"],
      where: { partnerProfileId, participantRole: "CONSULTANT" },
      _sum: { amountCents: true }
    }),
    prisma.consultantProfile.findMany({
      where: { partnerProfileId },
      include: { user: true },
      orderBy: { createdAt: "desc" }
    }),
    prisma.order.aggregate({
      where: {
        OR: [
          { partnerProfileId },
          { consultantProfile: { partnerProfileId } }
        ]
      },
      _count: { id: true },
      _sum: { totalCents: true }
    })
  ]);

  const consultantPayoutsByStatus = consultantSplits.reduce<Record<CommissionStatus, number>>(
    (acc, row) => {
      acc[row.status] = row._sum.amountCents ?? 0;
      return acc;
    },
    {
      PENDING: 0,
      APPROVED: 0,
      REJECTED: 0,
      PAID: 0
    }
  );

  return {
    partnerCommissionCents: partnerSplits._sum.amountCents ?? 0,
    attributedRevenueCents: orders._sum.totalCents ?? 0,
    attributedOrderCount: orders._count.id,
    grossMarginCents: partnerSplits._sum.grossMarginCents ?? 0,
    commissionPoolCents: partnerSplits._sum.commissionPoolCents ?? 0,
    consultantPayoutsByStatus,
    consultants
  };
}
