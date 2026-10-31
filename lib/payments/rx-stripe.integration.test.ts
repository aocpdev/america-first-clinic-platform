import assert from "node:assert/strict";
import test from "node:test";
import Stripe from "stripe";
import { PrismaClient, type Prisma } from "@prisma/client";
import { createRxStripeCheckout } from "./rx-stripe-checkout";
import { acceptRxStripePayment } from "./rx-stripe-capture";
import { acceptRxStripeRefund } from "./rx-stripe-refund";
import { RX_PAYMENT_SOURCE } from "./rx-stripe-policy";
import { prepareRxCommission } from "../referrals/rx-settlement";

const url = process.env.RX_TEST_DATABASE_URL;
const config = { mode: "live" as const, secretKey: "sk_live_local_simulation_only", webhookSecret: "whsec_local_simulation_only", configured: true, webhookConfigured: true };
const stripe = new Stripe(config.secretKey);
function signed(event: unknown) {
  const body = JSON.stringify(event);
  return { body, signature: stripe.webhooks.generateTestHeaderString({ payload: body, secret: config.webhookSecret }) };
}

test("live-mode RX adapter: simulated signed payment, concurrent replay, original affiliate on repurchase, unchanged agency configuration", { skip: !url }, async () => {
  const target = new URL(url!);
  assert.equal(target.hostname, "127.0.0.1"); assert.equal(target.port, "55439"); assert.equal(target.pathname, "/gvh_affiliate_test");
  const db = new PrismaClient({ datasources: { db: { url } } });
  try {
    const suffix = crypto.randomUUID();
    const company = await db.company.create({ data: { name: "Local RX Stripe simulation", slug: `rx-stripe-${suffix}` } });
    await db.paymentProvider.create({ data: { companyId: company.id, code: "stripe", label: "Local fake gateway", active: true, isDefault: true, mode: "live" } });
    const agency = await db.agencyFeeSetting.create({ data: { companyId: company.id, isEnabled: true, feeBps: 1000, stripeConnectedAccountId: "acct_local_fixture_only" } });
    const category = await db.productCategory.create({ data: { companyId: company.id, name: "Local", slug: "local" } });
    const product = await db.product.create({ data: { companyId: company.id, categoryId: category.id, title: "Admin product", slug: "sample", sku: "sample", description: "Local test", priceCents: 22900, internalCostCents: 11800 } });
    const customer = await db.customer.create({ data: { companyId: company.id, email: "customer@example.test", tags: [] } });
    const a = await db.affiliateProfile.create({ data: { companyId: company.id, displayName: "Original", email: "a@example.test", referralCode: `AF-A-${suffix}`, status: "APPROVED", commissionBps: 2500 } });
    const b = await db.affiliateProfile.create({ data: { companyId: company.id, displayName: "Other", email: "b@example.test", referralCode: `AF-B-${suffix}`, status: "APPROVED", commissionBps: 9000 } });
    const createOrder = async (profileId: string) => {
      const order = await db.order.create({ data: { companyId: company.id, customerId: customer.id, subtotalCents: product.priceCents, totalCents: product.priceCents, grossMarginCents: product.priceCents - product.internalCostCents, paymentProviderCode: "stripe", referralSource: RX_PAYMENT_SOURCE,
        items: { create: { productId: product.id, quantity: 1, unitPriceCents: product.priceCents, totalCents: product.priceCents } } } });
      await prepareRxCommission(db, { companyId: company.id, customerId: customer.id, orderId: order.id, referral: { companyId: company.id, role: "AFFILIATE", profileId } });
      return { companyId: company.id, customerId: customer.id, orderId: order.id };
    };
    const requests = new Map<string, Stripe.Checkout.SessionCreateParams>();
    const deps = { enabled: true, catalogPreview: false, configuration: () => config, gateway: () => ({ create: async (params: Stripe.Checkout.SessionCreateParams, key: string) => {
      if (requests.has(key)) assert.deepEqual(params, requests.get(key));
      requests.set(key, params);
      assert.equal(params.payment_intent_data?.transfer_data, undefined);
      assert.equal(params.payment_intent_data?.application_fee_amount, undefined);
      return { id: `cs_${params.metadata!.orderId}`, url: `https://checkout.stripe.com/c/pay/${params.metadata!.orderId}`, livemode: true, status: "open" as const };
    } }) };
    const pay = async (input: Awaited<ReturnType<typeof createOrder>>, options: Record<string, unknown> = {}) => {
      const event = { id: `evt_${input.orderId}`, type: "payment_intent.succeeded", livemode: true, data: { object: { object: "payment_intent", id: `pi_${input.orderId}`, livemode: true, status: "succeeded", amount: 22900, amount_received: 22900, currency: "usd", metadata: { ...input, source: RX_PAYMENT_SOURCE, stripeMode: "live" }, ...options } } };
      const { body, signature } = signed(event);
      return acceptRxStripePayment(db, body, signature, config);
    };
    const first = await createOrder(a.id);
    await assert.rejects(createRxStripeCheckout(db, first, { ...deps, enabled: false }), /DISABLED/);
    await assert.rejects(createRxStripeCheckout(db, first, { ...deps, catalogPreview: true }), /DISABLED/);
    await assert.rejects(createRxStripeCheckout(db, first, { ...deps, configuration: () => ({ ...config, secretKey: "sk_test_wrong_environment" }) }), /CONFIGURATION_REQUIRED/);
    assert.equal(requests.size, 0);
    const sessions = await Promise.all([createRxStripeCheckout(db, first, deps), createRxStripeCheckout(db, first, deps)]);
    assert.equal(sessions[0].sessionId, sessions[1].sessionId); assert.equal(requests.size, 1);
    const sessionEvent = (paid: boolean) => signed({ id: "evt_session", type: "checkout.session.completed", livemode: true, data: { object: {
      object: "checkout.session", id: sessions[0].sessionId, mode: "payment", livemode: true, client_reference_id: first.orderId,
      payment_status: paid ? "paid" : "unpaid", amount_total: 22900, currency: "usd", payment_intent: `pi_${first.orderId}`,
      metadata: { ...first, source: RX_PAYMENT_SOURCE, stripeMode: "live" }
    } } });
    const unpaid = sessionEvent(false);
    assert.equal((await acceptRxStripePayment(db, unpaid.body, unpaid.signature, config)).status, "AWAITING_PAYMENT");
    await assert.rejects(pay(first, { amount_received: 1 }), /AMOUNT_MISMATCH/);
    await assert.rejects(acceptRxStripePayment(db, "{}", "invalid", config));
    assert.equal(await db.paymentTransaction.count({ where: { companyId: company.id } }), 0);
    const payments = await Promise.all([pay(first), pay(first)]);
    assert.equal(payments.filter(p => p.status === "CAPTURED" && p.newlyCaptured).length, 1);
    assert.equal(payments[0].status, "CAPTURED");
    if (payments[0].status === "CAPTURED") assert.deepEqual(payments[0].agencyFeeInput, { orderId: first.orderId, paymentIntentId: `pi_${first.orderId}`, livemode: true, metadataMode: "live" });
    assert.equal((await db.rxOrderCommission.findUniqueOrThrow({ where: { orderId: first.orderId } })).amountCents, 2775);
    await db.rxOrderCommission.update({ where: { orderId: first.orderId }, data: { status: "PAID" } });
    await db.order.update({ where: { id: first.orderId }, data: { orderPipelineStage: "FULFILLED" } });
    await pay(first);
    const paidSession = sessionEvent(true);
    assert.equal((await acceptRxStripePayment(db, paidSession.body, paidSession.signature, config)).status, "CAPTURED");
    assert.equal((await db.rxOrderCommission.findUniqueOrThrow({ where: { orderId: first.orderId } })).status, "PAID");
    assert.equal((await db.order.findUniqueOrThrow({ where: { id: first.orderId } })).orderPipelineStage, "FULFILLED");
    await assert.rejects(pay(first, { id: "pi_different_payment" }), /RECONCILIATION_REQUIRED/);
    const second = await createOrder(b.id);
    await createRxStripeCheckout(db, second, deps);
    await pay(second);
    const repeat = await db.rxOrderCommission.findUniqueOrThrow({ where: { orderId: second.orderId } });
    assert.equal(repeat.profileId, a.id); assert.equal(repeat.amountCents, 2775);
    assert.equal((await db.customer.findUniqueOrThrow({ where: { id: customer.id } })).lifetimeValueCents, 45800);
    assert.equal(await db.paymentTransaction.count({ where: { companyId: company.id, status: "CAPTURED" } }), 2);
    assert.deepEqual(await db.agencyFeeSetting.findUniqueOrThrow({ where: { id: agency.id } }), agency);
    assert.equal(await db.agencyFeeTransaction.count({ where: { companyId: company.id } }), 0);
    assert.equal(await db.payoutTransfer.count({ where: { companyId: company.id } }), 0);
    // A refunded order cannot be reopened by a delayed successful-payment event.
    await db.order.update({ where: { id: second.orderId }, data: { paymentStatus: "REFUNDED" } });
    assert.equal((await pay(second)).status, "ALREADY_REFUNDED");
    // Never reuse a key beyond Stripe's 24-hour idempotency retention window.
    const third = await createOrder(a.id);
    await createRxStripeCheckout(db, third, deps);
    const row = await db.order.findUniqueOrThrow({ where: { id: third.orderId } });
    const metadata = row.referralMetadata as Prisma.JsonObject;
    await db.order.update({ where: { id: third.orderId }, data: { referralMetadata: { ...metadata, rxCheckout: { ...(metadata.rxCheckout as Prisma.JsonObject), createdAt: "2020-01-01T00:00:00.000Z" } } as Prisma.InputJsonValue } });
    await assert.rejects(createRxStripeCheckout(db, third, deps), /RECONCILIATION_REQUIRED/);
    const fourth = await createOrder(a.id);
    await createRxStripeCheckout(db, fourth, deps);
    await db.affiliateProfile.update({ where: { id: a.id }, data: { status: "SUSPENDED" } });
    await assert.rejects(pay(fourth), /ORIGINAL_SELLER_REVIEW_REQUIRED/);
    assert.equal((await db.order.findUniqueOrThrow({ where: { id: fourth.orderId } })).paymentStatus, "CAPTURED");
    await db.affiliateProfile.update({ where: { id: a.id }, data: { status: "APPROVED" } });
    assert.equal((await pay(fourth)).status, "CAPTURED");
    assert.equal(await db.paymentTransaction.count({ where: { orderId: fourth.orderId, status: "CAPTURED" } }), 1);
    assert.equal((await db.customer.findUniqueOrThrow({ where: { id: customer.id } })).lifetimeValueCents, 68700);
    const refund = async (input: typeof first, cumulative: number, overrides: Record<string, unknown> = {}) => {
      const event = signed({ id: `evt_refund_${input.orderId}_${cumulative}`, type: "charge.refunded", livemode: true, data: { object: {
        object: "charge", id: `ch_${input.orderId}`, payment_intent: `pi_${input.orderId}`, amount: 22900, amount_refunded: cumulative,
        currency: "usd", paid: true, captured: true, livemode: true,
        metadata: { ...input, source: RX_PAYMENT_SOURCE, stripeMode: "live" }, ...overrides
      } } });
      return acceptRxStripeRefund(db, event.body, event.signature, config);
    };
    await assert.rejects(acceptRxStripeRefund(db, "{}", "invalid", config));
    for (const overrides of [{ currency: "eur" }, { amount: 1 }, { payment_intent: "pi_other" }, { livemode: false },
      { metadata: { ...fourth, source: RX_PAYMENT_SOURCE, stripeMode: "test" } },
      { metadata: { ...fourth, customerId: crypto.randomUUID(), source: RX_PAYMENT_SOURCE, stripeMode: "live" } }]) {
      await assert.rejects(refund(fourth, 1000, overrides));
    }
    await assert.rejects(refund(fourth, 23000));
    await assert.rejects(refund(third, 1000)); // pending, never captured
    assert.equal(await db.paymentTransaction.count({ where: { companyId: company.id, status: "REFUNDED" } }), 0);
    await db.order.update({ where: { id: fourth.orderId }, data: { orderPipelineStage: "FULFILLED" } });
    const partials = await Promise.all([refund(fourth, 2500), refund(fourth, 2500)]);
    assert.equal(partials.filter(r => r.status === "REFUND_RECORDED" && r.newlyRefundedCents === 2500).length, 1);
    assert.equal((await db.rxOrderCommission.findUniqueOrThrow({ where: { orderId: fourth.orderId } })).status, "ON_HOLD");
    assert.equal((await db.order.findUniqueOrThrow({ where: { id: fourth.orderId } })).orderPipelineStage, "FULFILLED");
    assert.equal((await pay(fourth)).status, "ALREADY_REFUNDED"); // no replayed agency transfer input after partial refund
    await Promise.all([refund(fourth, 5000), refund(fourth, 3000)]);
    const stale = await refund(fourth, 2500);
    assert.equal(stale.status, "REFUND_RECORDED");
    if (stale.status === "REFUND_RECORDED") {
      assert.equal(stale.newlyRefundedCents, 0); assert.equal(stale.cumulativeRefundedCents, 5000);
      assert.equal(stale.agencyFeeReversalInput.refundedAmountCents, 5000);
    }
    await Promise.all([refund(fourth, 22900), refund(fourth, 22900)]);
    assert.equal((await db.paymentTransaction.aggregate({ where: { orderId: fourth.orderId, status: "REFUNDED" }, _sum: { amountCents: true } }))._sum.amountCents, 22900);
    assert.equal((await db.order.findUniqueOrThrow({ where: { id: fourth.orderId } })).paymentStatus, "REFUNDED");
    await refund(first, 22900);
    assert.equal((await db.rxOrderCommission.findUniqueOrThrow({ where: { orderId: first.orderId } })).status, "RECOVERY_REQUIRED");
    assert.equal((await db.rxCustomerOwner.findUniqueOrThrow({ where: { customerId: customer.id } })).profileId, a.id);
    assert.deepEqual(await db.agencyFeeSetting.findUniqueOrThrow({ where: { id: agency.id } }), agency);
    assert.equal(await db.agencyFeeTransaction.count({ where: { companyId: company.id } }), 0);
    assert.equal(await db.payoutTransfer.count({ where: { companyId: company.id } }), 0);
  } finally { await db.$disconnect(); }
});
