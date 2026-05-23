"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { FileText, NotebookPen, PackageCheck, Pill, Trash2 } from "lucide-react";
import { deleteUnpaidOrder, updateOrderOpportunityDetails, updatePipelineOrderStage } from "@/app/pipeline/actions";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import { CUSTOMER_PIPELINE_STAGES, type CustomerPipelineStage } from "@/lib/sales/pipeline";
import { formatCurrency } from "@/lib/products/catalog";

type PipelineOpportunity = {
  id: string;
  customerId: string;
  name: string;
  email: string;
  phone: string | null;
  consultantName: string | null;
  consultantAvatarUrl: string | null;
  pipelineStage: CustomerPipelineStage;
  pipelineUpdatedAt: string | null;
  orderTotalCents: number;
  opportunityValueCents: number;
  adminMarginCents: number;
  createdAt: string | null;
  notes: string | null;
  rxDocumentUrl: string | null;
  gfeDocumentUrl: string | null;
  paymentStatus: string;
};

const stageStyles = [
  "bg-[#edf4ff]",
  "bg-[#d8f3ee]",
  "bg-[#e8eef6]",
  "bg-[#eef2ff]",
  "bg-[#fff1f2]",
  "bg-[#f7f7fb]",
  "bg-[#e8f8ee]"
];

function formatDate(value: string | null) {
  if (!value) return "No activity yet";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(value));
}

function initials(name: string | null, email: string) {
  const source = name || email;
  return source
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join("")
    .toUpperCase();
}

export function CustomerPipelineBoard({
  customers,
  showConsultant,
  mode = "admin",
  basePath = "/admin"
}: {
  customers: PipelineOpportunity[];
  showConsultant?: boolean;
  mode?: "admin" | "partner" | "group_leader" | "consultant";
  basePath?: "/admin" | "/partner" | "/consultant";
}) {
  const [editing, setEditing] = useState<PipelineOpportunity | null>(null);
  const canManageStages = mode === "admin";
  const canManageInternalDocs = mode === "admin";

  const opportunitiesByStage = useMemo(() => {
    const map = new Map<CustomerPipelineStage, PipelineOpportunity[]>();
    CUSTOMER_PIPELINE_STAGES.forEach((stage) => map.set(stage.value, []));
    customers.forEach((opportunity) => {
      const bucket = map.get(opportunity.pipelineStage) ?? map.get("AWAITING_PAYMENT");
      bucket?.push(opportunity);
    });
    return map;
  }, [customers]);

  return (
    <>
      <div className="overflow-x-auto pb-4">
        <div className="flex min-w-max gap-4">
          {CUSTOMER_PIPELINE_STAGES.map((stage, index) => {
            const stageOpportunities = opportunitiesByStage.get(stage.value) ?? [];
            const stageValueCents = stageOpportunities.reduce((sum, opportunity) => sum + opportunity.opportunityValueCents, 0);
            const stageRevenueCents = stageOpportunities.reduce((sum, opportunity) => sum + opportunity.orderTotalCents, 0);

            return (
              <section key={stage.value} className="w-[360px] shrink-0">
                <div className={`rounded-2xl border border-border px-4 py-3 shadow-sm ${stageStyles[index % stageStyles.length]}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-semibold text-clinic-ink">{stage.label}</h3>
                      <div className="mt-2 flex items-center gap-3 text-sm text-slate-600">
                        <span>{stageOpportunities.length} Opportunities</span>
                        <span className="font-semibold text-clinic-ink">{formatCurrency(stageValueCents)}</span>
                      </div>
                      {mode === "admin" ? (
                        <p className="mt-1 text-xs font-semibold text-slate-500">Revenue {formatCurrency(stageRevenueCents)}</p>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="mt-4 space-y-3">
                  {stageOpportunities.map((opportunity) => (
                    <article key={opportunity.id} className="rounded-2xl border border-border bg-white p-4 shadow-sm">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <Link
                            href={`${basePath}/orders/${opportunity.id}`}
                            className="block truncate text-base font-semibold text-clinic-ink transition hover:text-clinic-red"
                          >
                            {opportunity.name}
                          </Link>
                          {showConsultant && opportunity.consultantName ? (
                            <p className="mt-1 truncate text-xs font-semibold uppercase tracking-[0.14em] text-clinic-red">
                              {opportunity.consultantName}
                            </p>
                          ) : null}
                        </div>
                        <div className="relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full border border-slate-300 bg-[#dce8ff] text-sm font-semibold text-clinic-navy">
                          {opportunity.consultantAvatarUrl ? (
                            <Image
                              src={opportunity.consultantAvatarUrl}
                              alt={opportunity.consultantName ?? "Seller"}
                              fill
                              sizes="40px"
                              className="object-cover"
                            />
                          ) : (
                            <span className="m-auto">{initials(opportunity.consultantName, opportunity.email)}</span>
                          )}
                        </div>
                      </div>

                      <div className="mt-4 grid grid-cols-2 gap-2">
                        <div className="rounded-2xl bg-clinic-mist px-3 py-3">
                          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">
                            {mode === "admin" ? "Revenue" : "Value"}
                          </p>
                          <p className="mt-1 text-lg font-semibold text-clinic-navy">{formatCurrency(opportunity.orderTotalCents)}</p>
                        </div>
                        <div className="rounded-2xl bg-emerald-50 px-3 py-3">
                          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-emerald-700">
                            {mode === "admin" ? "Margin" : "Earning"}
                          </p>
                          <p className="mt-1 text-lg font-semibold text-emerald-700">{formatCurrency(opportunity.opportunityValueCents)}</p>
                        </div>
                      </div>

                      <div className="mt-4 space-y-1 text-xs text-slate-500">
                        <p className="truncate" title={opportunity.email}>{opportunity.email}</p>
                        <p>{opportunity.phone || "No phone"}</p>
                        <p>{formatDate(opportunity.pipelineUpdatedAt ?? opportunity.createdAt)}</p>
                      </div>

                      <div className="mt-4 grid grid-cols-2 gap-2">
                        <Button type="button" variant="outline" size="sm" onClick={() => setEditing(opportunity)}>
                          <NotebookPen className="size-4" />
                          Notes
                        </Button>
                        {canManageInternalDocs ? (
                          <Button type="button" variant="outline" size="sm" onClick={() => setEditing(opportunity)}>
                            <Pill className="size-4" />
                            RX / GFE
                          </Button>
                        ) : (
                          <Link
                            href={`${basePath}/orders/${opportunity.id}`}
                            className="inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-border px-3 text-sm font-semibold text-clinic-navy transition hover:bg-clinic-mist"
                          >
                            <FileText className="size-4" />
                            Order
                          </Link>
                        )}
                      </div>

                      {canManageStages ? (
                        <form action={updatePipelineOrderStage} className="mt-4 space-y-2 rounded-2xl border border-border bg-clinic-mist p-3">
                          <input type="hidden" name="orderId" value={opportunity.id} />
                          <select
                            name="orderPipelineStage"
                            defaultValue={opportunity.pipelineStage}
                            className="h-10 w-full rounded-xl border border-border bg-white px-3 text-xs font-semibold text-clinic-ink outline-none"
                          >
                            {CUSTOMER_PIPELINE_STAGES.map((option) => (
                              <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                          </select>
                          <div className="grid gap-2">
                            <select name="shippingCarrier" className="h-10 rounded-xl border border-border bg-white px-3 text-xs font-semibold text-clinic-ink outline-none" defaultValue="">
                              <option value="">Carrier if fulfillment/shipped</option>
                              <option value="fedex">FedEx</option>
                              <option value="ups">UPS</option>
                              <option value="usps">USPS</option>
                              <option value="dhl">DHL</option>
                            </select>
                            <input
                              name="shippingTrackingCode"
                              placeholder="Tracking code"
                              className="h-10 rounded-xl border border-border bg-white px-3 text-xs font-semibold text-clinic-ink outline-none"
                            />
                          </div>
                          <label className="flex items-start gap-2 text-xs leading-5 text-slate-600">
                            <input type="checkbox" name="allowFulfillmentWithoutTracking" value="true" className="mt-1" />
                            Move without tracking for now
                          </label>
                          <SubmitButton size="sm" pendingText="Saving..." className="w-full">
                            <PackageCheck className="size-4" />
                            Save step
                          </SubmitButton>
                        </form>
                      ) : null}

                      {opportunity.paymentStatus === "PENDING" ? (
                        <form action={deleteUnpaidOrder} className="mt-3">
                          <input type="hidden" name="orderId" value={opportunity.id} />
                          <SubmitButton variant="outline" size="sm" pendingText="Deleting..." className="w-full border-red-100 text-red-700 hover:bg-red-50">
                            <Trash2 className="size-4" />
                            Delete unpaid order
                          </SubmitButton>
                        </form>
                      ) : null}
                    </article>
                  ))}

                  {stageOpportunities.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-border bg-white p-5 text-center text-xs text-slate-500">
                      No opportunities in this stage.
                    </div>
                  ) : null}
                </div>
              </section>
            );
          })}
        </div>
      </div>

      {editing ? (
        <OpportunityModal
          opportunity={editing}
          canManageInternalDocs={canManageInternalDocs}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </>
  );
}

function OpportunityModal({
  opportunity,
  canManageInternalDocs,
  onClose
}: {
  opportunity: PipelineOpportunity;
  canManageInternalDocs: boolean;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/35 px-4 py-8 backdrop-blur-sm">
      <div className="w-full max-w-2xl overflow-hidden rounded-[2rem] border border-border bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-border p-6">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-clinic-red">Opportunity</p>
            <h3 className="mt-2 text-2xl font-semibold text-clinic-ink">{opportunity.name}</h3>
            <p className="mt-1 text-sm text-slate-500">Add internal notes and attach clinical workflow links for this order.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid size-10 place-items-center rounded-full border border-border text-slate-500 transition hover:bg-clinic-mist"
          >
            ×
          </button>
        </div>

        <form action={updateOrderOpportunityDetails} className="space-y-4 p-6">
          <input type="hidden" name="orderId" value={opportunity.id} />
          <label className="block">
            <span className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Notes</span>
            <textarea
              name="orderNotes"
              defaultValue={opportunity.notes ?? ""}
              placeholder="Call notes, follow-up context, or fulfillment details..."
              className="mt-2 min-h-28 w-full rounded-2xl border border-border bg-white px-4 py-3 text-sm outline-none transition focus:border-clinic-blue focus:ring-4 focus:ring-blue-100"
            />
          </label>

          {canManageInternalDocs ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">RX document URL</span>
                <input
                  name="rxDocumentUrl"
                  defaultValue={opportunity.rxDocumentUrl ?? ""}
                  placeholder="Secure RX link"
                  className="mt-2 h-11 w-full rounded-2xl border border-border bg-white px-4 text-sm outline-none transition focus:border-clinic-blue focus:ring-4 focus:ring-blue-100"
                />
              </label>
              <label className="block">
                <span className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">GFE document URL</span>
                <input
                  name="gfeDocumentUrl"
                  defaultValue={opportunity.gfeDocumentUrl ?? ""}
                  placeholder="Secure GFE link"
                  className="mt-2 h-11 w-full rounded-2xl border border-border bg-white px-4 text-sm outline-none transition focus:border-clinic-blue focus:ring-4 focus:ring-blue-100"
                />
              </label>
            </div>
          ) : null}

          <div className="flex flex-col-reverse gap-3 border-t border-border pt-4 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <SubmitButton pendingText="Saving..." variant="accent">Save opportunity</SubmitButton>
          </div>
        </form>
      </div>
    </div>
  );
}
