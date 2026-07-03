"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import { Plus, X } from "lucide-react";
import { createConsultantByAdmin } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PhoneInput } from "@/components/ui/phone-input";
import { SubmitButton } from "@/components/ui/submit-button";

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

export function CreateConsultantModal({
  partnerProfileId,
  managerProfileId,
  managerName,
  managers = [],
  groupLeaderProfileId,
  groupLeaderName,
  groupLeaders = [],
  returnTo,
  buttonLabel = "Create agent",
  canManageAgentCommission = false
}: {
  partnerProfileId: string;
  managerProfileId?: string | null;
  managerName?: string | null;
  managers?: Array<{
    id: string;
    displayName: string;
  }>;
  groupLeaderProfileId?: string | null;
  groupLeaderName?: string | null;
  groupLeaders?: Array<{
    id: string;
    displayName: string;
    managerProfileId?: string | null;
    managerName?: string | null;
  }>;
  returnTo?: string;
  buttonLabel?: string;
  canManageAgentCommission?: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button type="button" variant="accent" size="lg" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" />
        {buttonLabel}
      </Button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-end bg-clinic-navy/30 p-0 backdrop-blur-sm sm:items-center sm:p-6">
          <div className="mx-auto max-h-[92vh] w-full max-w-3xl overflow-hidden rounded-t-3xl border border-white/70 bg-white shadow-[0_24px_80px_rgba(7,55,99,0.18)] sm:rounded-3xl">
            <div className="flex items-start justify-between gap-4 border-b border-border px-6 py-5">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Agent network</p>
                <h3 className="mt-2 text-2xl font-semibold text-clinic-ink">Create agent</h3>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                  {groupLeaderName
                    ? `This agent will be assigned under ${groupLeaderName}.`
                    : "Create an agent and assign them directly to the partner or under a group leader."}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border bg-white text-slate-500 transition hover:bg-clinic-mist hover:text-clinic-ink"
                aria-label="Close add agent modal"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form action={createConsultantByAdmin} className="grid max-h-[calc(92vh-120px)] gap-5 overflow-y-auto p-6">
              <input type="hidden" name="partnerProfileId" value={partnerProfileId} />
              {managerProfileId !== undefined ? <input type="hidden" name="managerProfileId" value={managerProfileId ?? ""} /> : null}
              {groupLeaderProfileId !== undefined ? <input type="hidden" name="groupLeaderProfileId" value={groupLeaderProfileId ?? ""} /> : null}
              {returnTo ? <input type="hidden" name="returnTo" value={returnTo} /> : null}
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="First name">
                  <Input name="firstName" placeholder="Avery" required />
                </Field>
                <Field label="Last name">
                  <Input name="lastName" placeholder="Johnson" required />
                </Field>
                <Field label="Email">
                  <Input name="email" type="email" placeholder="agent@company.com" required />
                </Field>
                <Field label="Phone">
                  <PhoneInput name="phone" />
                </Field>
                <Field label="Temporary password">
                  <Input name="password" type="password" minLength={8} placeholder="Minimum 8 characters" required />
                </Field>
                {groupLeaderProfileId === undefined ? (
                  <>
                  {managerProfileId === undefined ? (
                    <Field label="Manager">
                      <select
                        name="managerProfileId"
                        className="h-11 w-full rounded-lg border border-input bg-white px-3 text-sm shadow-line focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        defaultValue=""
                      >
                        <option value="">Direct partner</option>
                        {managers.map((manager) => (
                          <option key={manager.id} value={manager.id}>{manager.displayName}</option>
                        ))}
                      </select>
                    </Field>
                  ) : (
                    <div className="rounded-2xl border border-border bg-clinic-mist p-4 text-sm font-semibold text-clinic-ink">
                      Manager: {managerName ?? "Selected manager"}
                    </div>
                  )}
                  <Field label="Group leader">
                    <select
                      name="groupLeaderProfileId"
                      className="h-11 w-full rounded-lg border border-input bg-white px-3 text-sm shadow-line focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      defaultValue=""
                    >
                      <option value="">Direct partner</option>
                      {groupLeaders.map((leader) => (
                        <option key={leader.id} value={leader.id}>
                          {leader.displayName}{leader.managerName ? ` · ${leader.managerName}` : ""}
                        </option>
                      ))}
                    </select>
                  </Field>
                  </>
                ) : null}
                {canManageAgentCommission ? (
                  <Field label="Agent share">
                    <div className="relative">
                      <Input name="consultantCommissionPercent" type="number" min="0" max="100" step="0.01" defaultValue="50" className="pr-10" required />
                      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-400">%</span>
                    </div>
                    <p className="text-xs leading-5 text-slate-500">Paid from the partner pool. Partners control this percentage.</p>
                  </Field>
                ) : (
                  <div className="rounded-2xl border border-border bg-clinic-mist p-4 text-sm leading-6 text-slate-600">
                    Agent commission is controlled by the partner from their workspace.
                  </div>
                )}
              </div>

              <div className="flex flex-col-reverse gap-3 border-t border-border pt-5 sm:flex-row sm:justify-end">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <SubmitButton variant="accent" pendingText="Creating agent...">Create agent</SubmitButton>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
