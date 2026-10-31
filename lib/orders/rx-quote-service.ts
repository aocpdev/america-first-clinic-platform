import type { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { normalizeDiscountCode } from "../discounts/calculations";
import { calculateRxQuote, rxQuoteIntentSchema } from "./rx-quote";

/** companyId must be resolved from server configuration, never a request payload. */
export async function loadRxQuote(db: Pick<PrismaClient, "product" | "discount">, companyId: string, payload: unknown) {
  if (!companyId) throw new Error("INVALID_COMPANY");
  z.string().uuid().parse(companyId);
  const intent = rxQuoteIntentSchema.parse(payload);
  for (const item of intent.items) z.string().uuid().parse(item.productId);
  const code = normalizeDiscountCode(intent.couponCode);
  const [products, discount] = await Promise.all([
    db.product.findMany({
      where: { companyId, active: true, id: { in: intent.items.map(item => item.productId) } },
      select: { id: true, companyId: true, active: true, title: true, priceCents: true,
        internalCostCents: true, category: { select: { name: true } } }
    }),
    code ? db.discount.findUnique({ where: { companyId_code: { companyId, code } } }) : Promise.resolve(null)
  ]);
  return calculateRxQuote({ companyId, intent, products, discount });
}
