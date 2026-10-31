import assert from "node:assert/strict";
import test from "node:test";
import { PrismaClient } from "@prisma/client";
import { localAcquisitionPrototype } from "./rx-acquisition-prototype";

const url = process.env.RX_TEST_DATABASE_URL;
test("affiliate snapshots freeze each order's terms and repeat purchases retain the original affiliate", { skip: !url }, async () => {
  const prototype = localAcquisitionPrototype(url!);
  const db = new PrismaClient({ datasources: { db: { url: url! } } });
  try {
    const suffix = crypto.randomUUID();
    const company = await db.company.create({ data: { name: "Affiliate capture experiment", slug: `affiliate-capture-${suffix}` } });
    await db.affiliateProgramSetting.create({ data: { companyId: company.id, commissionBps: 2500 } });
    const a = await db.affiliateProfile.create({ data: { companyId: company.id, displayName: "Original affiliate", email: `a-${suffix}@example.test`, referralCode: `AF-A-${suffix}`, status: "APPROVED" } });
    const b = await db.affiliateProfile.create({ data: { companyId: company.id, displayName: "Another affiliate", email: `b-${suffix}@example.test`, referralCode: `AF-B-${suffix}`, status: "APPROVED", commissionBps: 9000 } });
    const customer = await db.customer.create({ data: { companyId: company.id, email: `customer-${suffix}@example.test`, tags: [] } });
    const newOrder = (customerId: string) => db.order.create({ data: { companyId: company.id, customerId, subtotalCents: 10000, totalCents: 10000, paymentProviderCode: "stripe" } });
    const capture = async (orderId: string, createdAt?: Date) => {
      await db.order.update({ where: { id: orderId }, data: { paymentStatus: "CAPTURED" } });
      return db.paymentTransaction.create({ data: { companyId: company.id, orderId, amountCents: 10000, providerCode: "stripe", status: "CAPTURED", createdAt } });
    };
    const first = await newOrder(customer.id);
    const snapshot = await prototype.snapshotAffiliate(company.id, first.id, a.id);
    assert.equal(snapshot.terms.rateBps, 2500);
    assert.equal(snapshot.terms.rateSource, "COMPANY_DEFAULT");
    assert.equal(snapshot.terms.deductAgencyFeeFromBasis, false);
    const competingDraft = await newOrder(customer.id);
    await prototype.snapshotAffiliate(company.id, competingDraft.id, b.id);
    const forgedOrder = await newOrder(customer.id);
    const forged = { ...snapshot.terms, rateBps: 7500 };
    await assert.rejects(db.$executeRaw`INSERT INTO rx_acquisition_prototype.affiliate_order
      ("orderId", "companyId", "affiliateId", terms) VALUES
      (${forgedOrder.id}::uuid, ${company.id}::uuid, ${a.id}::uuid, ${JSON.stringify(forged)}::jsonb)`, /INVALID_AFFILIATE_TERMS/);
    const parallelOrder = await newOrder(customer.id);
    const parallel = await Promise.all([
      prototype.snapshotAffiliate(company.id, parallelOrder.id, a.id),
      prototype.snapshotAffiliate(company.id, parallelOrder.id, a.id)
    ]);
    assert.equal(parallel[0].terms.rateBps, parallel[1].terms.rateBps);
    await db.affiliateProgramSetting.update({ where: { companyId: company.id }, data: { commissionBps: 4000 } });
    assert.equal((await prototype.snapshotAffiliate(company.id, first.id, a.id)).terms.rateBps, 2500);
    await assert.rejects(prototype.snapshotAffiliate(company.id, first.id, b.id), /AFFILIATE_ORDER_CONFLICT/);
    await assert.rejects(db.$executeRaw`UPDATE rx_acquisition_prototype.affiliate_order SET "affiliateId" = ${b.id}::uuid WHERE "orderId" = ${first.id}::uuid`, /AFFILIATE_ORDER_IMMUTABLE/);
    await assert.rejects(db.$executeRaw`DELETE FROM rx_acquisition_prototype.affiliate_order WHERE "orderId" = ${first.id}::uuid`, /AFFILIATE_ORDER_IMMUTABLE/);
    await db.affiliateProfile.update({ where: { id: a.id }, data: { commissionBps: 0 } });
    const zeroCustomer = await db.customer.create({ data: { companyId: company.id, email: `zero-${suffix}@example.test`, tags: [] } });
    const zeroOrder = await newOrder(zeroCustomer.id);
    const zero = await prototype.snapshotAffiliate(company.id, zeroOrder.id, a.id);
    assert.equal(zero.terms.rateBps, 0);
    assert.equal(zero.terms.rateSource, "AFFILIATE_OVERRIDE");
    const paid = await capture(first.id, new Date("2026-01-01T10:00:00Z"));
    const ownership = await prototype.confirm(company.id, customer.id, paid.id);
    assert.equal(ownership.status, "CREATED");
    if (ownership.status === "CREATED") {
      assert.equal(ownership.owner.sellerRole, "AFFILIATE");
      assert.equal(ownership.owner.profileId, a.id);
    }
    const competingCapture = await capture(competingDraft.id);
    const conflict = await prototype.confirm(company.id, customer.id, competingCapture.id);
    assert.equal(conflict.status, "REVIEW_REQUIRED");
    assert.ok("owner" in conflict);
    if ("owner" in conflict && conflict.owner) assert.equal(conflict.owner.profileId, a.id);
    await db.affiliateProfile.update({ where: { id: a.id }, data: { commissionBps: 3300 } });
    const second = await newOrder(customer.id);
    const repeat = await prototype.snapshotAffiliate(company.id, second.id, b.id);
    assert.equal(repeat.affiliateId, a.id);
    assert.equal(repeat.terms.rateBps, 3300);
    const paidAgain = await capture(second.id);
    const retained = await prototype.confirm(company.id, customer.id, paidAgain.id);
    assert.equal(retained.status, "RETAINED");
    if (retained.status === "RETAINED") assert.equal(retained.owner.profileId, a.id);
    assert.equal((await prototype.snapshotAffiliate(company.id, first.id, a.id)).terms.rateBps, 2500);
    await db.affiliateProfile.update({ where: { id: a.id }, data: { status: "SUSPENDED" } });
    const blockedRepeat = await newOrder(customer.id);
    await assert.rejects(prototype.snapshotAffiliate(company.id, blockedRepeat.id, b.id), /AFFILIATE_UNAVAILABLE/);
    const historical = await db.customer.create({ data: { companyId: company.id, email: `historical-${suffix}@example.test`, tags: [] } });
    await capture((await newOrder(historical.id)).id);
    await assert.rejects(prototype.snapshotAffiliate(company.id, (await newOrder(historical.id)).id, b.id), /HISTORICAL_OWNER_REVIEW_REQUIRED/);
    await assert.rejects(prototype.snapshotAffiliate("00000000-0000-4000-8000-000000000001", zeroOrder.id, b.id), /ORDER_UNAVAILABLE/);
    assert.equal(await db.commission.count({ where: { companyId: company.id } }), 0);
    assert.equal(await db.payoutTransfer.count({ where: { companyId: company.id } }), 0);
  } finally { await prototype.close(); await db.$disconnect(); }
});
