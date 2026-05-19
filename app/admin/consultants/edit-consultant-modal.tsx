"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import { Pencil, X } from "lucide-react";
import { updateConsultantCommercials } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";

type LeaderOption = {
  id: string;
  displayName: string;
};

type ConsultantForEdit = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
  phone: string | null;
  groupLeaderProfileId: string | null;
  commissionPercent: number;
};

function Field({
  label,
  children
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="space-y-2">
      <span className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">{label}</span>
      {children}
    </label>
  );
}

export function EditConsultantModal({
  consultant,
  partnerProfileId,
  groupLeaders,
  returnTo
}: {
  consultant: ConsultantForEdit;
  partnerProfileId: string;
  groupLeaders: LeaderOption[];
  returnTo: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={() => setOpen(true)}
        aria-label={`Edit ${consultant.email}`}
      >
        <Pencil className="h-4 w-4" />
      </Button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-end bg-clinic-navy/30 p-0 backdrop-blur-sm sm:items-center sm:p-6">
          <div className="mx-auto max-h-[92vh] w-full max-w-3xl overflow-hidden rounded-t-3xl border border-white/70 bg-white shadow-[0_24px_80px_rgba(7,55,99,0.18)] sm:rounded-3xl">
            <div className="flex items-start justify-between gap-4 border-b border-border px-6 py-5">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Consultant profile</p>
                <h3 className="mt-2 text-2xl font-semibold text-clinic-ink">Edit consultant</h3>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                  Update profile details, leader assignment, and consultant share from one place.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border bg-white text-slate-500 transition hover:bg-clinic-mist hover:text-clinic-ink"
                aria-label="Close edit consultant modal"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form action={updateConsultantCommercials} className="grid max-h-[calc(92vh-120px)] gap-5 overflow-y-auto p-6">
              <input type="hidden" name="consultantProfileId" value={consultant.id} />
              <input type="hidden" name="partnerProfileId" value={partnerProfileId} />
              <input type="hidden" name="returnTo" value={returnTo} />

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="First name">
                  <Input name="firstName" defaultValue={consultant.firstName ?? ""} placeholder="First name" required />
                </Field>
                <Field label="Last name">
                  <Input name="lastName" defaultValue={consultant.lastName ?? ""} placeholder="Last name" required />
                </Field>
                <Field label="Email">
                  <Input name="email" type="email" defaultValue={consultant.email} placeholder="consultant@company.com" required />
                </Field>
                <Field label="Phone">
                  <Input name="phone" type="tel" defaultValue={consultant.phone ?? ""} placeholder="(555) 123-4567" />
                </Field>
                <Field label="Leader assignment">
                  <select
                    name="groupLeaderProfileId"
                    className="h-11 w-full rounded-lg border border-input bg-white px-3 text-sm shadow-line focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    defaultValue={consultant.groupLeaderProfileId ?? ""}
                  >
                    <option value="">Direct partner</option>
                    {groupLeaders.map((leader) => (
                      <option key={leader.id} value={leader.id}>{leader.displayName}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Consultant share">
                  <div className="relative">
                    <Input
                      name="consultantCommissionPercent"
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      defaultValue={consultant.commissionPercent}
                      className="pr-10"
                      required
                    />
                    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-400">%</span>
                  </div>
                </Field>
              </div>

              <div className="flex flex-col-reverse gap-3 border-t border-border pt-5 sm:flex-row sm:justify-end">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <SubmitButton variant="accent" pendingText="Saving consultant...">Save consultant</SubmitButton>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
