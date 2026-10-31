import type { PrismaClient } from "@prisma/client";
import { z } from "zod";

export async function getCustomerOrder(db: Pick<PrismaClient, "order">, customer: { companyId: string; id: string }, orderId: string) {
  if (!z.string().uuid().safeParse(orderId).success) return null;
  return db.order.findFirst({ where: { id: orderId, companyId: customer.companyId, customerId: customer.id },
    select: { id: true, createdAt: true, subtotalCents: true, discountCents: true, taxCents: true,
      shippingCents: true, totalCents: true, paymentStatus: true, orderStatus: true,
      shippingCarrier: true, shippingTrackingCode: true, shippedAt: true,
      items: { orderBy: { id: "asc" }, select: { id: true, quantity: true, unitPriceCents: true, totalCents: true,
        product: { select: { title: true } } } } } });
}

/** Server-established identity only; never pass request parameters as this scope. */
export async function listCustomerOrders(db: PrismaClient, customer: { companyId: string; id: string }, page: number) {
  return db.order.findMany({ where: { companyId: customer.companyId, customerId: customer.id },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 12, skip: (page - 1) * 12,
    select: { id: true, createdAt: true, totalCents: true, paymentStatus: true, orderStatus: true,
      items: { orderBy: { id: "asc" }, select: { quantity: true, totalCents: true, product: { select: { title: true } } } } } });
}
