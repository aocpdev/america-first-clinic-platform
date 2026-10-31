import assert from "node:assert/strict";
import test from "node:test";
import { PrismaClient } from "@prisma/client";
import { persistAffiliate, persistAffiliateDefault, persistAffiliateLogin } from "./affiliate-admin-service";

const url = process.env.AFFILIATE_TEST_DATABASE_URL;
const enabled = Boolean(url);
if (url) {
  const parsed = new URL(url);
  if (!['localhost', '127.0.0.1'].includes(parsed.hostname) || parsed.pathname !== "/gvh_affiliate_test") {
    throw new Error("Integration tests require the isolated local gvh_affiliate_test database");
  }
}

test("affiliate CRUD, tenant isolation, revisions and transactional audit", { skip: !enabled }, async () => {
  const db = new PrismaClient({ datasources: { db: { url: url! } } });
  try {
    const suffix = crypto.randomUUID();
    const company = await db.company.create({ data: { name: "Test", slug: `test-${suffix}` } });
    const other = await db.company.create({ data: { name: "Other", slug: `other-${suffix}` } });
    const user = await db.user.create({ data: { companyId: company.id, email: `admin-${suffix}@example.com`, authUserId: suffix, role: "COMPANY_ADMIN" } });
    const actor = { companyId: company.id, userId: user.id };
    const data = { displayName: "Test Artist", email: `artist-${suffix}@example.com`, category: "ARTIST" as const, status: "PENDING" as const, commissionBps: null };
    const id = await persistAffiliate(db, actor, data, "", 0);
    const created = await db.affiliateProfile.findUniqueOrThrow({ where: { id } });
    assert.equal(created.revision, 1);
    assert.match(created.referralCode, /^AF-[A-F0-9]{24}$/);
    await assert.rejects(persistAffiliate(db, { ...actor, companyId: other.id }, { ...data, status: "APPROVED" }, id, 1), /STALE_RECORD/);
    await persistAffiliate(db, actor, { ...data, status: "APPROVED", commissionBps: 0 }, id, 1);
    await assert.rejects(persistAffiliate(db, actor, data, id, 1), /STALE_RECORD/);
    const updated = await db.affiliateProfile.findUniqueOrThrow({ where: { id } });
    assert.equal(updated.status, "APPROVED");
    assert.equal(updated.commissionBps, 0);
    assert.equal(updated.referralCode, created.referralCode);
    await assert.rejects(persistAffiliate(db, actor, data, "", 0));
    const results = await Promise.allSettled([
      persistAffiliate(db, actor, { ...data, status: "SUSPENDED" }, id, 2),
      persistAffiliate(db, actor, { ...data, status: "ARCHIVED" }, id, 2)
    ]);
    assert.equal(results.filter(result => result.status === "fulfilled").length, 1);
    assert.equal(await db.auditLog.count({ where: { companyId: company.id, resourceId: id } }), 3);
    await assert.rejects(persistAffiliate(db, { ...actor, userId: crypto.randomUUID() }, { ...data, email: `rollback-${suffix}@example.com` }, "", 0));
    assert.equal(await db.affiliateProfile.count({ where: { companyId: company.id } }), 1);
    await persistAffiliateDefault(db, actor, 2500, 0);
    await persistAffiliateDefault(db, actor, 3000, 1);
    await assert.rejects(persistAffiliateDefault(db, actor, 5000, 1), /STALE_RECORD/);
    assert.equal((await db.affiliateProgramSetting.findUniqueOrThrow({ where: { companyId: company.id } })).commissionBps, 3000);
    assert.equal(await db.order.count({ where: { companyId: company.id } }), 0);
    assert.equal(await db.payoutTransfer.count({ where: { companyId: company.id } }), 0);
    const loginId = await persistAffiliate(db, actor, { ...data, email: `login-${suffix}@example.com`, status: "APPROVED" }, "", 0);
    const identity = { id: crypto.randomUUID(), email: `login-${suffix}@example.com`, email_confirmed_at: new Date().toISOString() };
    await assert.rejects(persistAffiliateLogin(db, actor, loginId, 1, { ...identity, email_confirmed_at: undefined }), /UNVERIFIED_IDENTITY/);
    await assert.rejects(persistAffiliateLogin(db, actor, loginId, 1, { ...identity, email: "other@example.com" }), /STALE_RECORD/);
    await assert.rejects(persistAffiliateLogin(db, { ...actor, companyId: other.id }, loginId, 1, identity), /STALE_RECORD/);
    await persistAffiliateLogin(db, actor, loginId, 1, identity);
    await assert.rejects(persistAffiliateLogin(db, actor, loginId, 2, { ...identity, id: crypto.randomUUID() }), /STALE_RECORD/);
    await assert.rejects(persistAffiliate(db, actor, { ...data, email: `changed-${suffix}@example.com` }, loginId, 2), /LINKED_EMAIL_LOCKED/);
    assert.equal((await db.affiliateProfile.findUniqueOrThrow({ where: { id: loginId } })).authUserId, identity.id);
    assert.equal(await db.auditLog.count({ where: { companyId: company.id, resourceId: loginId } }), 2);
  } finally { await db.$disconnect(); }
});
