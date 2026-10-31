import test from "node:test";
import assert from "node:assert/strict";
import { referralLandingInput, approvedBrowsingAffiliate, legacyAffiliateLanding } from "./rx-browsing-referral";
import { rxDestination } from "../products/rx-routing";

test("landing validates codes, duplicate parameters and product paths", () => {
  assert.deepEqual(referralLandingInput(new URLSearchParams("ref=AF-ABC123&product=bpc-157")), { code: "AF-ABC123", product: "bpc-157" });
  assert.deepEqual(referralLandingInput(new URLSearchParams("ref=AF-ABC123")), { code: "AF-ABC123", product: null });
  for (const query of ["", "ref=AF-ABC123&ref=AF-OTHER1", "ref=AF-ABC123&product=../admin", "ref=AF-ABC123&product=", "ref=AF-ABC123&product=a&product=b", "ref=invalid"]) assert.equal(referralLandingInput(new URLSearchParams(query)), null);
});
test("legacy reserved links work without capturing existing agent links", () => {
  assert.equal(legacyAffiliateLanding("AF-ABC123", "/rx", "bpc-157"), "/rx/referral?ref=AF-ABC123&product=bpc-157");
  assert.equal(legacyAffiliateLanding("AGENT123", ""), null);
  assert.equal(legacyAffiliateLanding(undefined, ""), null);
  const duplicate = legacyAffiliateLanding(["AF-ABC123", "AF-OTHER1"], "")!;
  assert.equal(referralLandingInput(new URL(duplicate, "https://rx.govirtualhealth.com").searchParams), null);
});
test("referral routing stays within RX and preserves the storefront kill switch", () => {
  assert.equal(rxDestination("rx.govirtualhealth.com", "/referral", true), "/rx/referral");
  assert.equal(rxDestination("rx.govirtualhealth.com", "/referral", false), "/rx/unavailable");
  assert.equal(rxDestination("portal.govirtualhealth.com", "/referral", true), null);
});
test("browsing lookup requires an approved affiliate in the configured company", async () => {
  let calls = 0;
  const db = { affiliateProfile: { findFirst: async (args: any) => {
    calls++;
    assert.deepEqual(args.where, { companyId: "company-a", referralCode: "AF-ABC123", status: "APPROVED" });
    assert.deepEqual(args.select, { id: true, referralCode: true, displayName: true });
    return null;
  } } } as any;
  assert.equal(await approvedBrowsingAffiliate(db, "company-a", "bad"), null);
  assert.equal(calls, 0);
  assert.equal(await approvedBrowsingAffiliate(db, "company-a", "AF-ABC123"), null);
  assert.equal(calls, 1);
});
