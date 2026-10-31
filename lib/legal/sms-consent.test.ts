import assert from "node:assert/strict";
import test from "node:test";
import type { Prisma } from "@prisma/client";
import { readSmsChoice, SMS_DISCLOSURE_VERSION, smsConsentText } from "./sms-consent";
import { recordSmsConsentRequest, smsConsentPhone } from "./sms-consent-record";

test("phone entry alone never opts in; explicit current disclosure is required", () => {
  const form = new FormData();
  form.set("phone", "+13055550100");
  assert.equal(readSmsChoice(form).smsOptIn, undefined);
  assert.equal(smsConsentPhone(readSmsChoice(form), "+13055550100"), null);
  form.set("smsOptIn", "yes");
  assert.throws(() => readSmsChoice(form));
  form.set("smsDisclosureVersion", SMS_DISCLOSURE_VERSION);
  assert.equal(smsConsentPhone(readSmsChoice(form), "(305) 555-0100"), "+13055550100");
  form.append("smsOptIn", "yes");
  assert.throws(() => readSmsChoice(form));
  form.delete("smsOptIn"); form.set("smsOptIn", "on");
  assert.throws(() => readSmsChoice(form));
});

test("selected consent rejects invalid numbers and stale disclosures", () => {
  const choice = { smsOptIn: "yes", smsDisclosureVersion: SMS_DISCLOSURE_VERSION } as const;
  for (const phone of [undefined, null, "", "123", "+130555501", "+130555501000000000"]) {
    assert.throws(() => smsConsentPhone(choice, phone), /SMS_PHONE_REQUIRED/);
  }
  assert.throws(() => smsConsentPhone({ smsOptIn: "yes" }, "+13055550100"), /INVALID_SMS_CONSENT/);
  const form = new FormData(); form.set("smsOptIn", "yes"); form.set("smsDisclosureVersion", "old");
  assert.throws(() => readSmsChoice(form));
});

test("customer disclosure is scoped to customer messages, not partner payouts or marketing", () => {
  const text = smsConsentText("CUSTOMER_ORDERS");
  for (const value of ["Go Virtual Health LLC", "order status", "consultation scheduling", "shipping updates", "frequency varies", "rates may apply", "STOP", "HELP", "not a condition of purchase"]) assert.ok(text.includes(value));
  assert.doesNotMatch(text, /payout status|program and portal updates/);
});

test("requests preserve exact evidence and never authorize delivery; checkout retry is deduplicated", async () => {
  const writes: Prisma.AuditLogCreateArgs[] = [];
  let exists = false;
  const tx = { auditLog: {
    findFirst: async () => exists ? { id: "existing" } : null,
    create: async (args: Prisma.AuditLogCreateArgs) => { writes.push(args); return { id: "record" }; }
  } } as unknown as Pick<Prisma.TransactionClient, "auditLog">;
  const input = { companyId: "company", subjectId: "customer", subjectType: "Customer" as const,
    actorUserId: "owner", program: "CUSTOMER_ORDERS" as const, source: "/rx/account" as const,
    phone: "+13055550100", requestKey: "order", choice: {} };
  await recordSmsConsentRequest(tx, input);
  assert.equal(writes.length, 0);
  const selected = { ...input, choice: { smsOptIn: "yes", smsDisclosureVersion: SMS_DISCLOSURE_VERSION } } as const;
  await recordSmsConsentRequest(tx, selected);
  assert.equal(writes.length, 1);
  assert.equal(writes[0].data.companyId, input.companyId);
  assert.equal(writes[0].data.userId, input.actorUserId);
  const metadata = writes[0].data.metadata as Prisma.JsonObject;
  assert.equal(metadata.phone, input.phone);
  assert.equal(metadata.disclosureText, smsConsentText("CUSTOMER_ORDERS"));
  assert.equal(metadata.phoneOwnershipVerified, false);
  assert.equal(metadata.deliveryAuthorized, false);
  exists = true;
  await recordSmsConsentRequest(tx, selected);
  assert.equal(writes.length, 1);
});
