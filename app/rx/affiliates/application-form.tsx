"use client";
import { useActionState, useEffect, useRef } from "react";
import Script from "next/script";
import { ArrowUpRight, CheckCircle2 } from "lucide-react";
import { applyForAffiliation, type ApplicationState } from "./actions";
import { SmsOptIn } from "@/components/legal/sms-opt-in";
import { PhoneInput } from "@/components/ui/phone-input";

const initialState: ApplicationState = { status: "idle", message: "" };
const field = "mt-2 min-h-12 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-900 outline-none focus:border-emerald-800 focus:ring-2 focus:ring-emerald-100";
type Turnstile = { render: (element: HTMLElement, options: { sitekey: string; action: string; size: string }) => string; remove: (id: string) => void };
function ApplicationVerification({ siteKey }: { siteKey: string }) {
  const container = useRef<HTMLDivElement>(null);
  const widget = useRef<string | null>(null);
  const api = () => (window as Window & { turnstile?: Turnstile }).turnstile;
  const render = () => {
    if (container.current && widget.current === null && api()) widget.current = api()!.render(container.current, { sitekey: siteKey, action: "affiliate-application", size: "flexible" });
  };
  useEffect(() => () => { if (widget.current !== null) { api()?.remove(widget.current); widget.current = null; } }, []);
  return <><Script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" strategy="afterInteractive" onReady={render} /><div ref={container} /></>;
}
export function ApplicationForm({ token, enabled, siteKey }: { token: string; enabled: boolean; siteKey?: string }) {
  const [state, action, pending] = useActionState(applyForAffiliation, initialState);
  if (!enabled) return <div className="rounded-2xl bg-[#eef3ef] p-6 text-sm leading-7 text-[#456457]">Applications are opening soon. Explore the program below and check back to apply.</div>;
  if (state.status === "success") return <div role="status" className="rounded-2xl bg-[#eef3ef] p-7"><CheckCircle2 className="h-8 w-8 text-emerald-800" aria-hidden="true" /><h3 className="mt-5 text-2xl font-medium tracking-tight">You’re on our radar.</h3><p className="mt-4 text-sm leading-7 text-slate-600">{state.message}</p></div>;
  return <form action={action} className="space-y-5">
    <input type="hidden" name="applicationToken" value={token} />
    <div hidden aria-hidden="true"><label>Company website<input name="companyWebsite" tabIndex={-1} autoComplete="off" /></label></div>
    <label className="block text-sm font-medium">Full name<input className={field} name="displayName" autoComplete="name" minLength={2} maxLength={100} required /></label>
    <label className="block text-sm font-medium">Email address<input className={field} name="email" type="email" autoComplete="email" maxLength={254} required /></label>
    <label className="block text-sm font-medium">Mobile number <span className="font-normal text-slate-500">(optional, for text updates)</span><PhoneInput name="phone" privacyNotice={false} maxLength={40} className={field} /></label>
    <label className="block text-sm font-medium">What best describes you?<select className={field} name="category" defaultValue="" required><option value="" disabled>Select your community</option><option value="INFLUENCER">Creator / influencer</option><option value="GYM">Gym / fitness studio</option><option value="TRAINER">Trainer / coach</option><option value="ARTIST">Artist / entertainer</option><option value="OTHER">Other</option></select></label>
    <label className="block text-sm font-medium">Website or social profile <span className="font-normal text-slate-500">(optional)</span><input className={field} name="website" type="url" placeholder="https://" maxLength={500} /></label>
    <label className="block text-sm font-medium">Tell us about your community <span className="font-normal text-slate-500">(optional)</span><textarea className={field} name="message" rows={3} maxLength={1200} placeholder="Your audience, interests, and how you would like to collaborate." /></label>
    <label className="flex gap-3 text-xs leading-6 text-slate-600"><input className="mt-1 h-5 w-5 shrink-0 accent-emerald-900" type="checkbox" name="consent" value="yes" required /><span>I agree to be contacted by email about this application. I have read the <a className="underline" href="https://portal.govirtualhealth.com/privacy-policy" target="_blank" rel="noreferrer">Privacy Policy</a>. This is not SMS consent. Submitting does not enroll me in the program or guarantee approval.</span></label>
    <SmsOptIn program="AFFILIATE_APPLICATION" />
    {siteKey && <ApplicationVerification siteKey={siteKey} />}
    {state.status === "error" && <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-800">{state.message}</p>}
    <button disabled={pending} className="flex min-h-14 w-full items-center justify-between rounded-full bg-[#183d35] px-6 text-sm font-medium text-white transition-colors hover:bg-[#295c4d] disabled:opacity-60">{pending ? "Submitting…" : "Apply to become an affiliate"}<ArrowUpRight size={18} aria-hidden="true" /></button>
    <p className="text-center text-xs leading-5 text-slate-500">No patient information or banking details needed to apply.</p>
  </form>;
}
