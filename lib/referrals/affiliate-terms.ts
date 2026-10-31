export const DEFAULT_AFFILIATE_RATE_BPS = 2500;

function validateRate(rateBps: number) {
  if (!Number.isInteger(rateBps) || rateBps < 0 || rateBps > 10000) {
    throw new Error("Affiliate rate must be an integer between 0 and 10000 basis points");
  }
  return rateBps;
}

/** Snapshot approved terms for a future order; never re-resolve a historical order. */
export function snapshotAffiliateTerms({
  companyId,
  affiliateCompanyId,
  affiliateId,
  globalRateBps = DEFAULT_AFFILIATE_RATE_BPS,
  affiliateRateBps = null
}: {
  companyId: string;
  affiliateCompanyId: string;
  affiliateId: string;
  globalRateBps?: number;
  affiliateRateBps?: number | null;
}) {
  if (!companyId || companyId !== affiliateCompanyId || !affiliateId) {
    throw new Error("Affiliate terms require a same-company affiliate identity");
  }
  validateRate(globalRateBps);
  const rateBps = validateRate(affiliateRateBps ?? globalRateBps);
  return Object.freeze({
    version: 1 as const,
    companyId,
    affiliateId,
    rateBps,
    rateSource: affiliateRateBps == null ? "COMPANY_DEFAULT" as const : "AFFILIATE_OVERRIDE" as const,
    basis: "COMMISSIONABLE_MARGIN" as const,
    discountPolicy: "EXISTING_SELLER_FUNDING_RULES" as const,
    deductAgencyFeeFromBasis: false as const
  });
}
