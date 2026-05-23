"use client";

import { useState } from "react";
import { updateOrderPipelineStage } from "@/app/orders/actions";
import { Button } from "@/components/ui/button";
import { ORDER_PIPELINE_STAGES, orderPipelineDescription } from "@/lib/sales/pipeline";

export function OrderStageForm({
  orderId,
  currentStage,
  paymentStatus,
  prescriptionDocumentUrl,
  prescriptionNotes,
  shippingCarrier,
  shippingTrackingCode
}: {
  orderId: string;
  currentStage: string;
  paymentStatus: string;
  prescriptionDocumentUrl: string | null;
  prescriptionNotes: string | null;
  shippingCarrier: string | null;
  shippingTrackingCode: string | null;
}) {
  const [stage, setStage] = useState(currentStage || "AWAITING_PAYMENT");
  const needsRefundConfirmation = stage === "DEFERRED" && paymentStatus === "CAPTURED";
  const showsPrescription = stage === "APPROVAL";
  const showsTracking = stage === "FULFILLMENT" || stage === "SHIPPED";

  return (
    <form action={updateOrderPipelineStage} className="space-y-4">
      <input type="hidden" name="orderId" value={orderId} />
      <div>
        <label className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500" htmlFor="orderPipelineStage">
          Order step
        </label>
        <select
          id="orderPipelineStage"
          name="orderPipelineStage"
          value={stage}
          onChange={(event) => setStage(event.target.value)}
          className="mt-2 h-12 w-full rounded-2xl border border-border bg-white px-4 text-sm font-semibold text-clinic-ink shadow-line outline-none transition focus:border-clinic-blue focus:ring-4 focus:ring-blue-100"
        >
          {ORDER_PIPELINE_STAGES.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
        <p className="mt-2 text-xs leading-5 text-slate-500">{orderPipelineDescription(stage)}</p>
      </div>

      {showsPrescription ? (
        <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-clinic-navy">Admin-only prescription record</p>
          <input
            name="prescriptionDocumentUrl"
            defaultValue={prescriptionDocumentUrl ?? ""}
            placeholder="Secure prescription document URL"
            className="mt-3 h-11 w-full rounded-xl border border-border bg-white px-3 text-sm outline-none transition focus:border-clinic-blue focus:ring-4 focus:ring-blue-100"
          />
          <textarea
            name="prescriptionNotes"
            defaultValue={prescriptionNotes ?? ""}
            placeholder="Internal clinical notes. Hidden from partners, leaders, and consultants."
            className="mt-3 min-h-24 w-full rounded-xl border border-border bg-white px-3 py-3 text-sm outline-none transition focus:border-clinic-blue focus:ring-4 focus:ring-blue-100"
          />
        </div>
      ) : null}

      {needsRefundConfirmation ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
          <p className="text-sm font-semibold text-red-700">Deferred captured orders require a refund.</p>
          <p className="mt-1 text-xs leading-5 text-red-600">Type <span className="font-bold">refunded</span> to confirm the refund request.</p>
          <input
            name="refundConfirmation"
            placeholder="Type refunded"
            className="mt-3 h-11 w-full rounded-xl border border-red-200 bg-white px-3 text-sm font-semibold outline-none transition focus:border-red-400 focus:ring-4 focus:ring-red-100"
          />
        </div>
      ) : null}

      {showsTracking ? (
        <div className="rounded-2xl border border-border bg-clinic-mist p-4">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-clinic-navy">Shipping tracking</p>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            Add tracking before fulfillment when possible. If no tracking is entered, no tracking webhook will be sent.
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <select
              name="shippingCarrier"
              defaultValue={shippingCarrier ?? ""}
              className="h-11 rounded-xl border border-border bg-white px-3 text-sm font-semibold text-clinic-ink outline-none transition focus:border-clinic-blue focus:ring-4 focus:ring-blue-100"
            >
              <option value="">Select carrier</option>
              <option value="fedex">FedEx</option>
              <option value="ups">UPS</option>
              <option value="usps">USPS</option>
              <option value="dhl">DHL</option>
            </select>
            <input
              name="shippingTrackingCode"
              defaultValue={shippingTrackingCode ?? ""}
              placeholder="Tracking code"
              className="h-11 rounded-xl border border-border bg-white px-3 text-sm font-semibold outline-none transition focus:border-clinic-blue focus:ring-4 focus:ring-blue-100"
            />
          </div>
          <label className="mt-3 flex items-start gap-2 text-xs leading-5 text-slate-600">
            <input type="checkbox" name="allowFulfillmentWithoutTracking" value="true" className="mt-1" />
            Continue without tracking for now
          </label>
        </div>
      ) : null}

      <Button type="submit" className="h-11 w-full rounded-xl bg-clinic-navy">
        Save order step
      </Button>
    </form>
  );
}
