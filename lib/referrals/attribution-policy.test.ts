import assert from "node:assert/strict";
import test from "node:test";
import { proposeOriginalSeller, resolvePurchaseAttribution, sellerFromOrder, type SellerIdentity, type PurchaseEvidence } from "./attribution-policy";

const agent: SellerIdentity = { companyId: "company-a", role: "CONSULTANT", profileId: "agent-a" };
const affiliate: SellerIdentity = { companyId: "company-a", role: "AFFILIATE", profileId: "affiliate-a" };
const evidence = (overrides: Partial<PurchaseEvidence> = {}): PurchaseEvidence => ({
  id: "order-a", companyId: "company-a", customerId: "customer-a", paymentStatus: "CAPTURED",
  capturedAt: new Date("2026-01-01T10:00:00Z"), seller: agent, ...overrides
});
const decision = (overrides: Partial<Parameters<typeof resolvePurchaseAttribution>[0]> = {}) => resolvePurchaseAttribution({
  companyId: "company-a", originalOwner: agent, originalOwnerActive: true,
  referral: affiliate, referralActive: true, hasPurchaseHistory: true, ...overrides
});

test("reorders retain original agent despite another affiliate link", () => {
  assert.deepEqual(decision(), { status: "ATTRIBUTED", seller: agent, reason: "ORIGINAL_OWNER_RETAINED" });
});
test("affiliate ownership persists for every subsequent purchase", () => {
  assert.deepEqual(decision({ originalOwner: affiliate, referral: agent }), { status: "ATTRIBUTED", seller: affiliate, reason: "ORIGINAL_OWNER_RETAINED" });
  assert.equal(decision({ originalOwner: affiliate, referral: null }).status, "ATTRIBUTED");
});
test("new referrals remain provisional until capture", () => {
  assert.equal(decision({ originalOwner: null, hasPurchaseHistory: false }).status, "PROVISIONAL");
});
test("existing history without an owner is not claimed by a new referral", () => {
  assert.equal(decision({ originalOwner: null }).status, "REVIEW_REQUIRED");
});
test("inactive original owner never falls back to another seller", () => {
  assert.equal(decision({ originalOwnerActive: false }).status, "REVIEW_REQUIRED");
});
test("cross-company owner and referral are rejected", () => {
  assert.equal(decision({ originalOwner: { ...agent, companyId: "other" } }).status, "REVIEW_REQUIRED");
  assert.equal(decision({ originalOwner: null, hasPurchaseHistory: false, referral: { ...affiliate, companyId: "other" } }).status, "REVIEW_REQUIRED");
});
test("direct purchases without history or referral remain unattributed", () => {
  assert.equal(decision({ originalOwner: null, referral: null, hasPurchaseHistory: false }).status, "UNATTRIBUTED");
});
test("first successful payment decides acquisition regardless of input order", () => {
  const later = evidence({ id: "later", seller: affiliate, capturedAt: new Date("2026-02-01T10:00:00Z") });
  const orders = [later, evidence()];
  const result = proposeOriginalSeller("company-a", "customer-a", orders);
  assert.equal(result.status, "PROPOSED");
  if (result.status === "PROPOSED") assert.deepEqual(result.seller, agent);
  assert.equal(orders[0].id, "later");
});
test("pending and failed invoices do not establish ownership", () => {
  assert.equal(proposeOriginalSeller("company-a", "customer-a", [evidence({ paymentStatus: "FAILED", capturedAt: null })]).status, "NO_PURCHASE_HISTORY");
});
test("unattributed first purchase cannot be skipped", () => {
  assert.equal(proposeOriginalSeller("company-a", "customer-a", [evidence({ seller: null }), evidence({ id: "later", capturedAt: new Date("2026-02-01") })]).status, "REVIEW_REQUIRED");
});
test("missing capture time, refund and conflicting simultaneous captures require review", () => {
  for (const orders of [[evidence({ capturedAt: null })], [evidence({ paymentStatus: "REFUNDED" })], [evidence(), evidence({ id: "other", seller: affiliate })]]) {
    assert.equal(proposeOriginalSeller("company-a", "customer-a", orders).status, "REVIEW_REQUIRED");
  }
});
test("customer and tenant mismatches require review", () => {
  assert.equal(proposeOriginalSeller("company-a", "customer-a", [evidence({ customerId: "other" })]).status, "REVIEW_REQUIRED");
});
test("agent seller is not replaced by hierarchy ancestors", () => {
  assert.deepEqual(sellerFromOrder({ companyId: "company-a", consultantProfileId: "agent-a", groupLeaderProfileId: "leader-a", managerProfileId: "manager-a", partnerProfileId: "partner-a" }), agent);
});
test("direct leader, manager, partner and admin sales are distinguished", () => {
  const order = { companyId: "company-a", consultantProfileId: null, groupLeaderProfileId: "leader-a", managerProfileId: "manager-a", partnerProfileId: "partner-a" };
  assert.equal(sellerFromOrder(order)?.role, "GROUP_LEADER");
  assert.equal(sellerFromOrder({ ...order, groupLeaderProfileId: null })?.role, "MANAGER");
  assert.equal(sellerFromOrder({ ...order, groupLeaderProfileId: null, managerProfileId: null })?.role, "PARTNER");
  assert.equal(sellerFromOrder({ ...order, groupLeaderProfileId: null, managerProfileId: null, partnerProfileId: null }), null);
});
