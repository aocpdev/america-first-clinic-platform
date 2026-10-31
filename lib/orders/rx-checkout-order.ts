import { Prisma, type PrismaClient } from "@prisma/client";
import { createHash } from "node:crypto";
import { z } from "zod";
import { isUsStateCode } from "../locations/us-states";
import { loadRxQuote } from "./rx-quote-service";
import { rxQuoteIntentSchema } from "./rx-quote";
import { originalOwner, prepareRxCommission } from "../referrals/rx-settlement";
import { resolveRxReferral } from "../referrals/rx-referral-service";
import { sellerFromOrder } from "../referrals/attribution-policy";
import type { RxOwner } from "../referrals/rx-owner-policy";
import { createMarginCommissionLedger } from "../commissions/margin-split";
import { isRxClinicalService } from "../products/rx-telehealth";
import { RX_PAYMENT_SOURCE } from "../payments/rx-stripe-policy";
import { rxAgencyFeeContract } from "../payments/rx-agency-fee";
import { smsChoiceShape } from "../legal/sms-consent";
import { recordSmsConsentRequest, smsConsentPhone } from "../legal/sms-consent-record";

export const rxShippingSchema = z.object({
  line1: z.string().trim().min(1).max(200), line2: z.string().trim().max(200).default(""),
  city: z.string().trim().min(1).max(100), state: z.string().trim().toUpperCase().refine(isUsStateCode),
  postalCode: z.string().trim().regex(/^\d{5}(?:-\d{4})?$/), country: z.literal("US")
}).strict();
export const rxCheckoutIntentSchema = z.object({
  ...smsChoiceShape,
  requestId: z.string().uuid(), cart: rxQuoteIntentSchema,
  shipping: rxShippingSchema, expectedTotalCents: z.number().int().positive().safe()
}).strict();

async function sellerAssignment(tx: Prisma.TransactionClient, seller: RxOwner) {
  const fields = { consultantProfileId: null as string | null, partnerProfileId: null as string | null,
    managerProfileId: null as string | null, groupLeaderProfileId: null as string | null };
  if (seller.role === "AFFILIATE" || seller.role === "DIRECT") return { fields, mode: null };
  const where = { id: seller.profileId, companyId: seller.companyId };
  if (seller.role === "CONSULTANT") {
    const agent = await tx.consultantProfile.findFirstOrThrow({ where });
    fields.consultantProfileId = agent.id; fields.partnerProfileId = agent.partnerProfileId;
    fields.groupLeaderProfileId = agent.groupLeaderProfileId; fields.managerProfileId = agent.managerProfileId;
  } else if (seller.role === "GROUP_LEADER") fields.groupLeaderProfileId = seller.profileId;
  else if (seller.role === "MANAGER") fields.managerProfileId = seller.profileId;
  else fields.partnerProfileId = seller.profileId;
  if (fields.groupLeaderProfileId) {
    const leader = await tx.groupLeaderProfile.findFirstOrThrow({ where: { id: fields.groupLeaderProfileId, companyId: seller.companyId } });
    fields.managerProfileId ??= leader.managerProfileId; fields.partnerProfileId ??= leader.partnerProfileId;
    if (leader.partnerProfileId !== fields.partnerProfileId) throw new Error("RX_HIERARCHY_REVIEW_REQUIRED");
  }
  if (fields.managerProfileId) {
    const manager = await tx.managerProfile.findFirstOrThrow({ where: { id: fields.managerProfileId, companyId: seller.companyId } });
    fields.partnerProfileId ??= manager.partnerProfileId;
    if (manager.partnerProfileId !== fields.partnerProfileId) throw new Error("RX_HIERARCHY_REVIEW_REQUIRED");
  }
  if (!fields.partnerProfileId) throw new Error("RX_HIERARCHY_REVIEW_REQUIRED");
  await tx.partnerProfile.findFirstOrThrow({ where: { id: fields.partnerProfileId, companyId: seller.companyId } });
  const modes = { CONSULTANT: "CONSULTANT_PARTNER_SPLIT", GROUP_LEADER: "GROUP_LEADER_DIRECT", MANAGER: "MANAGER_DIRECT", PARTNER: "PARTNER_DIRECT" } as const;
  return { fields, mode: modes[seller.role] };
}

/** Identity MUST come from verified customer-session, never form data. All records,
 * amounts and original-owner commissions commit together; no payment API call here. */
export async function createRxCheckoutOrder(db: PrismaClient, identity: { companyId: string; customerId: string; userId: string },
  payload: unknown, referralCode: unknown) {
  z.object({ companyId: z.string().uuid(), customerId: z.string().uuid(), userId: z.string().uuid() }).strict().parse(identity);
  const input = rxCheckoutIntentSchema.parse(payload);
  input.cart.items.sort((a, b) => a.productId.localeCompare(b.productId));
  const fingerprint = createHash("sha256").update(JSON.stringify({ cart: input.cart, shipping: input.shipping, expectedTotalCents: input.expectedTotalCents })).digest("hex");
  return db.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "Customer" WHERE id=${identity.customerId}::uuid AND "companyId"=${identity.companyId}::uuid FOR UPDATE`;
    const customer = await tx.customer.findFirst({ where: { id: identity.customerId, companyId: identity.companyId, userId: identity.userId,
      user: { id: identity.userId, companyId: identity.companyId, role: "CUSTOMER", isActive: true, status: "ACTIVE" } } });
    if (!customer) throw new Error("RX_VERIFIED_CUSTOMER_REQUIRED");
    smsConsentPhone(input, customer.phone);
    const recordConsent = (orderId: string) => recordSmsConsentRequest(tx, { companyId: identity.companyId,
      subjectId: customer.id, subjectType: "Customer", actorUserId: identity.userId,
      program: "CUSTOMER_ORDERS", source: "/rx/checkout", phone: customer.phone, choice: input, requestKey: orderId });
    if (!customer.firstName || !customer.lastName || !customer.phone || !customer.dateOfBirth || !customer.birthSex) throw new Error("RX_CUSTOMER_DETAILS_REQUIRED");
    const existing = await tx.order.findUnique({ where: { id: input.requestId } });
    if (existing) {
      if (existing.companyId !== identity.companyId || existing.customerId !== identity.customerId || existing.referralSource !== RX_PAYMENT_SOURCE ||
        existing.paymentStatus !== "PENDING" || (existing.referralMetadata as Prisma.JsonObject | null)?.checkoutFingerprint !== fingerprint ||
        !await tx.rxOrderCommission.findUnique({ where: { orderId: existing.id } })) throw new Error("RX_CHECKOUT_REQUEST_CONFLICT");
      await recordConsent(existing.id);
      return { companyId: identity.companyId, customerId: identity.customerId, orderId: existing.id };
    }
    // A reload/new tab must not create another payable order while the first is unresolved.
    const pending = await tx.order.findFirst({ where: { companyId: identity.companyId, customerId: identity.customerId,
      referralSource: RX_PAYMENT_SOURCE, paymentStatus: "PENDING" } });
    if (pending) {
      if ((pending.referralMetadata as Prisma.JsonObject | null)?.checkoutFingerprint !== fingerprint ||
        !await tx.rxOrderCommission.findUnique({ where: { orderId: pending.id } })) throw new Error("RX_PENDING_CHECKOUT_REVIEW_REQUIRED");
      await recordConsent(pending.id);
      return { companyId: identity.companyId, customerId: identity.customerId, orderId: pending.id };
    }
    // A referral can only propose a first seller; purchase history always wins.
    const owner = await originalOwner(tx, identity.companyId, identity.customerId);
    const referral = owner ? null : await resolveRxReferral(tx, identity.companyId, referralCode);
    // Unknown/disabled referrals and unresolved existing assignments are not direct sales.
    if (!owner && sellerFromOrder(customer)) throw new Error("HISTORICAL_OWNER_REVIEW_REQUIRED");
    const seller: RxOwner | null = owner ?? (referral?.status === "RESOLVED" ? referral.seller :
      referral?.status === "NONE" ? { companyId: identity.companyId, role: "DIRECT", profileId: identity.companyId } : null);
    if (!seller) throw new Error("ORIGINAL_SELLER_REVIEW_REQUIRED");
    const assignment = await sellerAssignment(tx, seller);
    const productIds = input.cart.items.map(item => z.string().uuid().parse(item.productId));
    await tx.$queryRaw(Prisma.sql`SELECT id FROM "Product" WHERE "companyId"=${identity.companyId}::uuid
      AND id IN (${Prisma.join(productIds.map(id => Prisma.sql`${id}::uuid`))}) ORDER BY id FOR SHARE`);
    const quote = await loadRxQuote(tx, identity.companyId, input.cart);
    if (quote.financialContext.lines.some(line => isRxClinicalService(line.categoryName ?? ""))) throw new Error("RX_CLINICAL_SERVICE_SEPARATE");
    if (input.cart.couponCode || quote.publicQuote.discountCents) throw new Error("RX_ADJUSTED_TOTAL_REVIEW_REQUIRED");
    if (quote.publicQuote.totalCents !== input.expectedTotalCents) throw new Error("RX_PRICE_CHANGED");
    const costs = quote.financialContext.lines.reduce((sum, item) => sum + item.internalCostCents * item.quantity, 0);
    const provider = await tx.paymentProvider.findUnique({ where: { companyId_code: { companyId: identity.companyId, code: "stripe" } } });
    if (!provider?.active || !provider.isDefault || !["test", "live"].includes(provider.mode)) throw new Error("RX_STRIPE_PROVIDER_REQUIRED");
    const grossMarginCents = Math.max(0, quote.publicQuote.totalCents - costs);
    const agencyFee = await rxAgencyFeeContract(tx, identity.companyId, grossMarginCents);
    await tx.order.create({ data: { id: input.requestId, companyId: identity.companyId, customerId: customer.id, ...assignment.fields,
      subtotalCents: quote.publicQuote.subtotalCents, totalCents: quote.publicQuote.totalCents, shippingCents: 0, taxCents: 0, grossMarginCents,
      paymentProviderCode: "stripe", referralSource: RX_PAYMENT_SOURCE, orderPipelineStage: "AWAITING_PAYMENT", commissionStatus: "PENDING",
      referralMetadata: { checkoutFingerprint: fingerprint, shippingAddress: input.shipping, commissionMode: assignment.mode ?? seller.role,
        source: RX_PAYMENT_SOURCE, paymentWorkflow: "collect_payment", shippingPolicy: "INCLUDED_IN_PRODUCT_PRICE",
        taxPolicy: "INCLUDED_IN_PRODUCT_PRICE", taxAccounting: "NOT_ITEMIZED", rxAgencyFee: agencyFee },
      items: { create: quote.publicQuote.items.map(({ productId, quantity, unitPriceCents, totalCents }) => ({ productId, quantity, unitPriceCents, totalCents })) }
    } });
    if (assignment.mode) await createMarginCommissionLedger({ prisma: tx, orderId: input.requestId, commissionMode: assignment.mode });
    await prepareRxCommission(tx, { companyId: identity.companyId, customerId: customer.id, orderId: input.requestId, referral: seller });
    await recordConsent(input.requestId);
    return { companyId: identity.companyId, customerId: customer.id, orderId: input.requestId };
  }, { timeout: 15000 });
}
