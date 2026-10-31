/** Catalog estimate only: one unit at list price, no discount/protected-profit rule. */
export function estimateAffiliateProductEarnings({ priceCents, internalCostCents, rateBps }: {
  priceCents: number; internalCostCents: number; rateBps: number;
}): number | null {
  if (![priceCents, internalCostCents, rateBps].every(Number.isSafeInteger) ||
    priceCents < 0 || internalCostCents < 0 || rateBps < 0 || rateBps > 10000) return null;
  const scaled = Math.max(0, priceCents - internalCostCents) * rateBps;
  if (!Number.isSafeInteger(scaled)) return null;
  return Math.round(scaled / 10000);
}
