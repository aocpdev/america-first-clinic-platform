import { PRIVACY_POLICY_URL, TERMS_OF_SERVICE_URL, SMS_DISCLOSURE_VERSION, smsConsentText, type SmsProgram } from "@/lib/legal/sms-consent";

export function SmsOptIn({ program, className = "", phoneDescription, disabled = false }: { program: SmsProgram; className?: string; phoneDescription?: string; disabled?: boolean }) {
  return <fieldset disabled={disabled} className={`sms-opt-in min-w-0 rounded-2xl border border-slate-200 bg-slate-50 p-4 ${className}`}>
    <legend className="px-1 text-sm font-semibold text-slate-800">Text updates (optional)</legend>
    <input type="hidden" name="smsDisclosureVersion" value={SMS_DISCLOSURE_VERSION} />
    {phoneDescription && <p className="mb-3 text-xs leading-6 text-slate-600">{phoneDescription}</p>}
    <label className="flex min-h-11 items-start gap-3 text-sm leading-6 text-slate-700">
      <input type="checkbox" name="smsOptIn" value="yes" className="mt-1 h-5 w-5 shrink-0 accent-emerald-900" />
      <span>{smsConsentText(program)}</span>
    </label>
    <p className="mt-3 text-xs leading-6 text-slate-600">Mobile information and SMS consent will not be shared with third parties or affiliates for marketing or promotional purposes. <a className="underline" href={PRIVACY_POLICY_URL} target="_blank" rel="noreferrer">Privacy Policy</a> · <a className="underline" href={TERMS_OF_SERVICE_URL} target="_blank" rel="noreferrer">Terms of Service</a>. For help: support@govirtualhealth.com.</p>
    <p className="mt-2 text-xs leading-6 text-slate-500">Leaving this unchecked does not enroll you in texts or change an existing preference. Only the phone number holder may submit this choice.</p>
  </fieldset>;
}
