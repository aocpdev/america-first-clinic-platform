import type { Prisma } from "@prisma/client";

export const orderListInclude = {
  customer: true,
  partnerProfile: { include: { user: true } },
  managerProfile: { include: { user: true } },
  groupLeaderProfile: { include: { user: true } },
  consultantProfile: {
    include: {
      user: true,
      partnerProfile: { include: { user: true } },
      groupLeaderProfile: { include: { user: true } }
    }
  },
  items: {
    include: {
      product: {
        select: { title: true }
      }
    }
  },
  commissionSplits: true,
  clinicalDocuments: {
    orderBy: { createdAt: "desc" }
  }
} satisfies Prisma.OrderInclude;

export type OrderListRecord = Prisma.OrderGetPayload<{ include: typeof orderListInclude }>;

function personName(person: { firstName: string | null; lastName: string | null; email?: string }) {
  return [person.firstName, person.lastName].filter(Boolean).join(" ").trim() || person.email || "Unassigned";
}

function splitAmount(order: OrderListRecord, role: "PARTNER" | "MANAGER" | "GROUP_LEADER" | "CONSULTANT") {
  return order.commissionSplits
    .filter((split) => split.participantRole === role)
    .reduce((sum, split) => sum + split.amountCents, 0);
}

export function mapOrderRows(orders: OrderListRecord[]) {
  return orders.map((order) => {
    const partnerProfile = order.partnerProfile ?? order.consultantProfile?.partnerProfile ?? null;
    const groupLeaderProfile = order.groupLeaderProfile ?? order.consultantProfile?.groupLeaderProfile ?? null;

    return {
      id: order.id,
      customerId: order.customerId,
      customerName: personName(order.customer),
      customerEmail: order.customer.email,
      customerDateOfBirth: order.customer.dateOfBirth,
      consultantName: order.consultantProfile ? personName(order.consultantProfile.user) : null,
      leaderName: groupLeaderProfile?.displayName ?? null,
      partnerName: partnerProfile?.companyName ?? partnerProfile?.displayName ?? null,
      products: order.items.map((item) => `${item.quantity}x ${item.product.title}`).join(", "),
      totalCents: order.totalCents,
      grossMarginCents: order.grossMarginCents,
      commissionPoolCents: order.commissionPoolCents,
      partnerProfitCents: splitAmount(order, "PARTNER"),
      managerProfitCents: splitAmount(order, "MANAGER"),
      leaderProfitCents: splitAmount(order, "GROUP_LEADER"),
      consultantCommissionCents: splitAmount(order, "CONSULTANT"),
      paymentStatus: order.paymentStatus,
      orderStatus: order.orderStatus,
      orderPipelineStage: order.orderPipelineStage,
      commissionStatus: order.commissionStatus,
      shippingCarrier: order.shippingCarrier,
      shippingTrackingCode: order.shippingTrackingCode,
      createdAt: new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric"
      }).format(order.createdAt)
    };
  });
}
