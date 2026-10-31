import assert from "node:assert/strict";
import test from "node:test";
import { snapshotAffiliateTerms } from "./affiliate-terms";

const identity = { companyId: "company-a", affiliateCompanyId: "company-a", affiliateId: "affiliate-a" };

test("approved default is 25% of commissionable margin without agency fee deduction", () => {
  const terms = snapshotAffiliateTerms(identity);
  assert.equal(terms.rateBps, 2500);
  assert.equal(terms.basis, "COMMISSIONABLE_MARGIN");
  assert.equal(terms.deductAgencyFeeFromBasis, false);
  assert.equal(terms.discountPolicy, "EXISTING_SELLER_FUNDING_RULES");
});
test("individual override wins including an explicit zero", () => {
  assert.equal(snapshotAffiliateTerms({ ...identity, globalRateBps: 3000 }).rateBps, 3000);
  for (const rateBps of [0, 2000, 10000]) {
    const terms = snapshotAffiliateTerms({ ...identity, globalRateBps: 3000, affiliateRateBps: rateBps });
    assert.equal(terms.rateBps, rateBps);
    assert.equal(terms.rateSource, "AFFILIATE_OVERRIDE");
  }
});
test("later settings do not mutate earlier snapshots", () => {
  const previous = snapshotAffiliateTerms(identity);
  const next = snapshotAffiliateTerms({ ...identity, globalRateBps: 3500 });
  assert.equal(previous.rateBps, 2500);
  assert.equal(next.rateBps, 3500);
  assert.equal(Object.isFrozen(previous), true);
});
test("invalid percentages and cross-company identity are rejected", () => {
  for (const rateBps of [-1, 10001, 1.5, NaN, Infinity]) {
    assert.throws(() => snapshotAffiliateTerms({ ...identity, globalRateBps: rateBps }));
    assert.throws(() => snapshotAffiliateTerms({ ...identity, affiliateRateBps: rateBps }));
  }
  assert.throws(() => snapshotAffiliateTerms({ ...identity, affiliateCompanyId: "company-b" }));
  assert.throws(() => snapshotAffiliateTerms({ ...identity, affiliateId: "" }));
});
