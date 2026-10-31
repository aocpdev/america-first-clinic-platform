import test from "node:test";
import assert from "node:assert/strict";
import { estimateAffiliateProductEarnings } from "./affiliate-product-earnings";
import { snapshotAffiliateTerms } from "./affiliate-terms";

test("25% applies to margin directly, without a partner pool or agency fee deduction", () => {
  assert.equal(estimateAffiliateProductEarnings({ priceCents: 39700, internalCostCents: 10900, rateBps: 2500 }), 7200);
});
test("individual rate and explicit zero use the same approved terms as the affiliate", () => {
  const input = { companyId: "company", affiliateCompanyId: "company", affiliateId: "affiliate", globalRateBps: 3000 };
  for (const [affiliateRateBps, expected] of [[null, 8640], [2000, 5760], [0, 0]] as const) {
    const terms = snapshotAffiliateTerms({ ...input, affiliateRateBps });
    assert.equal(estimateAffiliateProductEarnings({ priceCents: 39700, internalCostCents: 10900, rateBps: terms.rateBps }), expected);
  }
});
test("non-positive margins earn zero, not a negative amount", () => {
  for (const internalCostCents of [10000, 15000]) assert.equal(estimateAffiliateProductEarnings({ priceCents: 10000, internalCostCents, rateBps: 2500 }), 0);
});
test("estimates round to cents and are per single product unit", () => {
  assert.equal(estimateAffiliateProductEarnings({ priceCents: 10003, internalCostCents: 0, rateBps: 2500 }), 2501);
});
test("invalid inputs show unavailable rather than misleading zero earnings", () => {
  const valid = { priceCents: 10000, internalCostCents: 5000, rateBps: 2500 };
  for (const changed of [{ priceCents: -1 }, { internalCostCents: -1 }, { rateBps: 10001 }, { rateBps: NaN }, { internalCostCents: 0.5 }, { priceCents: Number.MAX_SAFE_INTEGER }]) {
    assert.equal(estimateAffiliateProductEarnings({ ...valid, ...changed }), null);
  }
});
