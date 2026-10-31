import { PRIVACY_POLICY_URL, TERMS_OF_SERVICE_URL } from "@/lib/legal/sms-consent";

export function ContactPrivacyNotice() {
  return <span className="mt-2 block text-xs font-normal leading-5 text-slate-500">Saving contact information does not enroll this person in SMS. Agents and administrators cannot grant consent on someone else’s behalf. The phone holder must opt in through their own registration, profile, or checkout. <a className="underline" href={PRIVACY_POLICY_URL} target="_blank" rel="noreferrer">Privacy Policy</a> · <a className="underline" href={TERMS_OF_SERVICE_URL} target="_blank" rel="noreferrer">Terms</a>.</span>;
}
