"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import { ArrowUpRight, Pencil, Trash2, X } from "lucide-react";
import { deleteConsultantProfile, promoteConsultantToLeader, updateConsultantCommercials } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ModalPortal } from "@/components/ui/modal-portal";
import { PhoneInput } from "@/components/ui/phone-input";
import { SubmitButton } from "@/components/ui/submit-button";

type LeaderOption = {
  id: string;
  displayName: string;
  managerProfileId?: string | null;
};

type ManagerOption = {
  id: string;
  displayName: string;
};

type ConsultantForEdit = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
  phone: string | null;
  managerProfileId: string | null;
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
    <label className="min-w-0 space-y-2">
      <span className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">{label}</span>
      {children}
    </label>
  );
}

export function EditConsultantModal({
  consultant,
  partnerProfileId,
  managers,
  groupLeaders,
  returnTo,
  canManageAgentCommission = false
}: {
  consultant: ConsultantForEdit;
  partnerProfileId: string;
  managers: ManagerOption[];
  groupLeaders: LeaderOption[];
  returnTo: string;
  canManageAgentCommission?: boolean;
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
        <ModalPortal>
          <div className="fixed inset-0 z-[100] grid place-items-center overflow-y-auto bg-clinic-navy/30 p-4 backdrop-blur-sm sm:p-6">
            <div className="my-auto max-h-[92vh] w-full max-w-3xl overflow-hidden rounded-3xl border border-white/70 bg-white shadow-[0_24px_80px_rgba(7,55,99,0.18)]">
            <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-5 sm:px-6">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Agent profile</p>
                <h3 className="mt-2 text-2xl font-semibold text-clinic-ink">
                  {[consultant.firstName, consultant.lastName].filter(Boolean).join(" ") || "Edit agent"}
                </h3>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                  Update agent identity, contact details, and the share they receive from the partner pool. Use Assign to move agents between leaders.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border bg-white text-slate-500 transition hover:bg-clinic-mist hover:text-clinic-ink"
                aria-label="Close edit agent modal"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="max-h-[calc(92vh-120px)] overflow-y-auto px-5 py-6 sm:px-6">
              <form action={updateConsultantCommercials} className="grid gap-5">
                <input type="hidden" name="consultantProfileId" value={consultant.id} />
                <input type="hidden" name="partnerProfileId" value={partnerProfileId} />
                {!canManageAgentCommission ? <input type="hidden" name="managerProfileId" value={consultant.managerProfileId ?? ""} /> : null}
                {!canManageAgentCommission ? <input type="hidden" name="groupLeaderProfileId" value={consultant.groupLeaderProfileId ?? ""} /> : null}
                <input type="hidden" name="returnTo" value={returnTo} />

                <section className="rounded-3xl border border-border bg-clinic-mist/50 p-5">
                  <div className="mb-5">
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Identity</p>
                    <h4 className="mt-1 text-xl font-semibold text-clinic-ink">Personal information</h4>
                  </div>
                  <div className="grid grid-cols-[repeat(auto-fit,minmax(16rem,1fr))] gap-4">
                    <Field label="First name">
                      <Input name="firstName" defaultValue={consultant.firstName ?? ""} placeholder="First name" required />
                    </Field>
                    <Field label="Last name">
                      <Input name="lastName" defaultValue={consultant.lastName ?? ""} placeholder="Last name" required />
                    </Field>
                    <Field label="Email">
                      <Input name="email" type="email" defaultValue={consultant.email} placeholder="agent@company.com" required />
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
                      This is the agent share from the partner pool. Leaders and agents never see the full company margin split.
                    </p>
                  </div>
                  {canManageAgentCommission ? (
                    <div className="grid grid-cols-[repeat(auto-fit,minmax(16rem,1fr))] gap-4">
                      <Field label="Manager">
                        <select
                          name="managerProfileId"
                          defaultValue={consultant.managerProfileId ?? ""}
                          className="h-12 w-full min-w-0 rounded-xl border border-input bg-white px-4 text-sm font-semibold text-clinic-ink outline-none transition focus:border-clinic-navy focus:ring-4 focus:ring-clinic-navy/10"
                        >
                          <option value="">Direct partner</option>
                          {managers.map((manager) => (
                            <option key={manager.id} value={manager.id}>{manager.displayName}</option>
                          ))}
                        </select>
                        <p className="text-xs leading-5 text-slate-500">Use this for direct manager placement. Leader placement overrides this automatically.</p>
                      </Field>
                      <Field label="Placement">
                        <select
                          name="groupLeaderProfileId"
                          defaultValue={consultant.groupLeaderProfileId ?? ""}
                          className="h-12 w-full min-w-0 rounded-xl border border-input bg-white px-4 text-sm font-semibold text-clinic-ink outline-none transition focus:border-clinic-navy focus:ring-4 focus:ring-clinic-navy/10"
                        >
                          <option value="">Direct partner</option>
                          {groupLeaders.map((leader) => (
                            <option key={leader.id} value={leader.id}>
                              {leader.displayName}{leader.managerProfileId ? " · Manager assigned" : ""}
                            </option>
                          ))}
                        </select>
                        <p className="text-xs leading-5 text-slate-500">Move this agent under a group leader or keep them directly under the partner.</p>
                      </Field>
                      <Field label="Agent share">
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
                  ) : (
                    <div className="rounded-2xl border border-border bg-clinic-mist p-4 text-sm leading-6 text-slate-600">
                      Agent commission is controlled by the partner. Admins can edit identity and placement only.
                    </div>
                  )}
                </section>

                <div className="flex flex-col gap-3 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between">
                  <button
                    type="submit"
                    formAction={deleteConsultantProfile}
                    onClick={(event) => {
                      if (!window.confirm("Delete this agent? Their historical customers and orders will stay in the partner hierarchy without an assigned agent.")) {
                        event.preventDefault();
                      }
                    }}
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-red-100 bg-red-50 px-4 text-sm font-bold text-red-700 transition hover:bg-red-100"
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete consultant
                  </button>
                  <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                    <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                      Cancel
                    </Button>
                    <SubmitButton variant="accent" pendingText="Saving agent...">Save agent</SubmitButton>
                  </div>
                </div>
              </form>

              <form action={promoteConsultantToLeader} className="mt-5 rounded-3xl border border-border bg-clinic-mist/60 p-5">
                <input type="hidden" name="consultantProfileId" value={consultant.id} />
                <input type="hidden" name="returnTo" value={returnTo} />
                <div className="grid gap-4 xl:grid-cols-[1fr_auto] xl:items-end">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Role conversion</p>
                    <h4 className="mt-1 text-lg font-semibold text-clinic-ink">Promote agent to group leader</h4>
                    <p className="mt-1 text-sm leading-6 text-slate-600">
                      Keeps historical sales intact and creates an active leader profile. Direct leader sales and team overrides are paid from the partner pool.
                    </p>
                  </div>
                  <div className={canManageAgentCommission ? "grid gap-3 sm:grid-cols-[150px_150px_auto]" : "flex justify-end"}>
                    {canManageAgentCommission ? (
                      <>
                        <Input name="leaderCommissionPercent" type="number" min="0" max="50" step="0.01" defaultValue="50" aria-label="Leader direct share of partner pool percent" />
                        <Input name="consultantOverridePercent" type="number" min="0" max="50" step="0.01" defaultValue="0" aria-label="Leader team override from partner pool percent" />
                      </>
                    ) : null}
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
        </ModalPortal>
      ) : null}
    </>
  );
}
