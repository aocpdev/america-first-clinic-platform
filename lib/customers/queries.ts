import type { Prisma } from "@prisma/client";
import { orderListInclude } from "@/lib/orders/queries";

export const customerRecordInclude = {
  consultantProfile: {
    include: {
      user: true,
      partnerProfile: { include: { user: true } },
      groupLeaderProfile: { include: { user: true } }
    }
  },
  partnerProfile: { include: { user: true } },
  groupLeaderProfile: { include: { user: true } },
  orders: {
    include: orderListInclude,
    orderBy: { createdAt: "desc" }
  }
} satisfies Prisma.CustomerInclude;

export type CustomerRecordPayload = Prisma.CustomerGetPayload<{ include: typeof customerRecordInclude }>;

export const customerListInclude = {
  consultantProfile: {
    include: {
      user: true,
      partnerProfile: { include: { user: true } },
      groupLeaderProfile: { include: { user: true } }
    }
  },
  partnerProfile: { include: { user: true } },
  groupLeaderProfile: { include: { user: true } },
  orders: {
    select: {
      id: true,
      totalCents: true,
      createdAt: true
    },
    orderBy: { createdAt: "desc" }
  }
} satisfies Prisma.CustomerInclude;

export type CustomerListPayload = Prisma.CustomerGetPayload<{ include: typeof customerListInclude }>;

function personName(person: { firstName: string | null; lastName: string | null; email?: string }) {
  return [person.firstName, person.lastName].filter(Boolean).join(" ").trim() || person.email || "Unassigned";
}

export function customerDisplayName(customer: { firstName: string | null; lastName: string | null; email: string }) {
  return personName(customer);
}

export function mapCustomerRecord(customer: CustomerRecordPayload) {
  const partnerProfile = customer.partnerProfile ?? customer.consultantProfile?.partnerProfile ?? null;
  const groupLeaderProfile = customer.groupLeaderProfile ?? customer.consultantProfile?.groupLeaderProfile ?? null;

  return {
    id: customer.id,
    firstName: customer.firstName,
    lastName: customer.lastName,
    email: customer.email,
    phone: customer.phone,
    pipelineStage: customer.pipelineStage,
    tags: customer.tags,
    notes: customer.notes,
    lifetimeValueCents: customer.lifetimeValueCents,
    lastPurchaseAt: customer.lastPurchaseAt,
    consultantName: customer.consultantProfile ? personName(customer.consultantProfile.user) : null,
    leaderName: groupLeaderProfile?.displayName ?? (groupLeaderProfile ? personName(groupLeaderProfile.user) : null),
    partnerName: partnerProfile?.companyName ?? partnerProfile?.displayName ?? (partnerProfile ? personName(partnerProfile.user) : null),
    orders: customer.orders
  };
}

export function mapCustomerRows(customers: CustomerListPayload[]) {
  return customers.map((customer) => {
    const partnerProfile = customer.partnerProfile ?? customer.consultantProfile?.partnerProfile ?? null;
    const groupLeaderProfile = customer.groupLeaderProfile ?? customer.consultantProfile?.groupLeaderProfile ?? null;
    const orderTotalCents = customer.orders.reduce((sum, order) => sum + order.totalCents, 0);
    const lastOrder = customer.orders[0] ?? null;

    return {
      id: customer.id,
      name: customerDisplayName(customer),
      email: customer.email,
      phone: customer.phone,
      pipelineStage: customer.pipelineStage,
      consultantName: customer.consultantProfile ? personName(customer.consultantProfile.user) : "Unassigned",
      leaderName: groupLeaderProfile?.displayName ?? (groupLeaderProfile ? personName(groupLeaderProfile.user) : "No leader"),
      partnerName: partnerProfile?.companyName ?? partnerProfile?.displayName ?? (partnerProfile ? personName(partnerProfile.user) : "No partner"),
      ordersCount: customer.orders.length,
      revenueCents: customer.lifetimeValueCents || orderTotalCents,
      lastOrderAt: lastOrder?.createdAt ?? customer.lastPurchaseAt
    };
  });
}
