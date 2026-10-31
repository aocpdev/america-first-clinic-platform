import assert from "node:assert/strict";
import test from "node:test";
import { PrismaClient } from "@prisma/client";
import { localAcquisitionPrototype } from "./rx-acquisition-prototype";

const url = process.env.RX_TEST_DATABASE_URL;
test("prototype cannot connect to production", () => {
  assert.throws(() => localAcquisitionPrototype("postgresql://example.com/live"), /LOCAL_DATABASE_ONLY/);
  assert.throws(() => localAcquisitionPrototype("postgresql://localhost/other"), /LOCAL_DATABASE_ONLY/);
});
test("capture attribution survives replay, concurrent confirmations and another agent", { skip: !url }, async () => {
  const prototype = localAcquisitionPrototype(url!);
  const db = new PrismaClient({ datasources: { db: { url: url! } } });
  try {
    const suffix = crypto.randomUUID();
    const company = await db.company.create({ data: { name: "Acquisition experiment", slug: `acquisition-${suffix}` } });
    const user = await db.user.create({ data: { companyId: company.id, authUserId: suffix, email: `${suffix}@example.test`, role: "CONSULTANT", status: "ACTIVE" } });
    const agent = await db.consultantProfile.create({ data: { companyId: company.id, userId: user.id, referralCode: `TEST-${suffix}`, referralSlug: `test-${suffix}` } });
    const customer = await db.customer.create({ data: { companyId: company.id, email: `customer-${suffix}@example.test`, tags: [] } });
    const order = await db.order.create({ data: { companyId: company.id, customerId: customer.id, consultantProfileId: agent.id, subtotalCents: 10000, totalCents: 10000, paymentProviderCode: "stripe" } });
    const pending = await db.paymentTransaction.create({ data: { companyId: company.id, orderId: order.id, amountCents: 10000, providerCode: "stripe", status: "PENDING" } });
    assert.equal((await prototype.confirm(company.id, customer.id, pending.id)).status, "REVIEW_REQUIRED");
    await db.order.update({ where: { id: order.id }, data: { paymentStatus: "CAPTURED" } });
    const capture = await db.paymentTransaction.create({ data: { companyId: company.id, orderId: order.id, amountCents: 10000, providerCode: "stripe", status: "CAPTURED", createdAt: new Date("2026-01-01T10:00:00Z") } });
    const confirmations = await Promise.all([
      prototype.confirm(company.id, customer.id, capture.id), prototype.confirm(company.id, customer.id, capture.id)
    ]);
    assert.deepEqual(confirmations.map(result => result.status).sort(), ["CREATED", "RETAINED"]);
    const otherUser = await db.user.create({ data: { companyId: company.id, authUserId: crypto.randomUUID(), email: `other-${suffix}@example.test`, role: "CONSULTANT", status: "ACTIVE" } });
    const otherAgent = await db.consultantProfile.create({ data: { companyId: company.id, userId: otherUser.id, referralCode: `OTHER-${suffix}`, referralSlug: `other-${suffix}` } });
    await db.customer.update({ where: { id: customer.id }, data: { consultantProfileId: otherAgent.id } });
    const reorder = await db.order.create({ data: { companyId: company.id, customerId: customer.id, consultantProfileId: otherAgent.id, subtotalCents: 10000, totalCents: 10000, paymentProviderCode: "stripe", paymentStatus: "CAPTURED" } });
    const secondCapture = await db.paymentTransaction.create({ data: { companyId: company.id, orderId: reorder.id, amountCents: 10000, providerCode: "stripe", status: "CAPTURED" } });
    const retained = await prototype.confirm(company.id, customer.id, secondCapture.id);
    assert.equal(retained.status, "RETAINED");
    if (retained.status === "RETAINED") assert.equal(retained.owner.profileId, agent.id);
    await assert.rejects(prototype.snapshotAffiliate(company.id, reorder.id, otherAgent.id), /ORIGINAL_INTERNAL_OWNER_REQUIRES_INTERNAL_ORDER_FLOW/);
    await assert.rejects(db.$executeRaw`UPDATE rx_acquisition_prototype.owner SET "profileId" = ${otherAgent.id}::uuid WHERE "customerId" = ${customer.id}::uuid`, /ACQUISITION_IMMUTABLE/);
    await assert.rejects(db.$executeRaw`DELETE FROM rx_acquisition_prototype.owner WHERE "customerId" = ${customer.id}::uuid`, /ACQUISITION_IMMUTABLE/);
    await assert.rejects(prototype.confirm("00000000-0000-4000-8000-000000000001", customer.id, capture.id), /CUSTOMER_UNAVAILABLE/);
    const otherCustomer = await db.customer.create({ data: { companyId: company.id, email: `direct-${suffix}@example.test`, tags: [] } });
    const direct = await db.order.create({ data: { companyId: company.id, customerId: otherCustomer.id, subtotalCents: 10000, totalCents: 10000, paymentProviderCode: "stripe", paymentStatus: "CAPTURED" } });
    const directCapture = await db.paymentTransaction.create({ data: { companyId: company.id, orderId: direct.id, amountCents: 10000, providerCode: "stripe", status: "CAPTURED" } });
    assert.equal((await prototype.confirm(company.id, otherCustomer.id, directCapture.id)).status, "REVIEW_REQUIRED");
    await assert.rejects(db.$executeRaw`INSERT INTO rx_acquisition_prototype.owner
      ("customerId", "companyId", "sourceOrderId", "captureTransactionId", "sellerRole", "profileId", "capturedAt")
      SELECT ${otherCustomer.id}::uuid, ${company.id}::uuid, ${order.id}::uuid, id,
        'CONSULTANT', ${agent.id}::uuid, "createdAt"
      FROM public."PaymentTransaction" WHERE id = ${capture.id}::uuid`, /INVALID_ACQUISITION_CAPTURE/);
    const security = await db.$queryRaw<Array<{ rls: boolean; publicUsage: boolean }>>`
      SELECT c.relrowsecurity AS rls,
        has_schema_privilege('anon', 'rx_acquisition_prototype', 'USAGE') AS "publicUsage"
      FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'rx_acquisition_prototype' AND c.relname = 'owner'`;
    assert.equal(security[0].rls, true);
    assert.equal(security[0].publicUsage, false);
    assert.equal(await db.commission.count({ where: { companyId: company.id } }), 0);
    assert.equal(await db.payoutTransfer.count({ where: { companyId: company.id } }), 0);
  } finally { await prototype.close(); await db.$disconnect(); }
});
