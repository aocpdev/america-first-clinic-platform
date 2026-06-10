export type DiscountLike = {
  id: string;
  name: string;
  code: string;
  discountType: string;
  valueBps: number;
  amountCents: number;
  minSubtotalCents: number;
  ownerProtectedProfitCents: number;
  affectsCommissions: boolean;
  productIds: string[];
  categoryNames: string[];
  startsAt: Date | null;
  endsAt: Date | null;
  maxRedemptions: number | null;
  redemptionCount: number;
  active: boolean;
};

export type DiscountLineItem = {
  productId: string;
  categoryName: string;
  priceCents: number;
  internalCostCents: number;
  quantity: number;
};

export type AppliedDiscount = {
  discount: DiscountLike;
  eligibleSubtotalCents: number;
  subtotalCents: number;
  internalCostCents: number;
  requestedDiscountCents: number;
  discountCents: number;
  totalCents: number;
  grossMarginCents: number;
  ownerProtectedProfitCents: number;
  commissionableMarginCents: number;
  ownerProfitCents: number;
};

export function normalizeDiscountCode(value: string) {
  return value.trim().toUpperCase().replace(/\s+/g, "");
}

export function isDiscountActive(discount: DiscountLike, now = new Date()) {
  if (!discount.active) return false;
  if (discount.startsAt && discount.startsAt > now) return false;
  if (discount.endsAt && discount.endsAt < now) return false;
  if (discount.maxRedemptions != null && discount.redemptionCount >= discount.maxRedemptions) return false;
  return true;
}

export function discountAppliesToLine(discount: DiscountLike, line: DiscountLineItem) {
  if (discount.productIds.length > 0) {
    return discount.productIds.includes(line.productId);
  }

  return true;
}

export function calculateDiscountApplication(discount: DiscountLike, lines: DiscountLineItem[]): AppliedDiscount | null {
  const subtotalCents = lines.reduce((sum, line) => sum + line.priceCents * line.quantity, 0);
  const internalCostCents = lines.reduce((sum, line) => sum + line.internalCostCents * line.quantity, 0);
  const eligibleSubtotalCents = lines
    .filter((line) => discountAppliesToLine(discount, line))
    .reduce((sum, line) => sum + line.priceCents * line.quantity, 0);

  if (subtotalCents <= 0 || eligibleSubtotalCents <= 0 || subtotalCents < discount.minSubtotalCents) {
    return null;
  }

  const requestedDiscountCents =
    discount.discountType === "PERCENT"
      ? Math.round((eligibleSubtotalCents * discount.valueBps) / 10000)
      : Math.min(discount.amountCents, eligibleSubtotalCents);
  const maxDiscountByOwnerProtection = Math.max(0, subtotalCents - internalCostCents - discount.ownerProtectedProfitCents);
  const discountCents = Math.max(0, Math.min(requestedDiscountCents, maxDiscountByOwnerProtection, subtotalCents));
  const totalCents = Math.max(0, subtotalCents - discountCents);
  const grossMarginCents = Math.max(0, totalCents - internalCostCents);
  const commissionableMarginCents = discount.affectsCommissions
    ? Math.max(0, grossMarginCents - discount.ownerProtectedProfitCents)
    : grossMarginCents;
  const ownerProfitCents = Math.max(0, grossMarginCents - commissionableMarginCents);

  return {
    discount,
    eligibleSubtotalCents,
    subtotalCents,
    internalCostCents,
    requestedDiscountCents,
    discountCents,
    totalCents,
    grossMarginCents,
    ownerProtectedProfitCents: discount.ownerProtectedProfitCents,
    commissionableMarginCents,
    ownerProfitCents
  };
}
