import assert from "node:assert/strict";
import test from "node:test";
import { PrismaClient } from "@prisma/client";
import Stripe from "stripe";
import { createRxCheckoutOrder, rxCheckoutIntentSchema } from "./rx-checkout-order";
import { createRxStripeCheckout } from "../payments/rx-stripe-checkout";
import { processRxStripeWebhook, isRxStripeEvent } from "../payments/rx-stripe-webhook";
import { createMarginCommissionLedger } from "../commissions/margin-split";
import { RX_PAYMENT_SOURCE } from "../payments/rx-stripe-policy";
import { rxCheckoutCanCharge } from "../payments/rx-checkout-release";
import { reconcileRxAgencyFee, type RxAgencyGateway } from "../payments/rx-agency-fee";
import { dispatchRxPaymentCaptured } from "../payments/rx-payment-effects";
import { acceptRxStripeRefund } from "../payments/rx-stripe-refund";
import { SMS_DISCLOSURE_VERSION } from "../legal/sms-consent";

const url = process.env.RX_TEST_DATABASE_URL;
const shipping = { line1: "100 Test Street", line2: "", city: "Miami", state: "FL", postalCode: "33101", country: "US" };
const config = { mode: "live" as const, secretKey: "sk_live_simulation", webhookSecret: "whsec_simulation", configured: true, webhookConfigured: true };

test("checkout release interlock blocks charges even if an environment flag is accidentally enabled", () => {
  assert.equal(rxCheckoutCanCharge({ RX_PAID_CHECKOUT_ENABLED: "true", RX_STOREFRONT_ENABLED: "true", CUSTOMER_PORTAL_ENABLED: "true" }), false);
  assert.equal(rxCheckoutIntentSchema.safeParse({ companyId: crypto.randomUUID() }).success, false);
});

test("authenticated cart → pending order → fake Stripe → original affiliate commission; transactional retries and rollback", { skip: !url }, async () => {
  const parsed = new URL(url!); assert.equal(parsed.hostname, "127.0.0.1"); assert.equal(parsed.port, "55439"); assert.equal(parsed.pathname, "/gvh_affiliate_test");
  const db = new PrismaClient({ datasources: { db: { url } } });
  try {
    const suffix = crypto.randomUUID();
    const company = await db.company.create({ data: { name: "RX checkout local", slug: `checkout-${suffix}` } });
    const account = await db.user.create({ data: { companyId: company.id, authUserId: suffix, email: `${suffix}@example.test`, role: "CUSTOMER", status: "ACTIVE", isActive: true } });
    const customer = await db.customer.create({ data: { companyId: company.id, userId: account.id, email: account.email,
      firstName: "Local", lastName: "Fixture", phone: "+13055550100", dateOfBirth: new Date("1990-01-01"), birthSex: "PREFER_NOT_TO_SAY", tags: [] } });
    const identity = { companyId: company.id, customerId: customer.id, userId: account.id };
    const category = await db.productCategory.create({ data: { companyId: company.id, name: "Weight Loss", slug: "weight-loss" } });
    const product = await db.product.create({ data: { companyId: company.id, categoryId: category.id, title: "Local product", slug: "local", sku: "local", description: "Fixture", priceCents: 22900, internalCostCents: 11800 } });
    await db.paymentProvider.create({ data: { companyId: company.id, code: "stripe", label: "Fake gateway", active: true, isDefault: true, mode: "live" } });
    const agency = await db.agencyFeeSetting.create({ data: { companyId: company.id, feeBps: 1000, isEnabled: true, stripeConnectedAccountId: "acct_fixture_only" } });
    const affiliate = await db.affiliateProfile.create({ data: { companyId: company.id, email: "original@example.test", displayName: "Original affiliate", referralCode: `AF-${suffix}`, status: "APPROVED", commissionBps: 2500 } });
    const payload = () => ({ requestId: crypto.randomUUID(), expectedTotalCents: 22900, shipping, cart: { items: [{ productId: product.id, quantity: 1 }], couponCode: "" } });
    await assert.rejects(createRxCheckoutOrder(db, { ...identity, userId: crypto.randomUUID() }, payload(), affiliate.referralCode), /VERIFIED_CUSTOMER/);
    await assert.rejects(createRxCheckoutOrder(db, identity, { ...payload(), expectedTotalCents: 1 }, affiliate.referralCode), /PRICE_CHANGED/);
    await assert.rejects(createRxCheckoutOrder(db, identity, { ...payload(), sellerId: affiliate.id }, affiliate.referralCode));
    await assert.rejects(createRxCheckoutOrder(db, identity, payload(), "UNKNOWN-REFERRAL"), /SELLER_REVIEW/);
    await db.affiliateProfile.update({ where: { id: affiliate.id }, data: { status: "SUSPENDED" } });
    await assert.rejects(createRxCheckoutOrder(db, identity, payload(), affiliate.referralCode), /SELLER_REVIEW/);
    await db.affiliateProfile.update({ where: { id: affiliate.id }, data: { status: "APPROVED" } });
    assert.equal(await db.order.count({ where: { companyId: company.id } }), 0);
    assert.equal(await db.auditLog.count({ where: { companyId: company.id, action: "SMS_CONSENT_REQUESTED" } }), 0);
    const input = { ...payload(), smsOptIn: "yes" as const, smsDisclosureVersion: SMS_DISCLOSURE_VERSION };
    const [a, b] = await Promise.all([createRxCheckoutOrder(db, identity, input, affiliate.referralCode), createRxCheckoutOrder(db, identity, input, affiliate.referralCode)]);
    assert.deepEqual(a, b);
    const consents = await db.auditLog.findMany({ where: { companyId: company.id, action: "SMS_CONSENT_REQUESTED" } });
    assert.equal(consents.length, 1);
    assert.equal(consents[0].resourceId, customer.id);
    assert.equal(consents[0].userId, account.id);
    assert.equal((consents[0].metadata as Record<string, unknown>).phone, customer.phone);
    assert.equal((consents[0].metadata as Record<string, unknown>).deliveryAuthorized, false);
    const pricedOrder = await db.order.findUniqueOrThrow({ where: { id: a.orderId } });
    assert.equal(pricedOrder.shippingCents, 0); assert.equal(pricedOrder.taxCents, 0); assert.equal(pricedOrder.totalCents, 22900);
    assert.equal((pricedOrder.referralMetadata as Record<string, unknown>).taxPolicy, "INCLUDED_IN_PRODUCT_PRICE");
    assert.deepEqual(await createRxCheckoutOrder(db, identity, { ...input, requestId: crypto.randomUUID() }, null), a);
    await assert.rejects(createRxCheckoutOrder(db, identity, { ...payload(), shipping: { ...shipping, city: "Other" } }, affiliate.referralCode), /PENDING_CHECKOUT/);
    assert.equal(await db.order.count({ where: { companyId: company.id } }), 1);
    const requests: string[] = [];
    const agencyOrders = new Set<string>();
    const clinicalOrders = new Set<string>();
    let simulateTransferFailure = true;
    const effects = {
      transferAgencyFee: async (input: { orderId: string; paymentIntentId: string; livemode: boolean; metadataMode: string }) => {
        assert.equal(input.livemode, true); assert.equal(input.metadataMode, "live");
        if (simulateTransferFailure) { simulateTransferFailure = false; throw new Error("SIMULATED_TRANSFER_RETRY"); }
        agencyOrders.add(input.orderId);
      },
      reverseAgencyFee: async () => { throw new Error("UNEXPECTED_REFUND"); },
      paymentCaptured: async (input: { orderId: string; captureId: string }) => { assert.ok(input.captureId); clinicalOrders.add(input.orderId); }
    };
    const deps = { enabled: true, catalogPreview: false, configuration: () => config, gateway: () => ({ create: async (params: Stripe.Checkout.SessionCreateParams, key: string) => {
      requests.push(key); assert.equal(params.payment_intent_data?.transfer_data, undefined); assert.equal(params.payment_intent_data?.application_fee_amount, undefined);
      assert.deepEqual(params.automatic_tax, { enabled: false });
      assert.equal(params.line_items?.[0].price_data?.tax_behavior, "inclusive");
      assert.equal(params.line_items?.[0].price_data?.unit_amount, 22900);
      return { id: `cs_${params.metadata!.orderId}`, url: `https://checkout.stripe.com/c/pay/${params.metadata!.orderId}`, livemode: true, status: "open" as const };
    } }) };
    const pay = async (order: typeof a) => {
      await createRxStripeCheckout(db, order, deps);
      const body = JSON.stringify({ id: `evt_${order.orderId}`, type: "payment_intent.succeeded", livemode: true, data: { object: {
        object: "payment_intent", id: `pi_${order.orderId}`, livemode: true, status: "succeeded", amount: 22900, amount_received: 22900, currency: "usd",
        metadata: { ...order, source: RX_PAYMENT_SOURCE, stripeMode: "live" }
      } } });
      const signature = new Stripe(config.secretKey).webhooks.generateTestHeaderString({ payload: body, secret: config.webhookSecret });
      const verifiedEvent = new Stripe(config.secretKey).webhooks.constructEvent(body, signature, config.webhookSecret);
      assert.equal(await isRxStripeEvent(db, verifiedEvent), true);
      if (order.orderId === a.orderId) {
        await assert.rejects(processRxStripeWebhook(db, body, signature, config, verifiedEvent.type, effects), /SIMULATED_TRANSFER_RETRY/);
        assert.equal(await db.paymentTransaction.count({ where: { orderId: order.orderId, status: "CAPTURED" } }), 1);
        assert.equal(clinicalOrders.size, 1);
      }
      const status = await processRxStripeWebhook(db, body, signature, config, verifiedEvent.type, effects);
      return { status };
    };
    assert.equal((await pay(a)).status, "CAPTURED");
    const other = await db.affiliateProfile.create({ data: { companyId: company.id, email: "other@example.test", displayName: "Other", referralCode: `AF-OTHER-${suffix}`, status: "APPROVED", commissionBps: 9000 } });
    const repeat = await createRxCheckoutOrder(db, identity, payload(), other.referralCode);
    await pay(repeat);
    const snapshot = await db.rxOrderCommission.findUniqueOrThrow({ where: { orderId: repeat.orderId } });
    assert.equal(snapshot.profileId, affiliate.id); assert.equal(snapshot.amountCents, 2775);
    assert.equal(snapshot.status, "PENDING"); assert.equal(requests.length, 2);
    // A suspended original seller never silently yields ownership to another affiliate.
    await db.affiliateProfile.update({ where: { id: affiliate.id }, data: { status: "SUSPENDED" } });
    await assert.rejects(createRxCheckoutOrder(db, identity, payload(), other.referralCode), /SELLER_REVIEW/);
    assert.equal(await db.order.count({ where: { companyId: company.id } }), 2);

    // Historical internal-agent customer: compute through the existing ledger, not affiliate math.
    const makeUser = (role: "PARTNER" | "CONSULTANT" | "CUSTOMER") => db.user.create({ data: { companyId: company.id, authUserId: crypto.randomUUID(), email: `${crypto.randomUUID()}@example.test`, role, status: "ACTIVE", isActive: true } });
    const partnerUser = await makeUser("PARTNER");
    const partner = await db.partnerProfile.create({ data: { companyId: company.id, userId: partnerUser.id, displayName: "Partner", commissionBps: 3000 } });
    const agentUser = await makeUser("CONSULTANT");
    const agent = await db.consultantProfile.create({ data: { companyId: company.id, userId: agentUser.id, partnerProfileId: partner.id,
      referralSlug: suffix, referralCode: `AG-${suffix}`, commissionBps: 4000 } });
    const agentCustomerUser = await makeUser("CUSTOMER");
    const agentCustomer = await db.customer.create({ data: { companyId: company.id, userId: agentCustomerUser.id, email: agentCustomerUser.email,
      firstName: "Agent", lastName: "Customer", phone: "+13055550101", dateOfBirth: new Date("1990-01-01"), birthSex: "PREFER_NOT_TO_SAY", tags: [] } });
    const original = await db.order.create({ data: { companyId: company.id, customerId: agentCustomer.id, consultantProfileId: agent.id, partnerProfileId: partner.id,
      subtotalCents: 22900, totalCents: 22900, paymentProviderCode: "stripe", paymentStatus: "CAPTURED",
      items: { create: { productId: product.id, quantity: 1, unitPriceCents: 22900, totalCents: 22900 } } } });
    await createMarginCommissionLedger({ prisma: db, orderId: original.id });
    await db.paymentTransaction.create({ data: { companyId: company.id, orderId: original.id, providerCode: "stripe", providerTransactionId: "pi_historical", amountCents: 22900, status: "CAPTURED" } });
    const agentOrder = await createRxCheckoutOrder(db, { companyId: company.id, customerId: agentCustomer.id, userId: agentCustomerUser.id }, payload(), other.referralCode);
    await pay(agentOrder);
    const agentSnapshot = await db.rxOrderCommission.findUniqueOrThrow({ where: { orderId: agentOrder.orderId } });
    const originalSplit = await db.commissionSplit.findUniqueOrThrow({ where: { orderId_participantRole: { orderId: original.id, participantRole: "CONSULTANT" } } });
    assert.equal(agentSnapshot.profileId, agent.id); assert.equal(agentSnapshot.amountCents, originalSplit.amountCents); assert.equal(agentSnapshot.status, "EXISTING_LEDGER");
    assert.equal(await db.commissionSplit.count({ where: { orderId: agentOrder.orderId } }), 2);
    assert.equal(agencyOrders.size, 3); assert.equal(clinicalOrders.size, 3);
    // No referral on a later visit also retains the original agent.
    const agentWithoutReferral = await createRxCheckoutOrder(db, { companyId: company.id, customerId: agentCustomer.id, userId: agentCustomerUser.id }, payload(), null);
    await pay(agentWithoutReferral);
    assert.equal((await db.rxOrderCommission.findUniqueOrThrow({ where: { orderId: agentWithoutReferral.orderId } })).profileId, agent.id);
    // A CRM assignment without confirmed acquisition history needs review, not DIRECT
    // attribution or replacement with a newly clicked affiliate.
    const assignedUser = await makeUser("CUSTOMER");
    const assignedCustomer = await db.customer.create({ data: { companyId: company.id, userId: assignedUser.id, email: assignedUser.email,
      consultantProfileId: agent.id, firstName: "Assigned", lastName: "Fixture", phone: "+13055550101",
      dateOfBirth: new Date("1990-01-01"), birthSex: "PREFER_NOT_TO_SAY", tags: [] } });
    const assignedIdentity = { companyId: company.id, customerId: assignedCustomer.id, userId: assignedUser.id };
    await assert.rejects(createRxCheckoutOrder(db, assignedIdentity, payload(), null), /HISTORICAL_OWNER_REVIEW_REQUIRED/);
    await assert.rejects(createRxCheckoutOrder(db, assignedIdentity, payload(), other.referralCode), /HISTORICAL_OWNER_REVIEW_REQUIRED/);
    const noSource = { id: "evt_no_source", type: "payment_intent.succeeded", data: { object: { object: "payment_intent", id: `pi_${a.orderId}`, metadata: {} } } } as unknown as Stripe.Event;
    assert.equal(await isRxStripeEvent(db, noSource), true);
    assert.equal(await isRxStripeEvent(db, { ...noSource, data: { object: { ...noSource.data.object, id: "pi_legacy", metadata: { orderId: original.id } } } } as unknown as Stripe.Event), false);
    assert.deepEqual(await db.agencyFeeSetting.findUniqueOrThrow({ where: { id: agency.id } }), agency);
    assert.equal(await db.agencyFeeTransaction.count({ where: { companyId: company.id } }), 0);
    assert.equal(await db.payoutTransfer.count({ where: { companyId: company.id } }), 0);

    // Exercise the actual durable dispatcher against a fake gateway, including a lost
    // response AFTER a successful transfer. No Stripe API/network or production writes.
    const transfers = new Map<string, { params: Stripe.TransferCreateParams; result: Awaited<ReturnType<RxAgencyGateway["transfer"]>> }>();
    const reversals = new Map<string, { amount: number; result: Awaited<ReturnType<RxAgencyGateway["reverse"]>> }>();
    let loseTransferResponse = true;
    let loseReversalResponse = true;
    let transferCalls = 0;
    const gateway: RxAgencyGateway = {
      charge: async intent => `ch_${intent.slice(3)}`,
      transfer: async (params, key) => {
        transferCalls++;
        const prior = transfers.get(key);
        if (prior) { assert.deepEqual(params, prior.params); return prior.result; }
        const result = { id: `tr_${key}`, amount: params.amount!, destination: params.destination as string, sourceCharge: params.source_transaction!, livemode: true };
        transfers.set(key, { params, result });
        if (loseTransferResponse) { loseTransferResponse = false; throw new Error("SIMULATED_LOST_TRANSFER_RESPONSE"); }
        return result;
      },
      reverse: async (transferId, amount, key) => {
        const prior = reversals.get(key);
        if (prior) { assert.equal(amount, prior.amount); return prior.result; }
        const result = { id: `trr_${key}`, amount, transferId };
        reversals.set(key, { amount, result });
        if (loseReversalResponse) { loseReversalResponse = false; throw new Error("SIMULATED_LOST_REVERSAL_RESPONSE"); }
        return result;
      }
    };
    await assert.rejects(reconcileRxAgencyFee(db, a.orderId, config, gateway), /LOST_TRANSFER_RESPONSE/);
    assert.equal(await db.agencyFeeTransaction.count({ where: { orderId: a.orderId, status: "PENDING" } }), 1);
    // A later Admin change must not modify the in-flight original transfer request.
    await db.agencyFeeSetting.update({ where: { id: agency.id }, data: { feeBps: 9000, stripeConnectedAccountId: "acct_changed" } });
    await Promise.all([reconcileRxAgencyFee(db, a.orderId, config, gateway), reconcileRxAgencyFee(db, a.orderId, config, gateway)]);
    assert.equal(transfers.size, 1);
    assert.equal(transfers.values().next().value!.params.amount, 1110);
    assert.equal(transfers.values().next().value!.params.destination, "acct_fixture_only");
    assert.equal(await db.agencyFeeTransaction.count({ where: { orderId: a.orderId, type: "TRANSFER", status: "TRANSFERRED" } }), 1);

    const admin = await db.user.create({ data: { companyId: company.id, authUserId: crypto.randomUUID(), email: `${crypto.randomUUID()}@example.test`, role: "COMPANY_ADMIN", status: "ACTIVE", isActive: true } });
    await db.webhookEndpoint.create({ data: { companyId: company.id, name: "Local clinical fixture", url: "https://clinical.example.test/events", secret: "local-only",
      events: ["payment.succeeded", "receipt.ready"] } });
    const deliveryBodies = new Map<string, string>();
    let loseClinicalResponse = true;
    const transport: typeof fetch = async (_url, init) => {
      const body = String(init!.body); const parsed = JSON.parse(body);
      if (deliveryBodies.has(parsed.id)) assert.equal(deliveryBodies.get(parsed.id), body);
      deliveryBodies.set(parsed.id, body);
      if (loseClinicalResponse) { loseClinicalResponse = false; throw new Error("SIMULATED_LOST_DELIVERY_RESPONSE"); }
      return new Response(null, { status: 204 });
    };
    const capture = await db.paymentTransaction.findFirstOrThrow({ where: { orderId: a.orderId, status: "CAPTURED" } });
    const captured = { orderId: a.orderId, captureId: capture.id };
    await assert.rejects(dispatchRxPaymentCaptured(db, captured, transport), /DELIVERY_RETRY/);
    await Promise.all([dispatchRxPaymentCaptured(db, captured, transport), dispatchRxPaymentCaptured(db, captured, transport)]);
    assert.equal(deliveryBodies.size, 2);
    assert.equal(await db.webhookDelivery.count({ where: { companyId: company.id, status: "DELIVERED" } }), 2);
    assert.equal(await db.notification.count({ where: { userId: admin.id } }), 1);
    const refunds = async (cumulative: number, order = a) => {
      const body = JSON.stringify({ id: `evt_refund_${order.orderId}_${cumulative}`, type: "charge.refunded", livemode: true, data: { object: {
        object: "charge", id: `ch_${order.orderId}`, payment_intent: `pi_${order.orderId}`, livemode: true, paid: true, captured: true,
        currency: "usd", amount: 22900, amount_refunded: cumulative,
        metadata: { ...order, source: RX_PAYMENT_SOURCE, stripeMode: "live" }
      } } });
      const signature = new Stripe(config.secretKey).webhooks.generateTestHeaderString({ payload: body, secret: config.webhookSecret });
      return acceptRxStripeRefund(db, body, signature, config);
    };
    await refunds(11450);
    await assert.rejects(reconcileRxAgencyFee(db, a.orderId, config, gateway), /LOST_REVERSAL_RESPONSE/);
    await refunds(22900);
    await Promise.all([reconcileRxAgencyFee(db, a.orderId, config, gateway), reconcileRxAgencyFee(db, a.orderId, config, gateway)]);
    const reversed = await db.agencyFeeTransaction.aggregate({ where: { orderId: a.orderId, type: "REVERSAL", status: "REVERSED" }, _sum: { amountCents: true } });
    assert.equal(reversed._sum.amountCents, 1110); assert.equal(reversals.size, 2);
    assert.equal((await db.order.findUniqueOrThrow({ where: { id: a.orderId } })).agencyFeeStatus, "REVERSED");
    // An old ambiguous transfer must stop rather than create a second transfer after
    // Stripe's idempotency window. The pending ledger is kept for manual reconciliation.
    loseTransferResponse = true;
    await assert.rejects(reconcileRxAgencyFee(db, repeat.orderId, config, gateway), /LOST_TRANSFER_RESPONSE/);
    const pendingFee = await db.agencyFeeTransaction.findFirstOrThrow({ where: { orderId: repeat.orderId, type: "TRANSFER" } });
    await db.agencyFeeTransaction.update({ where: { id: pendingFee.id }, data: { rawEvent: { ...(pendingFee.rawEvent as object), startedAt: new Date(Date.now() - 86400000).toISOString() } } });
    const beforeCalls = transferCalls;
    await assert.rejects(reconcileRxAgencyFee(db, repeat.orderId, config, gateway), /RECONCILIATION_REQUIRED/);
    assert.equal(transferCalls, beforeCalls);
    // No new transfer after refund when no durable transfer intent existed.
    await refunds(22900, agentOrder);
    await assert.rejects(reconcileRxAgencyFee(db, agentOrder.orderId, config, gateway), /REFUND_BEFORE_TRANSFER_REVIEW/);
    assert.equal(transferCalls, beforeCalls);
    assert.equal(await db.payoutTransfer.count({ where: { companyId: company.id } }), 0);
  } finally { await db.$disconnect(); }
});
