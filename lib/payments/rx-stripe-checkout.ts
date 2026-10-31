import Stripe from "stripe";
import { isDeepStrictEqual } from "node:util";
import type { Prisma, PrismaClient } from "@prisma/client";
import { stripeRuntimeConfig, type StripeRuntimeConfig } from "./stripe-config";
import { assertRxStripeConfiguration, rxCheckoutParameters, rxPaymentContractSchema, type RxPaymentContract } from "./rx-stripe-policy";
import { rxCheckoutCanCharge } from "./rx-checkout-release";

type Gateway = { create(params: Stripe.Checkout.SessionCreateParams, key: string): Promise<Pick<Stripe.Checkout.Session, "id" | "url" | "livemode" | "status">> };
type Dependencies = {
  enabled: boolean; catalogPreview: boolean;
  configuration: (mode: "live" | "test") => StripeRuntimeConfig;
  gateway: (config: StripeRuntimeConfig) => Gateway;
};
function defaults(): Dependencies {
  return {
    enabled: rxCheckoutCanCharge(), catalogPreview: Boolean(process.env.LOCAL_CATALOG_SOURCE_URL),
    configuration: stripeRuntimeConfig,
    gateway: config => {
      const stripe = new Stripe(config.secretKey!);
      return { create: (params, key) => stripe.checkout.sessions.create(params, { idempotencyKey: key }) };
    }
  };
}

/** Server-only service, not a public action. Caller must obtain company/customer from
 * authenticated customer-session and prepare the original seller's ledger first.
 * Kept disconnected from public routes until the full webhook/reconciliation flow ships. */
export async function createRxStripeCheckout(db: PrismaClient, input: { companyId: string; customerId: string; orderId: string }, dependencies: Dependencies = defaults()) {
  if (!dependencies.enabled || dependencies.catalogPreview) throw new Error("RX_PAID_CHECKOUT_DISABLED");
  const prepared = await db.$transaction(async tx => {
    // Same lock order as commission settlement: customer first, then order.
    await tx.$queryRaw`SELECT id FROM "Customer" WHERE id=${input.customerId}::uuid AND "companyId"=${input.companyId}::uuid FOR UPDATE`;
    const order = await tx.order.findFirst({ where: { id: input.orderId, companyId: input.companyId, customerId: input.customerId }, include: { customer: true, items: { orderBy: { id: "asc" }, include: { product: { select: { title: true } } } } } });
    if (!order || order.paymentStatus !== "PENDING" || order.paymentProviderCode !== "stripe" || order.referralSource !== "rx_checkout_v1") throw new Error("RX_PENDING_ORDER_REQUIRED");
    const snapshot = await tx.rxOrderCommission.findUnique({ where: { orderId: order.id } });
    if (!snapshot || snapshot.companyId !== input.companyId || snapshot.customerId !== input.customerId || snapshot.status !== "AWAITING_PAYMENT") throw new Error("RX_COMMISSION_SNAPSHOT_REQUIRED");
    if (snapshot.sellerRole === "AFFILIATE" && snapshot.basisCents !== Math.max(0, order.grossMarginCents)) throw new Error("RX_PAYMENT_CONTRACT_CHANGED");
    // Reuse the established order flow for discount/shipping/tax policy before supporting these cases.
    if (order.discountCents || order.shippingCents || order.taxCents) throw new Error("RX_ADJUSTED_TOTAL_REVIEW_REQUIRED");
    const provider = await tx.paymentProvider.findUnique({ where: { companyId_code: { companyId: input.companyId, code: "stripe" } } });
    if (!provider?.active || !provider.isDefault || !["live", "test"].includes(provider.mode)) throw new Error("RX_STRIPE_PROVIDER_REQUIRED");
    const metadata = order.referralMetadata && typeof order.referralMetadata === "object" && !Array.isArray(order.referralMetadata) ? order.referralMetadata : {};
    const existing = metadata.rxCheckout ? rxPaymentContractSchema.parse(metadata.rxCheckout) : null;
    const contract: RxPaymentContract = existing ?? { version: 1, ...input, mode: provider.mode as "live" | "test", currency: "usd", totalCents: order.totalCents, grossMarginCents: order.grossMarginCents, createdAt: new Date().toISOString(), sessionId: null };
    if (contract.companyId !== input.companyId || contract.customerId !== input.customerId || contract.orderId !== input.orderId || contract.mode !== provider.mode || contract.totalCents !== order.totalCents || contract.grossMarginCents !== order.grossMarginCents) throw new Error("RX_PAYMENT_CONTRACT_CHANGED");
    // Stripe may discard idempotency keys after 24h. Never silently create a second session later.
    if (Date.now() - Date.parse(contract.createdAt) >= 23 * 60 * 60 * 1000) throw new Error("RX_CHECKOUT_RECONCILIATION_REQUIRED");
    const config = dependencies.configuration(contract.mode);
    if (config.mode !== contract.mode) throw new Error("RX_STRIPE_CONFIGURATION_REQUIRED");
    assertRxStripeConfiguration(config);
    const params = rxCheckoutParameters(contract, order.items.map(item => ({ name: item.product.title, unitAmount: item.unitPriceCents, quantity: item.quantity })), order.customer.email);
    if (existing && !isDeepStrictEqual(metadata.rxCheckoutRequest, params)) throw new Error("RX_PAYMENT_CONTRACT_CHANGED");
    if (!existing) await tx.order.update({ where: { id: order.id }, data: { referralMetadata: JSON.parse(JSON.stringify({ ...metadata, rxCheckout: contract, rxCheckoutRequest: params })) as Prisma.InputJsonValue } });
    return { contract, config, params };
  });
  const session = await dependencies.gateway(prepared.config).create(prepared.params, `rx_checkout_v1_${input.orderId}`);
  const sessionUrl = session.url ? new URL(session.url) : null;
  if (session.livemode !== (prepared.contract.mode === "live") || session.status !== "open" || !session.id.startsWith("cs_") || sessionUrl?.protocol !== "https:" || sessionUrl.hostname !== "checkout.stripe.com") throw new Error("RX_CHECKOUT_SESSION_REVIEW_REQUIRED");
  await db.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "Customer" WHERE id=${input.customerId}::uuid AND "companyId"=${input.companyId}::uuid FOR UPDATE`;
    const order = await tx.order.findUniqueOrThrow({ where: { id: input.orderId } });
    const metadata = order.referralMetadata as Prisma.JsonObject;
    const contract = rxPaymentContractSchema.parse(metadata.rxCheckout);
    if (contract.sessionId && contract.sessionId !== session.id) throw new Error("RX_SESSION_MISMATCH");
    await tx.order.update({ where: { id: order.id }, data: { referralMetadata: { ...metadata, rxCheckout: { ...contract, sessionId: session.id } } as Prisma.InputJsonValue } });
  });
  return { sessionId: session.id, url: session.url!, mode: prepared.contract.mode };
}
