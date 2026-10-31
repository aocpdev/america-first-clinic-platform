"use client";

import { useActionState } from "react";
import { SmsOptIn } from "@/components/legal/sms-opt-in";
import { PhoneInput } from "@/components/ui/phone-input";
import { requestCustomerTexts, type CustomerSmsState } from "./sms-actions";

export function CustomerSmsForm() {
  const [state, action, pending] = useActionState(requestCustomerTexts, {} as CustomerSmsState);
  return <section className="mt-10 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6" aria-labelledby="customer-text-updates" data-clarity-mask="true">
    <h2 id="customer-text-updates" className="text-xl font-semibold text-clinic-navy">Stay updated on your orders</h2>
    <p className="mt-2 text-sm leading-6 text-slate-600">Choose whether to request text updates about your orders, consultation scheduling, and delivery. You can continue using your account without signing up.</p>
    <form action={action} className="mt-5 space-y-4">
      <label className="block text-sm font-medium text-slate-700">Mobile number (optional)
        <PhoneInput name="smsPhone" privacyNotice={false} maxLength={40} disabled={pending} className="mt-2" />
      </label>
      <SmsOptIn program="CUSTOMER_ORDERS" disabled={pending} />
      <button type="submit" disabled={pending} className="min-h-11 rounded-full bg-clinic-navy px-6 py-3 text-sm font-semibold text-white disabled:opacity-50">{pending ? "Saving…" : "Save text request"}</button>
      {state.error && <p role="alert" className="text-sm text-red-700">{state.error}</p>}
      {state.message && <p role="status" className="text-sm leading-6 text-slate-600">{state.message}</p>}
    </form>
  </section>;
}
