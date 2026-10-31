import assert from "node:assert/strict";
import test from "node:test";
import { PrismaClient } from "@prisma/client";
import { loadRxQuote } from "./rx-quote-service";
import { resolveRxReferral } from "../referrals/rx-referral-service";

const url = process.env.RX_TEST_DATABASE_URL;
if (url) {
  const parsed = new URL(url);
  if (!["localhost", "127.0.0.1"].includes(parsed.hostname) || parsed.pathname !== "/gvh_affiliate_test") {
    throw new Error("RX quote verification requires the isolated local gvh_affiliate_test database");
  }
}

test("real catalog quote is company-scoped, read-only and recomputed from Admin", { skip: !url }, async () => {
  const db = new PrismaClient({ datasources: { db: { url: url! } } });
  try {
    const company = await db.company.findUniqueOrThrow({ where: { slug: "affiliate-ui-fixture" } });
    const product = await db.product.findFirstOrThrow({ where: { companyId: company.id, slug: "local-program", active: true } });
    const before = await db.order.count();
    const affiliate = await db.affiliateProfile.findFirstOrThrow({ where: { companyId: company.id, referralCode: "AF-LOCAL-UI-FIXTURE" } });
    assert.deepEqual(await resolveRxReferral(db, company.id, affiliate.referralCode), {
      status: "RESOLVED", seller: { companyId: company.id, role: "AFFILIATE", profileId: affiliate.id }
    });
    assert.equal((await resolveRxReferral(db, "00000000-0000-4000-8000-000000000001", affiliate.referralCode)).status, "REVIEW_REQUIRED");
    const result = await loadRxQuote(db, company.id, { items: [{ productId: product.id, quantity: 2 }] });
    assert.equal(result.publicQuote.totalCents, product.priceCents * 2);
    assert.equal(result.publicQuote.items[0].title, product.title);
    assert.equal(JSON.stringify(result.publicQuote).includes("internalCostCents"), false);
    await assert.rejects(loadRxQuote(db, "00000000-0000-4000-8000-000000000001", { items: [{ productId: product.id, quantity: 1 }] }), /PRODUCT_UNAVAILABLE/);
    await assert.rejects(loadRxQuote(db, company.id, { items: [{ productId: "00000000-0000-4000-8000-000000000002", quantity: 1 }] }), /PRODUCT_UNAVAILABLE/);
    await assert.rejects(loadRxQuote(db, company.id, { items: [{ productId: "not-a-uuid", quantity: 1 }] }), /Invalid uuid/);
    await assert.rejects(loadRxQuote(db, company.id, { items: [{ productId: product.id, quantity: 1 }], priceCents: 1 }));
    await assert.rejects(loadRxQuote(db, company.id, { items: [{ productId: product.id, quantity: 1 }], couponCode: "INVALID-LOCAL-COUPON" }), /INVALID_DISCOUNT/);
    assert.equal(await db.order.count(), before);
  } finally { await db.$disconnect(); }
});
