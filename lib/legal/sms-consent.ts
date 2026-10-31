import { z } from "zod";

export const SMS_DISCLOSURE_VERSION = "2026-10-30.v1";
export const PRIVACY_POLICY_URL = "https://portal.govirtualhealth.com/privacy-policy";
export const TERMS_OF_SERVICE_URL = "https://portal.govirtualhealth.com/terms-of-service";
export type SmsProgram = "PARTNER_ACCOUNT" | "CUSTOMER_ORDERS" | "AFFILIATE_APPLICATION";
const scope: Record<SmsProgram, string> = {
  PARTNER_ACCOUNT: "my partner or agent account, including program and portal updates, meeting reminders, and order and payout status",
  CUSTOMER_ORDERS: "my customer account and orders, including order status, consultation scheduling reminders, and shipping updates",
  AFFILIATE_APPLICATION: "my affiliate application, including application status and next steps"
};
export function smsConsentText(program: SmsProgram) {
  return `I agree to receive text messages from Go Virtual Health (Go Virtual Health LLC) at the phone number I provide about ${scope[program]}. Message frequency varies. Message and data rates may apply. Reply STOP to opt out or HELP for help. Consent is optional and is not a condition of purchase, partnership, application approval, or account access. I confirm that I am the subscriber or authorized user of this phone number.`;
}
export const smsChoiceShape = {
  smsOptIn: z.literal("yes").optional(),
  smsDisclosureVersion: z.literal(SMS_DISCLOSURE_VERSION).optional()
};
export type SmsChoice = { smsOptIn?: "yes"; smsDisclosureVersion?: typeof SMS_DISCLOSURE_VERSION };
export function readSmsChoice(form: FormData): SmsChoice {
  for (const name of Object.keys(smsChoiceShape)) if (form.getAll(name).length > 1) throw new Error("INVALID_SMS_CONSENT");
  const choice = z.object(smsChoiceShape).parse({ smsOptIn: form.get("smsOptIn") ?? undefined, smsDisclosureVersion: form.get("smsDisclosureVersion") ?? undefined });
  if (choice.smsOptIn && !choice.smsDisclosureVersion) throw new Error("INVALID_SMS_CONSENT");
  return choice;
}
