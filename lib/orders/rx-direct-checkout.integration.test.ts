import assert from "node:assert/strict";
import test from "node:test";
import { PrismaClient } from "@prisma/client";
import Stripe from "stripe";
import { createRxCheckoutOrder } from "./rx-checkout-order";
import { createRxStripeCheckout } from "../payments/rx-stripe-checkout";
import { processRxStripeWebhook } from "../payments/rx-stripe-webhook";
import { RX_PAYMENT_SOURCE } from "../payments/rx-stripe-policy";
import { reconcileRxAgencyFee, type RxAgencyGateway } from "../payments/rx-agency-fee";
import { acceptRxStripeRefund } from "../payments/rx-stripe-refund";
import { holdRefundedRxCommission } from "../referrals/rx-settlement";
import { parseRxOwner } from "../referrals/rx-owner-policy";

const url = process.env.RX_TEST_DATABASE_URL;
const config = { mode: "live" as const, secretKey: "sk_live_simulation", webhookSecret: "whsec_simulation", configured: true, webhookConfigured: true };

test("DIRECT owner is an explicit tenant identity, not an unknown seller", () => {
  const companyId = crypto.randomUUID();
  assert.equal(parseRxOwner({ companyId, role: "DIRECT", profileId: companyId }).role, "DIRECT");
  assert.throws(() => parseRxOwner({ companyId, role: "DIRECT", profileId: crypto.randomUUID() }), /TENANT_MISMATCH/);
  assert.throws(() => parseRxOwner({ companyId, role: "UNKNOWN", profileId: companyId }));
});

test("direct paid purchases stay company-owned on repeats; no seller payouts, agency fee preserved", { skip: !url }, async () => {
  const target = new URL(url!);
  assert.equal(target.hostname, "127.0.0.1"); assert.equal(target.port, "55439"); assert.equal(target.pathname, "/gvh_affiliate_test");
  const db = new PrismaClient({ datasources: { db: { url } } });
  try {
    const suffix = crypto.randomUUID();
    const company = await db.company.create({ data: { name: "Direct checkout fixture", slug: `direct-${suffix}` } });
    const user = await db.user.create({ data: { companyId: company.id, authUserId: suffix, email: `${suffix}@example.test`, role: "CUSTOMER", status: "ACTIVE", isActive: true } });
    const customer = await db.customer.create({ data: { companyId: company.id, userId: user.id, email: user.email,
      firstName: "Direct", lastName: "Fixture", phone: "+13055550100", dateOfBirth: new Date("1990-01-01"), birthSex: "PREFER_NOT_TO_SAY", tags: [] } });
    const identity = { companyId: company.id, customerId: customer.id, userId: user.id };
    const category = await db.productCategory.create({ data: { companyId: company.id, name: "Weight Loss", slug: "weight-loss" } });
    const product = await db.product.create({ data: { companyId: company.id, categoryId: category.id, title: "Fixture", slug: "fixture", sku: "fixture", description: "Local only", priceCents: 22900, internalCostCents: 11800 } });
    await db.paymentProvider.create({ data: { companyId: company.id, code: "stripe", label: "Fake gateway", active: true, isDefault: true, mode: "live" } });
    await db.agencyFeeSetting.create({ data: { companyId: company.id, feeBps: 1000, isEnabled: true, stripeConnectedAccountId: "acct_direct_fixture" } });
    const affiliate = await db.affiliateProfile.create({ data: { companyId: company.id, email: "affiliate@example.test", displayName: "Later affiliate", referralCode: `AF-${suffix}`, status: "APPROVED", commissionBps: 2500 } });
    const payload = () => ({ requestId: crypto.randomUUID(), expectedTotalCents: 22900,
      shipping: { line1: "100 Test Street", city: "Miami", state: "FL", postalCode: "33101", country: "US" },
      cart: { items: [{ productId: product.id, quantity: 1 }], couponCode: "" } });
    await assert.rejects(createRxCheckoutOrder(db, identity, payload(), "INVALID-CODE"), /SELLER_REVIEW/);
    await db.affiliateProfile.update({ where: { id: affiliate.id }, data: { status: "SUSPENDED" } });
    await assert.rejects(createRxCheckoutOrder(db, identity, payload(), affiliate.referralCode), /SELLER_REVIEW/);
    await db.affiliateProfile.update({ where: { id: affiliate.id }, data: { status: "APPROVED" } });
    const first = await createRxCheckoutOrder(db, identity, payload(), null);
    assert.equal(await db.rxCustomerOwner.count({ where: { customerId: customer.id } }), 0);
    assert.deepEqual(await createRxCheckoutOrder(db, identity, payload(), affiliate.referralCode), first);
    const draft = await db.rxOrderCommission.findUniqueOrThrow({ where: { orderId: first.orderId } });
    assert.equal(draft.sellerRole, "DIRECT"); assert.equal(draft.profileId, company.id);
    assert.equal(draft.amountCents, 0); assert.equal(draft.rateBps, null);
    const feeTransfers = new Map<string, number>();
    const gateway: RxAgencyGateway = {
      charge: async intent => `ch_${intent.slice(3)}`,
      transfer: async (params, key) => {
        assert.equal(params.destination, "acct_direct_fixture");
        assert.equal(params.amount, 1110); // 10% of the Admin margin, not seller commission.
        feeTransfers.set(key, params.amount!);
        return { id: `tr_${key}`, amount: params.amount!, destination: params.destination as string, sourceCharge: params.source_transaction!, livemode: true };
      },
      reverse: async (transferId, amount) => ({ id: `trr_${transferId}`, amount, transferId })
    };
    const signer = new Stripe(config.secretKey);
    const sign = (body: string) => signer.webhooks.generateTestHeaderString({ payload: body, secret: config.webhookSecret });
    const paid = async (order: typeof first) => {
      await createRxStripeCheckout(db, order, { enabled: true, catalogPreview: false, configuration: () => config,
        gateway: () => ({ create: async params => {
          assert.equal(params.line_items?.[0].price_data?.unit_amount, 22900);
          assert.deepEqual(params.automatic_tax, { enabled: false });
          assert.equal(params.payment_intent_data?.transfer_data, undefined);
          return { id: `cs_${order.orderId}`, url: `https://checkout.stripe.com/c/pay/${order.orderId}`, livemode: true, status: "open" as const };
        } }) });
      const body = JSON.stringify({ id: `evt_${order.orderId}`, type: "payment_intent.succeeded", livemode: true, data: { object: {
        object: "payment_intent", id: `pi_${order.orderId}`, status: "succeeded", livemode: true, amount: 22900, amount_received: 22900, currency: "usd",
        metadata: { ...order, source: RX_PAYMENT_SOURCE, stripeMode: "live" }
      } } });
      const effects = { transferAgencyFee: async () => { await reconcileRxAgencyFee(db, order.orderId, config, gateway); },
        reverseAgencyFee: async () => {}, paymentCaptured: async () => {} };
      await processRxStripeWebhook(db, body, sign(body), config, "payment_intent.succeeded", effects);
      await processRxStripeWebhook(db, body, sign(body), config, "payment_intent.succeeded", effects);
      const snapshot = await db.rxOrderCommission.findUniqueOrThrow({ where: { orderId: order.orderId } });
      assert.equal(snapshot.sellerRole, "DIRECT"); assert.equal(snapshot.status, "NOT_PAYABLE"); assert.equal(snapshot.amountCents, 0);
      assert.equal(await db.paymentTransaction.count({ where: { orderId: order.orderId, status: "CAPTURED" } }), 1);
    };
    await paid(first);
    const owner = await db.rxCustomerOwner.findUniqueOrThrow({ where: { customerId: customer.id } });
    assert.equal(owner.sellerRole, "DIRECT"); assert.equal(owner.profileId, company.id); assert.equal(owner.sourceOrderId, first.orderId);
    const repeat = await createRxCheckoutOrder(db, identity, payload(), affiliate.referralCode);
    await paid(repeat);
    assert.deepEqual(await db.rxCustomerOwner.findUniqueOrThrow({ where: { customerId: customer.id } }), owner);
    assert.equal(feeTransfers.size, 2);
    assert.equal(await db.commission.count({ where: { companyId: company.id } }), 0);
    assert.equal(await db.commissionSplit.count({ where: { companyId: company.id } }), 0);
    assert.equal(await db.payoutTransfer.count({ where: { companyId: company.id } }), 0);
    const refundBody = JSON.stringify({ id: `evt_refund_${first.orderId}`, type: "charge.refunded", livemode: true, data: { object: {
      object: "charge", id: `ch_${first.orderId}`, payment_intent: `pi_${first.orderId}`, livemode: true, paid: true, captured: true,
      amount: 22900, amount_refunded: 22900, currency: "usd", metadata: { ...first, source: RX_PAYMENT_SOURCE, stripeMode: "live" }
    } } });
    const refund = await acceptRxStripeRefund(db, refundBody, sign(refundBody), config);
    assert.ok(refund.status === "REFUND_RECORDED");
    assert.equal(refund.commissionStatus, "NOT_PAYABLE"); assert.equal(refund.internalLedgerReviewRequired, false);
    assert.equal((await holdRefundedRxCommission(db, company.id, first.orderId)).status, "NOT_PAYABLE");
    await reconcileRxAgencyFee(db, first.orderId, config, gateway);
    assert.equal((await db.order.findUniqueOrThrow({ where: { id: first.orderId } })).agencyFeeStatus, "REVERSED");
    assert.deepEqual(await db.rxCustomerOwner.findUniqueOrThrow({ where: { customerId: customer.id } }), owner);

    // Existing unattributed sales must be reviewed, never converted into new DIRECT acquisition.
    const historicalUser = await db.user.create({ data: { companyId: company.id, authUserId: crypto.randomUUID(), email: `historical-${suffix}@example.test`, role: "CUSTOMER", status: "ACTIVE", isActive: true } });
    const historicalCustomer = await db.customer.create({ data: { companyId: company.id, userId: historicalUser.id, email: historicalUser.email,
      firstName: "Historical", lastName: "Fixture", phone: "+13055550100", dateOfBirth: new Date("1990-01-01"), birthSex: "PREFER_NOT_TO_SAY", tags: [] } });
    await db.order.create({ data: { companyId: company.id, customerId: historicalCustomer.id, paymentStatus: "CAPTURED", totalCents: 22900, subtotalCents: 22900, paymentProviderCode: "stripe",
      paymentTransactions: { create: { companyId: company.id, providerCode: "stripe", status: "CAPTURED", amountCents: 22900 } } } });
    const historicalIdentity = { companyId: company.id, customerId: historicalCustomer.id, userId: historicalUser.id };
    await assert.rejects(createRxCheckoutOrder(db, historicalIdentity, payload(), null), /HISTORICAL_OWNER_REVIEW_REQUIRED/);
    await assert.rejects(createRxCheckoutOrder(db, historicalIdentity, payload(), affiliate.referralCode), /HISTORICAL_OWNER_REVIEW_REQUIRED/);
  } finally { await db.$disconnect(); }
});
