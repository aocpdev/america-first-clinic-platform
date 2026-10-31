import test from "node:test";
import assert from "node:assert/strict";
import { decodeRxCart, emptyRxCart, encodeRxCart, rxCartSchema, updateRxCart } from "./rx-cart";

const company = "00000000-0000-4000-8000-000000000001";
const otherCompany = "00000000-0000-4000-8000-000000000002";
const id = (n: number) => `10000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const encodeRaw = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");

test("cart round trips and fails closed for corrupt, oversized and cross-tenant cookies", () => {
  const cart = updateRxCart(emptyRxCart(company), id(1), 2, "add");
  assert.deepEqual(decodeRxCart(encodeRxCart(cart), company), cart);
  for (const value of [undefined, "bad!", "e30", "a".repeat(3801), encodeRxCart(cart).slice(0, -3)]) {
    assert.deepEqual(decodeRxCart(value, company), emptyRxCart(company));
  }
  assert.deepEqual(decodeRxCart(encodeRxCart(cart), otherCompany), emptyRxCart(otherCompany));
});

test("cart rejects injected prices, commissions, seller ownership and duplicate products", () => {
  const cart = updateRxCart(emptyRxCart(company), id(1), 1, "add");
  for (const key of ["priceCents", "commissionCents", "sellerId"]) {
    assert.deepEqual(decodeRxCart(encodeRaw({ ...cart, [key]: 1 }), company), emptyRxCart(company));
    assert.deepEqual(decodeRxCart(encodeRaw({ ...cart, items: [{ ...cart.items[0], [key]: 1 }] }), company), emptyRxCart(company));
  }
  assert.equal(rxCartSchema.safeParse({ ...cart, items: [cart.items[0], cart.items[0]] }).success, false);
});

test("add merges quantities without mutating input and set preserves display order", () => {
  const original = updateRxCart(updateRxCart(emptyRxCart(company), id(1), 1, "add"), id(2), 1, "add");
  const merged = updateRxCart(original, id(1), 2, "add");
  assert.deepEqual(merged.items, [{ productId: id(1), quantity: 3 }, { productId: id(2), quantity: 1 }]);
  assert.equal(original.items[0].quantity, 1);
  assert.equal(updateRxCart(merged, id(1), 4, "set").items[0].quantity, 4);
  assert.throws(() => updateRxCart(original, id(3), 1, "set"));
});

test("quantity and item limits apply before a cookie can be written", () => {
  const cart = updateRxCart(emptyRxCart(company), id(1), 100, "add");
  for (const n of [0, -1, 1.5, NaN, Infinity, 101]) assert.throws(() => updateRxCart(cart, id(1), n, "add"));
  assert.throws(() => updateRxCart(cart, id(1), 1, "add"));
  let full = emptyRxCart(company);
  for (let i = 1; i <= 25; i++) full = updateRxCart(full, id(i), 100, "add");
  assert.ok(encodeRxCart({ ...full, couponCode: "x".repeat(64) }).length <= 3800);
  assert.throws(() => updateRxCart(full, id(26), 1, "add"));
});

test("removing the last item clears its coupon and leaves no purchase metadata", () => {
  const cart = { ...updateRxCart(emptyRxCart(company), id(1), 1, "add"), couponCode: "SAVE" };
  assert.deepEqual(updateRxCart(cart, id(1), 1, "remove"), emptyRxCart(company));
});
