import assert from "node:assert/strict";
import test from "node:test";
import { calculateRxQuote, rxQuoteIntentSchema } from "./rx-quote";
import { calculateDiscountApplication, type DiscountLike } from "../discounts/calculations";

const product = { id: "p1", companyId: "c1", active: true, title: "Program",
  priceCents: 19900, internalCostCents: 9900, category: { name: "Wellness" } };
const intent = { items: [{ productId: "p1", quantity: 2 }] };
const discount: DiscountLike & { companyId: string } = {
  companyId: "c1", id: "d1", name: "Offer", code: "SAVE", discountType: "PERCENT",
  valueBps: 2500, amountCents: 0, minSubtotalCents: 0, ownerProtectedProfitCents: 18000,
  affectsCommissions: true, fundingStrategy: "SHARED_POOL", productIds: [], categoryNames: [],
  startsAt: null, endsAt: null, maxRedemptions: null, redemptionCount: 0, active: true
};
const quote = (overrides: Partial<Parameters<typeof calculateRxQuote>[0]> = {}) =>
  calculateRxQuote({ companyId: "c1", intent, products: [product], discount: null, ...overrides });

test("quote uses catalog cents and never exposes internal cost in public output", () => {
  const result = quote();
  assert.equal(result.publicQuote.totalCents, 39800);
  assert.equal(result.publicQuote.items[0].unitPriceCents, 19900);
  assert.equal(JSON.stringify(result.publicQuote).includes("internalCost"), false);
  assert.equal(JSON.stringify(result.publicQuote).includes("commission"), false);
  assert.equal(result.publicQuote.currency, "USD");
});
test("reject client price, seller, company, malformed quantities and empty carts", () => {
  for (const payload of [{ ...intent, priceCents: 1 }, { ...intent, companyId: "other" },
    { ...intent, affiliateId: "other" }, { items: [] },
    { items: [{ productId: "p1", quantity: 1.5 }] }, { items: [{ productId: "p1", quantity: 101 }] }]) {
    assert.equal(rxQuoteIntentSchema.safeParse(payload).success, false);
  }
});
test("merge duplicates without bypassing quantity limits", () => {
  assert.equal(quote({ intent: { items: [{ productId: "p1", quantity: 1 }, { productId: "p1", quantity: 2 }] } }).publicQuote.items[0].quantity, 3);
  assert.throws(() => quote({ intent: { items: [{ productId: "p1", quantity: 100 }, { productId: "p1", quantity: 1 }] } }), /INVALID_QUANTITY/);
});
test("reject unavailable, inactive, cross-company and invalid-price products", () => {
  assert.throws(() => quote({ products: [] }), /PRODUCT_UNAVAILABLE/);
  assert.throws(() => quote({ products: [{ ...product, active: false }] }), /PRODUCT_UNAVAILABLE/);
  assert.throws(() => quote({ products: [{ ...product, companyId: "other" }] }), /PRODUCT_UNAVAILABLE/);
  assert.throws(() => quote({ products: [{ ...product, priceCents: -1 }] }), /INVALID_PRODUCT_PRICE/);
});
test("discount math matches internal sales including protected profit and shared pool", () => {
  const result = quote({ intent: { ...intent, couponCode: " save " }, discount });
  const existing = calculateDiscountApplication(discount, result.financialContext.lines)!;
  assert.equal(result.publicQuote.discountCents, existing.discountCents);
  assert.equal(result.publicQuote.discountCents, 2000);
  assert.equal(result.publicQuote.totalCents, existing.totalCents);
  assert.equal(result.financialContext.appliedDiscount!.commissionableMarginCents, existing.commissionableMarginCents);
  assert.equal(result.publicQuote.couponCode, "SAVE");
});
test("invalid, inactive, exhausted, expired or wrong-tenant coupons fail closed", () => {
  for (const candidate of [null, { ...discount, companyId: "other" }, { ...discount, active: false },
    { ...discount, code: "OTHER" }, { ...discount, maxRedemptions: 1, redemptionCount: 1 },
    { ...discount, endsAt: new Date("2020-01-01") }]) {
    assert.throws(() => quote({ intent: { ...intent, couponCode: "SAVE" }, discount: candidate }), /INVALID_DISCOUNT/);
  }
  assert.throws(() => quote({ intent: { ...intent, couponCode: "SAVE" }, discount: { ...discount, productIds: ["other"] } }), /DISCOUNT_NOT_APPLICABLE/);
});
test("without an entered coupon a supplied discount never applies", () => {
  assert.equal(quote({ discount }).publicQuote.discountCents, 0);
});
