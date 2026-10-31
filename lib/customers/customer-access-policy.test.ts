import { test } from "node:test";
import assert from "node:assert/strict";
import { canAccessCustomerPortal } from "./customer-access-policy";
const identity = { id: "auth", email: "buyer@example.test", email_confirmed_at: "2026-09-17" };
const account = { id: "user", authUserId: "auth", companyId: "company", email: identity.email, role: "CUSTOMER", status: "ACTIVE", isActive: true };
const customer = { userId: "user", companyId: "company", email: identity.email };
test("verified explicitly bound customer can access", () => assert.equal(canAccessCustomerPortal(identity, account, customer, "company"), true));
test("matching email never substitutes for binding", () => {
  assert.equal(canAccessCustomerPortal(identity, account, { ...customer, userId: null }, "company"), false);
  assert.equal(canAccessCustomerPortal(identity, { ...account, authUserId: "other" }, customer, "company"), false);
});
test("unverified, suspended, inactive, seller and other tenant denied", () => {
  assert.equal(canAccessCustomerPortal({ ...identity, email_confirmed_at: undefined }, account, customer, "company"), false);
  for (const patch of [{ status: "SUSPENDED" }, { isActive: false }, { role: "CONSULTANT" }, { companyId: "other" }]) assert.equal(canAccessCustomerPortal(identity, { ...account, ...patch }, customer, "company"), false);
  assert.equal(canAccessCustomerPortal(identity, account, { ...customer, companyId: "other" }, "company"), false);
});
test("mismatched emails and absent records denied", () => {
  assert.equal(canAccessCustomerPortal(identity, account, { ...customer, email: "other@example.test" }, "company"), false);
  assert.equal(canAccessCustomerPortal(identity, null, customer, "company"), false);
  assert.equal(canAccessCustomerPortal(null, account, customer, "company"), false);
});
