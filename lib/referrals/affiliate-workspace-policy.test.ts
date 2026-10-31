import test from "node:test";
import assert from "node:assert/strict";
import { catalogPage, affiliatePayoutReturnBase, affiliatePayoutRecipientMatches } from "./affiliate-workspace-policy";

test("catalog pagination rejects malformed and unbounded page values", () => {
  for (const value of [undefined, "-1", "0", "1.5", "999999999", "NaN"]) assert.equal(catalogPage(value), 1);
  assert.equal(catalogPage("12"), 12);
});
test("payout return URLs are server-configured secure origins", () => {
  assert.equal(affiliatePayoutReturnBase(undefined, true), "https://affiliates.govirtualhealth.com");
  assert.equal(affiliatePayoutReturnBase("http://127.0.0.1:3008", false), "http://127.0.0.1:3008");
  for (const url of ["http://example.com", "https://user:pass@example.com", "https://example.com/path", "https://example.com?next=x"]) {
    assert.throws(() => affiliatePayoutReturnBase(url, true));
  }
});
test("payout identity cannot be borrowed from another tenant or inactive account", () => {
  const affiliate = { companyId: "a", authUserId: "auth-a", email: "a@example.test" };
  const user = { companyId: "a", authUserId: "auth-a", email: "a@example.test", status: "ACTIVE", isActive: true };
  assert.equal(affiliatePayoutRecipientMatches(affiliate, user), true);
  for (const changed of [{ companyId: "b" }, { authUserId: "auth-b" }, { email: "b@example.test" }, { isActive: false }, { status: "PENDING" }]) {
    assert.equal(affiliatePayoutRecipientMatches(affiliate, { ...user, ...changed }), false);
  }
});
