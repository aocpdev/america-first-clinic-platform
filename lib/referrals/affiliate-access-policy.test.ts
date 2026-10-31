import assert from "node:assert/strict";
import test from "node:test";
import { canAccessAffiliatePortal } from "./affiliate-access-policy";

const identity = { id: "auth-a", email: "Artist@example.com", email_confirmed_at: "2026-01-01" };
const profile = { authUserId: "auth-a", email: "artist@example.com", status: "APPROVED", companyId: "company-a" };
test("access requires an explicit identity binding and confirmed matching email", () => {
  assert.equal(canAccessAffiliatePortal(identity, profile, "company-a"), true);
  assert.equal(canAccessAffiliatePortal(identity, { ...profile, authUserId: null }, "company-a"), false);
  assert.equal(canAccessAffiliatePortal({ ...identity, email_confirmed_at: undefined }, profile, "company-a"), false);
  assert.equal(canAccessAffiliatePortal({ ...identity, email: "other@example.com" }, profile, "company-a"), false);
  assert.equal(canAccessAffiliatePortal(null, profile, "company-a"), false);
});
test("suspension, archive and tenant mismatch deny access even with a valid session", () => {
  for (const status of ["PENDING", "SUSPENDED", "ARCHIVED"]) {
    assert.equal(canAccessAffiliatePortal(identity, { ...profile, status }, "company-a"), false);
  }
  assert.equal(canAccessAffiliatePortal(identity, profile, "company-b"), false);
  assert.equal(canAccessAffiliatePortal(identity, { ...profile, authUserId: "auth-b" }, "company-a"), false);
});
