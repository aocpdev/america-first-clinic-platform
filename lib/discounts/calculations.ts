export const DISCOUNT_FUNDING_STRATEGIES = [
  "ORIGINATOR_FUNDED",
  "PARTNER_FUNDED",
  "COMPANY_FUNDED",
  "SHARED_POOL"
] as const;

export type DiscountFundingStrategy = (typeof DISCOUNT_FUNDING_STRATEGIES)[number];

export const DEFAULT_DISCOUNT_FUNDING_STRATEGY: DiscountFundingStrategy = "ORIGINATOR_FUNDED";
export const AGENCY_FEE_BPS = 800;

export function isDiscountFundingStrategy(value: unknown): value is DiscountFundingStrategy {
  return typeof value === "string" && DISCOUNT_FUNDING_STRATEGIES.includes(value as DiscountFundingStrategy);
}

export function normalizeDiscountFundingStrategy(value: unknown, affectsCommissions = true): DiscountFundingStrategy {
  if (isDiscountFundingStrategy(value)) return value;
  return affectsCommissions ? DEFAULT_DISCOUNT_FUNDING_STRATEGY : "COMPANY_FUNDED";
}

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
  fundingStrategy?: DiscountFundingStrategy | string;
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
  agencyFeeEstimatedCents: number;
  commissionableMarginCents: number;
  ownerProfitCents: number;
};

export function agencyFeeFromMarginCents(grossMarginCents: number, feeBps = AGENCY_FEE_BPS) {
  return Math.max(0, Math.round((Math.max(0, grossMarginCents) * feeBps) / 10000));
}

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
  const preDiscountGrossMarginCents = Math.max(0, subtotalCents - internalCostCents);
  const ownerProtectedProfitCents = discount.ownerProtectedProfitCents;
  const maxDiscountByOwnerProtection = Math.max(0, preDiscountGrossMarginCents - ownerProtectedProfitCents);
  const discountCents = Math.max(0, Math.min(requestedDiscountCents, maxDiscountByOwnerProtection, subtotalCents));
  const totalCents = Math.max(0, subtotalCents - discountCents);
  const grossMarginCents = Math.max(0, totalCents - internalCostCents);
  const agencyFeeEstimatedCents = agencyFeeFromMarginCents(grossMarginCents);
  const fundingStrategy = normalizeDiscountFundingStrategy(discount.fundingStrategy, discount.affectsCommissions);
  const commissionableMarginCents = fundingStrategy === "SHARED_POOL"
    ? Math.max(0, grossMarginCents - ownerProtectedProfitCents)
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
    ownerProtectedProfitCents,
    agencyFeeEstimatedCents,
    commissionableMarginCents,
    ownerProfitCents
  };
}
