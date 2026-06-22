"use client";

import { updateOrderShippingTracking } from "@/app/orders/actions";
import { SubmitButton } from "@/components/ui/submit-button";
import { SHIPPING_CARRIERS } from "@/lib/orders/tracking";

export function OrderTrackingForm({
  orderId,
  shippingCarrier,
  shippingTrackingCode,
  compact = false
}: {
  orderId: string;
  shippingCarrier: string | null;
  shippingTrackingCode: string | null;
  compact?: boolean;
}) {
  return (
    <div className={compact ? "rounded-2xl border border-border bg-white p-4" : "rounded-3xl border border-border bg-white p-5"}>
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Shipping control</p>
      <h3 className={compact ? "mt-2 text-base font-semibold text-clinic-ink" : "mt-2 text-lg font-semibold text-clinic-ink"}>
        Shipment tracking
      </h3>
      <p className="mt-1 text-sm leading-6 text-slate-500">
        Update the carrier and tracking code attached to this order.
      </p>

      <form action={updateOrderShippingTracking} className="mt-4 space-y-3">
        <input type="hidden" name="orderId" value={orderId} />
        <input type="hidden" name="trackingAction" value="save" />
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Carrier</span>
            <select
              name="shippingCarrier"
              defaultValue={shippingCarrier ?? ""}
              className="mt-2 h-11 w-full rounded-xl border border-border bg-white px-3 text-sm font-semibold text-clinic-ink outline-none transition focus:border-clinic-blue focus:ring-4 focus:ring-blue-100"
            >
              <option value="">Auto / other</option>
              {SHIPPING_CARRIERS.map((carrier) => (
                <option key={carrier.value} value={carrier.value}>
                  {carrier.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Tracking code</span>
            <input
              name="shippingTrackingCode"
              defaultValue={shippingTrackingCode ?? ""}
              placeholder="Tracking code"
              className="mt-2 h-11 w-full rounded-xl border border-border bg-white px-3 text-sm font-semibold outline-none transition focus:border-clinic-blue focus:ring-4 focus:ring-blue-100"
            />
          </label>
        </div>
        <div className="flex justify-end">
          <SubmitButton pendingText="Saving..." className="h-11 rounded-xl bg-clinic-navy sm:w-auto">
            Save tracking
          </SubmitButton>
        </div>
      </form>

      {shippingTrackingCode ? (
        <form action={updateOrderShippingTracking} className="mt-2 flex justify-end">
          <input type="hidden" name="orderId" value={orderId} />
          <input type="hidden" name="trackingAction" value="delete" />
          <SubmitButton pendingText="Clearing..." variant="outline" className="h-11 border-red-100 text-red-700 hover:bg-red-50 sm:w-auto">
            Clear tracking
          </SubmitButton>
        </form>
      ) : null}
    </div>
  );
}
