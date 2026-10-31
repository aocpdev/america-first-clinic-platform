import assert from "node:assert/strict";
import test from "node:test";
import { affiliateSchema, canManageAffiliates, percentageToBps } from "./affiliate-admin-policy";

test("rates preserve zero, null inheritance and exact percentage precision", () => {
  assert.equal(percentageToBps("25"), 2500);
  assert.equal(percentageToBps("25.75"), 2575);
  assert.equal(percentageToBps("0", true), 0);
  assert.equal(percentageToBps("", true), null);
  for (const invalid of ["", "-25", "100.01", "25.755", "NaN", "1e2", "25%", null]) {
    assert.throws(() => percentageToBps(invalid));
  }
});
test("management requires active company admins, not hierarchy rank or pending status", () => {
  const user = { role: "COMPANY_ADMIN", status: "ACTIVE", isActive: true, companyId: "a" };
  assert.equal(canManageAffiliates(user), true);
  for (const role of ["CUSTOMER", "CONSULTANT", "GROUP_LEADER", "MANAGER", "PARTNER"]) {
    assert.equal(canManageAffiliates({ ...user, role }), false);
  }
  assert.equal(canManageAffiliates({ ...user, status: "SUSPENDED" }), false);
  assert.equal(canManageAffiliates({ ...user, isActive: false }), false);
  assert.equal(canManageAffiliates({ ...user, companyId: null }), false);
});
test("contact normalization and status whitelist protect administrative writes", () => {
  const input = { displayName: " Artist ", email: " ARTIST@example.com ", category: "ARTIST", status: "PENDING", commissionBps: null };
  assert.equal(affiliateSchema.parse(input).email, "artist@example.com");
  assert.equal(affiliateSchema.parse(input).displayName, "Artist");
  assert.equal(affiliateSchema.safeParse({ ...input, status: "ADMIN" }).success, false);
});
