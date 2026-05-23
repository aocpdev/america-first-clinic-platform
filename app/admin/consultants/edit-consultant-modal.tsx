"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import { ArrowUpRight, Pencil, X } from "lucide-react";
import { promoteConsultantToLeader, updateConsultantCommercials } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PhoneInput } from "@/components/ui/phone-input";
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
          <div className="mx-auto max-h-[92vh] w-full max-w-4xl overflow-hidden rounded-t-3xl border border-white/70 bg-white shadow-[0_24px_80px_rgba(7,55,99,0.18)] sm:rounded-3xl">
            <div className="flex items-start justify-between gap-4 border-b border-border px-6 py-5">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Consultant profile</p>
                <h3 className="mt-2 text-2xl font-semibold text-clinic-ink">
                  {[consultant.firstName, consultant.lastName].filter(Boolean).join(" ") || "Edit consultant"}
                </h3>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                  Update seller identity, contact details, and the share they receive from the partner pool. Use Assign to move sellers between leaders.
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

            <div className="max-h-[calc(92vh-120px)] overflow-y-auto p-6">
              <form action={updateConsultantCommercials} className="grid gap-5">
                <input type="hidden" name="consultantProfileId" value={consultant.id} />
                <input type="hidden" name="partnerProfileId" value={partnerProfileId} />
                <input type="hidden" name="groupLeaderProfileId" value={consultant.groupLeaderProfileId ?? ""} />
                <input type="hidden" name="returnTo" value={returnTo} />

                <section className="rounded-3xl border border-border bg-clinic-mist/50 p-5">
                  <div className="mb-5">
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Identity</p>
                    <h4 className="mt-1 text-xl font-semibold text-clinic-ink">Personal information</h4>
                  </div>
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
                      <PhoneInput name="phone" defaultValue={consultant.phone ?? ""} />
                    </Field>
                  </div>
                </section>

                <section className="rounded-3xl border border-border bg-white p-5">
                  <div className="mb-5">
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Partner pool</p>
                    <h4 className="mt-1 text-xl font-semibold text-clinic-ink">Commercial setup</h4>
                    <p className="mt-1 text-sm leading-6 text-slate-600">
                      This is the seller share from the partner pool. Leaders and consultants never see the full company margin split.
                    </p>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
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
                      <p className="text-xs leading-5 text-slate-500">Paid from the partner pool after the order reaches the payable stage.</p>
                    </Field>
                  </div>
                </section>

                <div className="flex flex-col-reverse gap-3 border-t border-border pt-5 sm:flex-row sm:justify-end">
                  <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                    Cancel
                  </Button>
                  <SubmitButton variant="accent" pendingText="Saving consultant...">Save consultant</SubmitButton>
                </div>
              </form>

              <form action={promoteConsultantToLeader} className="mt-5 rounded-3xl border border-border bg-clinic-mist/60 p-5">
                <input type="hidden" name="consultantProfileId" value={consultant.id} />
                <input type="hidden" name="returnTo" value={returnTo} />
                <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Role conversion</p>
                    <h4 className="mt-1 text-lg font-semibold text-clinic-ink">Promote consultant to group leader</h4>
                    <p className="mt-1 text-sm leading-6 text-slate-600">
                      Keeps historical sales intact and creates an active leader profile. Leader percentages are always paid from the partner pool.
                    </p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-[150px_150px_auto]">
                    <Input name="leaderCommissionPercent" type="number" min="0" max="100" step="0.01" defaultValue="25" aria-label="Leader direct share of partner pool percent" />
                    <Input name="consultantOverridePercent" type="number" min="0" max="100" step="0.01" defaultValue="0" aria-label="Leader consultant override from partner pool percent" />
                    <SubmitButton variant="outline" pendingText="Promoting...">
                      <ArrowUpRight className="h-4 w-4" />
                      Promote
                    </SubmitButton>
                  </div>
                </div>
              </form>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
