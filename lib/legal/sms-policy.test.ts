import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { LEGAL_COMPANY_NAME, LEGAL_POLICY_UPDATED } from "./company";
import { MOBILE_INFORMATION_POLICY, PARTNER_TEXT_MESSAGING_POLICY, SMS_CONSENT_AND_SUPPORT } from "./sms-policy";

test("mobile disclosure prohibits marketing sharing and narrowly limits delivery access", () => {
  for (const phrase of ["phone numbers", "opt-in data and consent", "will not be shared, sold, or disclosed", "third parties or affiliates", "marketing or promotional purposes", "except as needed to deliver the messages themselves", "all information-sharing provisions", "not transferable"]) {
    assert.ok(MOBILE_INFORMATION_POLICY.includes(phrase), phrase);
  }
});

test("partner SMS disclosure identifies sender, scope, frequency, rates and opt-out", () => {
  for (const phrase of ["If you opt in", "Go Virtual Health", "partner account", "program and portal updates", "meeting reminders", "order and payout status", "Message frequency varies", "Message and data rates may apply", "STOP", "HELP", "Consent is not a condition of partnership"]) {
    assert.ok(PARTNER_TEXT_MESSAGING_POLICY.includes(phrase), phrase);
  }
  assert.match(SMS_CONSENT_AND_SUPPORT, /does not by itself constitute consent/);
  assert.match(SMS_CONSENT_AND_SUPPORT, /separately and voluntarily/);
  assert.match(SMS_CONSENT_AND_SUPPORT, /support@govirtualhealth\.com/);
});

test("privacy and terms render the same SMS disclosures without divergent copies", () => {
  for (const route of ["privacy-policy", "terms-of-service"]) {
    const source = readFileSync(new URL(`../../components/legal/${route}-content.tsx`, import.meta.url), "utf8");
    for (const constant of ["MOBILE_INFORMATION_POLICY", "PARTNER_TEXT_MESSAGING_POLICY", "SMS_CONSENT_AND_SUPPORT"]) {
      assert.ok(source.split(constant).length >= 3, `${route} must import and use ${constant}`);
    }
  }
  const privacy = readFileSync(new URL("../../components/legal/privacy-policy-content.tsx", import.meta.url), "utf8");
  assert.match(privacy, /subject to the Mobile information and SMS consent restrictions below/);
});

test("public policies and order documents consistently use the approved legal operator", () => {
  assert.equal(LEGAL_COMPANY_NAME, "Go Virtual Health LLC");
  assert.equal(LEGAL_POLICY_UPDATED, "October 30, 2026");
  const policies = ["privacy-policy", "terms-of-service"].map(route => `components/legal/${route}-content.tsx`)
    .concat(["refund-policy", "shipping-policy", "medical-disclaimer"].map(route => `app/${route}/page.tsx`));
  for (const path of [...policies, "app/i/[code]/page.tsx", "components/orders/order-document.tsx"]) {
    const source = readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
    assert.ok(source.includes("LEGAL_COMPANY_NAME"), path);
    assert.doesNotMatch(source, /ACV2|Investment Group|may later be registered/);
    if (policies.includes(path)) assert.ok(source.includes("updated={LEGAL_POLICY_UPDATED}"));
  }
});
