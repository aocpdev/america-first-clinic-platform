import assert from "node:assert/strict";
import test from "node:test";
import { PrismaClient } from "@prisma/client";
import { prepareRxCommission, settleRxCommission, holdRefundedRxCommission } from "./rx-settlement";
import { receiveAffiliateApplication } from "./affiliate-application";

const url = process.env.RX_TEST_DATABASE_URL;
function localDb() {
  const target = new URL(url!);
  assert.equal(target.hostname, "127.0.0.1"); assert.equal(target.port, "55439"); assert.equal(target.pathname, "/gvh_affiliate_test");
  return new PrismaClient({ datasources: { db: { url } } });
}
test("paid affiliate purchases preserve ownership, frozen terms, idempotency, zero and refund holds", { skip: !url }, async () => {
  const db = localDb();
  try {
    const suffix = crypto.randomUUID();
    const company = await db.company.create({ data: { name: "Local settlement test", slug: `settlement-${suffix}` } });
    await db.affiliateProgramSetting.create({ data: { companyId: company.id, commissionBps: 2500 } });
    const a = await db.affiliateProfile.create({ data: { companyId: company.id, displayName: "Original", email: "a@example.test", referralCode: `AF-A-${suffix}`, status: "APPROVED" } });
    const b = await db.affiliateProfile.create({ data: { companyId: company.id, displayName: "Later", email: "b@example.test", referralCode: `AF-B-${suffix}`, status: "APPROVED", commissionBps: 9000 } });
    const customer = await db.customer.create({ data: { companyId: company.id, email: "customer@example.test", tags: [] } });
    const referral = (profileId: string) => ({ companyId: company.id, role: "AFFILIATE" as const, profileId });
    const order = (customerId = customer.id) => db.order.create({ data: { companyId: company.id, customerId, subtotalCents: 22900, totalCents: 22900, grossMarginCents: 11100, paymentProviderCode: "stripe" } });
    const prepare = (orderId: string, profileId = a.id, customerId = customer.id) => prepareRxCommission(db, { companyId: company.id, customerId, orderId, referral: referral(profileId) });
    const capture = async (orderId: string) => {
      await db.order.update({ where: { id: orderId }, data: { paymentStatus: "CAPTURED" } });
      return db.paymentTransaction.create({ data: { companyId: company.id, orderId, providerCode: "stripe", amountCents: 22900, status: "CAPTURED" } });
    };
    const first = await order();
    const drafts = await Promise.all([prepare(first.id), prepare(first.id)]);
    assert.equal(drafts[0].amountCents, 2775); assert.equal(drafts[1].rateBps, 2500);
    await assert.rejects(prepare((await order()).id, b.id), /FIRST_PURCHASE_ALREADY_PENDING/);
    assert.equal(await db.rxCustomerOwner.count({ where: { customerId: customer.id } }), 0);
    await assert.rejects(settleRxCommission(db, { companyId: company.id, orderId: first.id, captureId: crypto.randomUUID() }), /VERIFIED_CAPTURE_REQUIRED/);
    await db.affiliateProfile.update({ where: { id: a.id }, data: { commissionBps: 3000 } });
    const payment = await capture(first.id);
    const input = { companyId: company.id, orderId: first.id, captureId: payment.id };
    const settled = await Promise.all([settleRxCommission(db, input), settleRxCommission(db, input)]);
    assert.equal(settled[0].status, "PENDING"); assert.equal(settled[1].amountCents, 2775);
    assert.equal((await db.rxCustomerOwner.findUniqueOrThrow({ where: { customerId: customer.id } })).profileId, a.id);
    await db.rxOrderCommission.update({ where: { orderId: first.id }, data: { status: "PAID" } });
    assert.equal((await settleRxCommission(db, input)).status, "PAID");
    const second = await order();
    const repeat = await prepare(second.id, b.id);
    assert.equal(repeat.profileId, a.id); assert.equal(repeat.rateBps, 3000); assert.equal(repeat.amountCents, 3330);
    await assert.rejects(settleRxCommission(db, { ...input, orderId: second.id }), /VERIFIED_CAPTURE_REQUIRED/);
    const secondPayment = await capture(second.id);
    await settleRxCommission(db, { ...input, orderId: second.id, captureId: secondPayment.id });
    await db.affiliateProfile.update({ where: { id: a.id }, data: { commissionBps: 0 } });
    const zeroOrder = await order();
    assert.equal((await prepare(zeroOrder.id, b.id)).amountCents, 0);
    const zeroPayment = await capture(zeroOrder.id);
    assert.equal((await settleRxCommission(db, { ...input, orderId: zeroOrder.id, captureId: zeroPayment.id })).status, "NOT_PAYABLE");
    const earlyRefund = await order();
    await prepare(earlyRefund.id);
    const earlyCapture = await capture(earlyRefund.id);
    await db.paymentTransaction.create({ data: { companyId: company.id, orderId: earlyRefund.id, providerCode: "stripe", status: "REFUNDED", amountCents: 1000 } });
    assert.equal((await holdRefundedRxCommission(db, company.id, earlyRefund.id)).status, "ON_HOLD");
    await assert.rejects(settleRxCommission(db, { ...input, orderId: earlyRefund.id, captureId: earlyCapture.id }), /REFUNDED_COMMISSION_REVIEW_REQUIRED/);
    await assert.rejects(holdRefundedRxCommission(db, company.id, first.id), /CONFIRMED_REFUND_REQUIRED/);
    await db.paymentTransaction.create({ data: { companyId: company.id, orderId: first.id, providerCode: "stripe", status: "REFUNDED", amountCents: 1000 } });
    assert.equal((await holdRefundedRxCommission(db, company.id, first.id)).status, "RECOVERY_REQUIRED");
    assert.equal((await settleRxCommission(db, input)).status, "RECOVERY_REQUIRED");
    await assert.rejects(db.rxCustomerOwner.update({ where: { customerId: customer.id }, data: { profileId: b.id } }), /ORIGINAL_OWNER_IMMUTABLE/);
    await assert.rejects(db.rxOrderCommission.update({ where: { orderId: first.id }, data: { amountCents: 9999 } }), /COMMISSION_TERMS_IMMUTABLE/);
    await db.affiliateProfile.update({ where: { id: a.id }, data: { status: "SUSPENDED" } });
    await assert.rejects(prepare((await order()).id, b.id), /ORIGINAL_SELLER_REVIEW_REQUIRED/);
    const historical = await db.customer.create({ data: { companyId: company.id, email: "historical@example.test", tags: [] } });
    await capture((await order(historical.id)).id);
    await assert.rejects(prepare((await order(historical.id)).id, b.id, historical.id), /HISTORICAL_OWNER_REVIEW_REQUIRED/);
    assert.equal(await db.commission.count({ where: { companyId: company.id } }), 0);
    assert.equal(await db.payoutTransfer.count({ where: { companyId: company.id } }), 0);
  } finally { await db.$disconnect(); }
});

test("original internal agent retains the existing ledger, even through a different affiliate link", { skip: !url }, async () => {
  const db = localDb();
  try {
    const suffix = crypto.randomUUID();
    const company = await db.company.create({ data: { name: "Local agent settlement", slug: `agent-settlement-${suffix}` } });
    const user = await db.user.create({ data: { companyId: company.id, authUserId: suffix, email: `${suffix}@example.test`, role: "CONSULTANT" } });
    const agent = await db.consultantProfile.create({ data: { companyId: company.id, userId: user.id, referralSlug: suffix, referralCode: suffix } });
    const customer = await db.customer.create({ data: { companyId: company.id, email: "customer@example.test", tags: [] } });
    const createOrder = async () => {
      const order = await db.order.create({ data: { companyId: company.id, customerId: customer.id, consultantProfileId: agent.id, subtotalCents: 10000, totalCents: 10000, grossMarginCents: 4000, paymentProviderCode: "stripe" } });
      await db.commissionSplit.create({ data: { companyId: company.id, orderId: order.id, consultantProfileId: agent.id, participantRole: "CONSULTANT", amountCents: 777, grossMarginCents: 4000, commissionPoolCents: 1000 } });
      return order;
    };
    const original = await createOrder();
    await db.order.update({ where: { id: original.id }, data: { paymentStatus: "CAPTURED" } });
    await db.paymentTransaction.create({ data: { companyId: company.id, orderId: original.id, providerCode: "stripe", status: "CAPTURED", amountCents: 10000 } });
    const repeat = await createOrder();
    const snapshot = await prepareRxCommission(db, { companyId: company.id, customerId: customer.id, orderId: repeat.id, referral: { companyId: company.id, role: "AFFILIATE", profileId: crypto.randomUUID() } });
    assert.equal(snapshot.profileId, agent.id); assert.equal(snapshot.amountCents, 777); assert.equal(snapshot.rateBps, null);
    await db.order.update({ where: { id: repeat.id }, data: { paymentStatus: "CAPTURED" } });
    const capture = await db.paymentTransaction.create({ data: { companyId: company.id, orderId: repeat.id, providerCode: "stripe", status: "CAPTURED", amountCents: 10000 } });
    assert.equal((await settleRxCommission(db, { companyId: company.id, orderId: repeat.id, captureId: capture.id })).status, "EXISTING_LEDGER");
    assert.equal(await db.commissionSplit.count({ where: { companyId: company.id } }), 2);
    assert.equal(await db.payoutTransfer.count({ where: { companyId: company.id } }), 0);
  } finally { await db.$disconnect(); }
});

test("public applications are pending, deduplicated and cannot modify existing approved affiliates", { skip: !url }, async () => {
  const db = localDb();
  try {
    const company = await db.company.create({ data: { name: "Local application test", slug: `application-${crypto.randomUUID()}` } });
    const input = { displayName: "Sample Creator", email: "creator@example.test", category: "ARTIST" as const, website: "https://example.test", message: "Local test only", consent: "yes" as const, companyWebsite: "" as const };
    await Promise.all([receiveAffiliateApplication(db, company.id, input, "same-token"), receiveAffiliateApplication(db, company.id, input, "same-token")]);
    const affiliate = await db.affiliateProfile.findUniqueOrThrow({ where: { companyId_email: { companyId: company.id, email: input.email } } });
    assert.equal(affiliate.status, "PENDING"); assert.equal(affiliate.commissionBps, null); assert.equal(affiliate.authUserId, null);
    await db.affiliateProfile.update({ where: { id: affiliate.id }, data: { status: "APPROVED", commissionBps: 3300 } });
    await receiveAffiliateApplication(db, company.id, { ...input, displayName: "Impersonation attempt" }, "new-token");
    const unchanged = await db.affiliateProfile.findUniqueOrThrow({ where: { id: affiliate.id } });
    assert.equal(unchanged.displayName, input.displayName); assert.equal(unchanged.commissionBps, 3300); assert.equal(unchanged.status, "APPROVED");
    assert.equal(await db.auditLog.count({ where: { companyId: company.id, action: "AFFILIATE_APPLICATION_RECEIVED" } }), 1);
    await db.auditLog.createMany({ data: Array.from({ length: 98 }, (_, index) => ({ companyId: company.id, action: "AFFILIATE_APPLICATION_ATTEMPT", resource: "AffiliateApplication", resourceId: `rate-test-${index}` })) });
    await assert.rejects(receiveAffiliateApplication(db, company.id, { ...input, email: "excess@example.test" }, "excess-token"), /APPLICATION_RATE_LIMIT/);
  } finally { await db.$disconnect(); }
});
