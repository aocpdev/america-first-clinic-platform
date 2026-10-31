import { z } from "zod";
import {
  calculateDiscountApplication, isDiscountActive, normalizeDiscountCode,
  type DiscountLike, type DiscountLineItem
} from "../discounts/calculations";

/** Visitors specify intent only; no client price, margin, seller ID or company ID. */
export const rxQuoteIntentSchema = z.object({
  items: z.array(z.object({
    productId: z.string().min(1).max(128),
    quantity: z.number().int().min(1).max(100)
  }).strict()).min(1).max(25),
  couponCode: z.string().max(64).optional().default("")
}).strict();

export type RxQuoteProduct = {
  id: string; companyId: string; active: boolean; title: string;
  priceCents: number; internalCostCents: number; category: { name: string };
};

/** Server-owned catalog/discount records; reads only, never a payable order. */
export function calculateRxQuote(input: {
  companyId: string; intent: unknown; products: RxQuoteProduct[];
  discount: (DiscountLike & { companyId: string }) | null;
  now?: Date;
}) {
  const intent = rxQuoteIntentSchema.parse(input.intent);
  if (!input.companyId) throw new Error("INVALID_COMPANY");
  const quantities = new Map<string, number>();
  for (const item of intent.items) {
    const quantity = (quantities.get(item.productId) ?? 0) + item.quantity;
    if (quantity > 100) throw new Error("INVALID_QUANTITY");
    quantities.set(item.productId, quantity);
  }
  const productMap = new Map(input.products.map(product => [product.id, product]));
  const lines: DiscountLineItem[] = [];
  const items = Array.from(quantities, ([id, quantity]) => {
    const product = productMap.get(id);
    if (!product || product.companyId !== input.companyId || !product.active) throw new Error("PRODUCT_UNAVAILABLE");
    if (!Number.isSafeInteger(product.priceCents) || product.priceCents <= 0 ||
      !Number.isSafeInteger(product.internalCostCents) || product.internalCostCents < 0 ||
      !Number.isSafeInteger(product.priceCents * quantity) ||
      !Number.isSafeInteger(product.internalCostCents * quantity)) throw new Error("INVALID_PRODUCT_PRICE");
    lines.push({ productId: id, quantity, categoryName: product.category.name,
      priceCents: product.priceCents, internalCostCents: product.internalCostCents });
    return { productId: id, title: product.title, quantity,
      unitPriceCents: product.priceCents, totalCents: product.priceCents * quantity };
  });
  const subtotalCents = items.reduce((total, item) => total + item.totalCents, 0);
  const internalCostCents = lines.reduce((total, line) => total + line.internalCostCents * line.quantity, 0);
  if (!Number.isSafeInteger(subtotalCents) || !Number.isSafeInteger(internalCostCents)) throw new Error("INVALID_ORDER_TOTAL");
  const couponCode = normalizeDiscountCode(intent.couponCode);
  const discount = input.discount;
  if (couponCode && (!discount || discount.companyId !== input.companyId || discount.code !== couponCode ||
    !isDiscountActive(discount, input.now))) throw new Error("INVALID_DISCOUNT");
  // Exactly the calculation used by internal sales: protection and funding rules stay shared.
  const appliedDiscount = couponCode && discount ? calculateDiscountApplication(discount, lines) : null;
  if (couponCode && (!appliedDiscount || appliedDiscount.discountCents <= 0)) throw new Error("DISCOUNT_NOT_APPLICABLE");
  return {
    publicQuote: {
      currency: "USD" as const, items, subtotalCents,
      discountCents: appliedDiscount?.discountCents ?? 0,
      totalCents: appliedDiscount?.totalCents ?? subtotalCents,
      couponCode: appliedDiscount ? couponCode : null
    },
    // Never serialize this financial context into a customer/affiliate component.
    financialContext: { lines, appliedDiscount }
  };
}
