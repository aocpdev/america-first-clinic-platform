"use client";

import { useActionState } from "react";
import { LockKeyhole, MapPin } from "lucide-react";
import { startRxCheckout } from "./actions";
import { US_STATE_OPTIONS } from "@/lib/locations/us-states";
import { SmsOptIn } from "@/components/legal/sms-opt-in";

export function CheckoutShippingForm({ requestId, totalCents, address }: {
  requestId: string; totalCents: number;
  address: { line1: string; line2: string | null; city: string; state: string; postalCode: string } | null;
}) {
  const [state, action, pending] = useActionState(startRxCheckout, {});
  return <form action={action} className="rx-checkout-step">
    <div className="rx-checkout-step-heading"><MapPin size={20} aria-hidden="true" /><h2>Delivery & payment</h2></div>
    <p>Confirm where we should ship your order after clinical approval. Shipping and applicable taxes are included in your product price.</p>
    <input type="hidden" name="requestId" value={requestId} />
    <input type="hidden" name="expectedTotalCents" value={totalCents} />
    <fieldset disabled={pending}><legend className="sr-only">Shipping address</legend>
      <label className="rx-checkout-full">Street address<input name="line1" required maxLength={200} autoComplete="shipping address-line1" defaultValue={address?.line1} /></label>
      <label className="rx-checkout-full">Apartment or suite (optional)<input name="line2" maxLength={200} autoComplete="shipping address-line2" defaultValue={address?.line2 ?? ""} /></label>
      <label>City<input name="city" required maxLength={100} autoComplete="shipping address-level2" defaultValue={address?.city} /></label>
      <label>State<select name="state" required autoComplete="shipping address-level1" defaultValue={address?.state ?? ""}><option value="" disabled>Select state</option>{US_STATE_OPTIONS.map(option => <option value={option.value} key={option.value}>{option.label}</option>)}</select></label>
      <label>ZIP code<input name="postalCode" required pattern="[0-9]{5}(-[0-9]{4})?" maxLength={10} autoComplete="shipping postal-code" defaultValue={address?.postalCode} /></label>
    </fieldset>
    <SmsOptIn program="CUSTOMER_ORDERS" disabled={pending} phoneDescription="Applies only to the phone number saved in your customer record. Contact support to correct that number before requesting texts." />
    {state.error && <p className="rx-cart-warning" role="alert">{state.error}</p>}
    <p>Payment is handled securely by Stripe. Prescription treatments require clinical approval.</p>
    <button type="submit" disabled={pending} className="rx-home-primary"><LockKeyhole size={16} aria-hidden="true" />{pending ? "Opening secure payment…" : "Continue to secure payment"}</button>
  </form>;
}
