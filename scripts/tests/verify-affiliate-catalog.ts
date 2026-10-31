import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import { snapshotAffiliateTerms } from "../../lib/referrals/affiliate-terms";
import { estimateAffiliateProductEarnings } from "../../lib/referrals/affiliate-product-earnings";

const url = process.env.AFFILIATE_TEST_DATABASE_URL;
if (!url || !["localhost", "127.0.0.1"].includes(new URL(url).hostname) || new URL(url).pathname !== "/gvh_affiliate_test") throw new Error("Local preview database required");
const db = new PrismaClient({ datasources: { db: { url } } });
async function main() {
  const affiliate = await db.affiliateProfile.findFirstOrThrow({ where: { company: { slug: "affiliate-ui-fixture" }, email: "artist@example.test" } });
  const products = await db.product.findMany({ where: { companyId: affiliate.companyId, active: true }, orderBy: { title: "asc" }, select: { title: true, priceCents: true, internalCostCents: true, marginBps: true } });
  assert.ok(products.length > 1, "Real product catalog must be imported first");
  const mismatch = products.filter(p => p.priceCents > 0 && p.marginBps !== Math.round((p.priceCents - p.internalCostCents) / p.priceCents * 10000));
  assert.equal(mismatch.length, 0, "Imported margins must match the admin's price/cost calculation");
  const rollback = new Error("ROLLBACK_VERIFICATION");
  await assert.rejects(db.$transaction(async tx => {
    await tx.affiliateProgramSetting.upsert({ where: { companyId: affiliate.companyId }, update: { commissionBps: 3000 }, create: { companyId: affiliate.companyId, commissionBps: 3000 } });
    for (const override of [null, 2000, 0]) {
      const current = await tx.affiliateProfile.update({ where: { id: affiliate.id }, data: { commissionBps: override } });
      const settings = await tx.affiliateProgramSetting.findUniqueOrThrow({ where: { companyId: affiliate.companyId } });
      const terms = snapshotAffiliateTerms({ companyId: current.companyId, affiliateCompanyId: current.companyId, affiliateId: current.id, globalRateBps: settings.commissionBps, affiliateRateBps: current.commissionBps });
      assert.equal(terms.rateBps, override ?? 3000);
      for (const product of products) {
        const margin = BigInt(Math.max(0, product.priceCents - product.internalCostCents));
        const expected = Number((margin * BigInt(override ?? 3000) + BigInt(5000)) / BigInt(10000));
        assert.equal(estimateAffiliateProductEarnings({ ...product, rateBps: terms.rateBps }), expected);
      }
    }
    throw rollback;
  }), error => error === rollback);
  const settings = await db.affiliateProgramSetting.findUnique({ where: { companyId: affiliate.companyId } });
  const terms = snapshotAffiliateTerms({ companyId: affiliate.companyId, affiliateCompanyId: affiliate.companyId, affiliateId: affiliate.id, globalRateBps: settings?.commissionBps, affiliateRateBps: affiliate.commissionBps });
  console.log(JSON.stringify({ productsVerified: products.length, rateCasesVerified: ["global fallback", "individual override", "explicit zero"], storedMarginMismatches: mismatch.length, currentRateBps: terms.rateBps,
    examples: products.slice(0, 3).map(p => ({ title: p.title, priceCents: p.priceCents, marginCents: p.priceCents-p.internalCostCents, estimatedCents: estimateAffiliateProductEarnings({ ...p, rateBps: terms.rateBps }) })) }));
}
main().finally(() => db.$disconnect());
