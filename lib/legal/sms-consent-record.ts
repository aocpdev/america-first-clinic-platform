import type { Prisma } from "@prisma/client";
import { normalizePhoneToE164 } from "../phone";
import { PRIVACY_POLICY_URL, TERMS_OF_SERVICE_URL, SMS_DISCLOSURE_VERSION, smsConsentText, type SmsChoice, type SmsProgram } from "./sms-consent";

export function smsConsentPhone(choice: SmsChoice, rawPhone: string | null | undefined) {
  if (!choice.smsOptIn) return null;
  if (choice.smsOptIn !== "yes" || choice.smsDisclosureVersion !== SMS_DISCLOSURE_VERSION) throw new Error("INVALID_SMS_CONSENT");
  const phone = normalizePhoneToE164(rawPhone);
  if (!phone || !/^\+[1-9]\d{7,14}$/.test(phone) || (phone.startsWith("+1") && phone.length !== 12)) throw new Error("SMS_PHONE_REQUIRED");
  return phone;
}

/** Evidence of a self-submitted request, NOT authorization to send or proof of phone
 * ownership. Do not export to partners or messaging vendors. Provider activation,
 * phone verification and suppression/STOP synchronization remain separate gates. */
export async function recordSmsConsentRequest(tx: Pick<Prisma.TransactionClient, "auditLog">, input: {
  companyId: string; subjectId: string; subjectType: "User" | "Customer" | "AffiliateProfile";
  actorUserId?: string; program: SmsProgram;
  source: "/register" | "/profile" | "/rx/affiliates" | "/rx/checkout" | "/rx/account";
  phone: string | null | undefined; choice: SmsChoice; requestKey?: string;
}) {
  const phone = smsConsentPhone(input.choice, input.phone);
  if (!phone) return; // An unchecked/absent box never grants consent or overrides prior preferences.
  if (input.requestKey && await tx.auditLog.findFirst({ where: { companyId: input.companyId, action: "SMS_CONSENT_REQUESTED",
    resource: input.subjectType, resourceId: input.subjectId, metadata: { path: ["requestKey"], equals: input.requestKey } } })) return;
  await tx.auditLog.create({ data: { companyId: input.companyId, userId: input.actorUserId,
    action: "SMS_CONSENT_REQUESTED", resource: input.subjectType, resourceId: input.subjectId,
    metadata: { phone, program: input.program, source: input.source, requestKey: input.requestKey ?? null,
      disclosureVersion: SMS_DISCLOSURE_VERSION, disclosureText: smsConsentText(input.program),
      privacyPolicyUrl: PRIVACY_POLICY_URL, termsOfServiceUrl: TERMS_OF_SERVICE_URL,
      affirmativeAction: "UNCHECKED_OPTIONAL_CHECKBOX_SELECTED", phoneOwnershipVerified: false, deliveryAuthorized: false } } });
}
