"use client";

import { useState } from "react";
import { Pencil, Plus, X } from "lucide-react";
import { createManager, updateManagerProfile } from "@/app/(auth)/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PhoneInput } from "@/components/ui/phone-input";
import { SubmitButton } from "@/components/ui/submit-button";
import { percentLabel } from "@/lib/network/sales-hierarchy";

export type ManagerOption = {
  id: string;
  displayName: string;
};

type Manager = ManagerOption & {
  userId: string;
  partnerProfileId: string;
  commissionBps: number;
  leaderOverrideBps: number;
  user: {
    firstName: string | null;
    lastName: string | null;
    email: string;
    phone: string | null;
    avatarUrl: string | null;
  };
};

function initialsFromName(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="min-w-0 space-y-2">
      <span className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">{label}</span>
      {children}
    </label>
  );
}

export function CreateManagerModal({
  partnerProfileId,
  canManageCommissions = true
}: {
  partnerProfileId: string;
  canManageCommissions?: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button type="button" variant="accent" size="lg" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" />
        Create manager
      </Button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-end bg-clinic-navy/30 p-0 backdrop-blur-sm sm:items-center sm:p-6">
          <div className="mx-auto max-h-[92vh] w-full max-w-4xl overflow-hidden rounded-t-3xl border border-white/70 bg-white shadow-[0_24px_80px_rgba(7,55,99,0.18)] sm:rounded-3xl">
            <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-5 sm:px-6">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Partner team</p>
                <h3 className="mt-2 text-2xl font-semibold text-clinic-ink">Create manager</h3>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                  Managers sit between partners and leaders. Their direct sales and team overrides are paid from the partner pool.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border bg-white text-slate-500 transition hover:bg-clinic-mist hover:text-clinic-ink"
                aria-label="Close create manager modal"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form action={createManager} className="grid max-h-[calc(92vh-120px)] gap-5 overflow-y-auto px-5 py-6 sm:px-6">
              <input type="hidden" name="partnerProfileId" value={partnerProfileId} />
              <div className="grid gap-4 xl:grid-cols-2">
                <Field label="First name">
                  <Input name="firstName" placeholder="Jesus" required />
                </Field>
                <Field label="Last name">
                  <Input name="lastName" placeholder="Jimenez" required />
                </Field>
                <Field label="Email">
                  <Input name="email" type="email" placeholder="manager@company.com" required />
                </Field>
                <Field label="Phone">
                  <PhoneInput name="phone" />
                </Field>
                <Field label="Temporary password">
                  <Input name="password" type="password" minLength={8} placeholder="Minimum 8 characters" required />
                </Field>
                {canManageCommissions ? (
                  <>
                    <Field label="Direct share of partner pool">
                      <div className="relative">
                        <Input name="commissionPercent" type="number" min="0" max="50" step="0.01" defaultValue="25" className="pr-10" required />
                        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-400">%</span>
                      </div>
                    </Field>
                    <Field label="Team override from partner pool">
                      <div className="relative">
                        <Input name="leaderOverridePercent" type="number" min="0" max="50" step="0.01" defaultValue="0" className="pr-10" required />
                        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-400">%</span>
                      </div>
                    </Field>
                  </>
                ) : null}
              </div>

              <div className="flex flex-col-reverse gap-3 border-t border-border pt-5 sm:flex-row sm:justify-end">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <SubmitButton variant="accent" pendingText="Creating manager...">Create manager</SubmitButton>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}

export function EditManagerModal({ manager, returnTo }: { manager: Manager; returnTo?: string }) {
  const [open, setOpen] = useState(false);
  const nameParts = manager.displayName.split(" ").filter(Boolean);
  const fallbackFirstName = nameParts[0] ?? "";
  const fallbackLastName = nameParts.slice(1).join(" ");

  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Pencil className="h-4 w-4" />
        Edit
      </Button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-end bg-clinic-navy/30 p-0 backdrop-blur-sm sm:items-center sm:p-6">
          <div className="mx-auto max-h-[92vh] w-full max-w-5xl overflow-hidden rounded-t-3xl border border-white/70 bg-white shadow-[0_24px_80px_rgba(7,55,99,0.18)] sm:rounded-3xl">
            <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-5 sm:px-6">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Manager profile</p>
                <h3 className="mt-2 text-2xl font-semibold text-clinic-ink">{manager.displayName}</h3>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                  Edit identity and payout rules. Manager direct sales and team overrides are paid from the partner pool.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border bg-white text-slate-500 transition hover:bg-clinic-mist hover:text-clinic-ink"
                aria-label="Close edit manager modal"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form action={updateManagerProfile} className="grid max-h-[calc(92vh-120px)] gap-5 overflow-y-auto px-5 py-6 sm:px-6">
              <input type="hidden" name="managerProfileId" value={manager.id} />
              {returnTo ? <input type="hidden" name="returnTo" value={returnTo} /> : null}
              <section className="rounded-3xl border border-border bg-clinic-mist/50 p-5">
                <div className="mb-5 flex items-center gap-3">
                  <div
                    className="grid size-14 shrink-0 place-items-center rounded-2xl border border-border bg-white bg-cover bg-center text-base font-bold text-clinic-navy"
                    style={manager.user.avatarUrl ? { backgroundImage: `url(${manager.user.avatarUrl})` } : undefined}
                  >
                    {manager.user.avatarUrl ? null : initialsFromName(manager.displayName)}
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Identity</p>
                    <h4 className="text-xl font-semibold text-clinic-ink">Personal information</h4>
                  </div>
                </div>
                <div className="grid gap-4 xl:grid-cols-2">
                  <Field label="First name">
                    <Input name="firstName" defaultValue={manager.user.firstName ?? fallbackFirstName} required />
                  </Field>
                  <Field label="Last name">
                    <Input name="lastName" defaultValue={manager.user.lastName ?? fallbackLastName} required />
                  </Field>
                  <Field label="Display name">
                    <Input name="displayName" defaultValue={manager.displayName} />
                  </Field>
                  <Field label="Email">
                    <Input name="email" type="email" defaultValue={manager.user.email} required />
                  </Field>
                  <Field label="Phone">
                    <PhoneInput name="phone" defaultValue={manager.user.phone ?? ""} />
                  </Field>
                </div>
              </section>

              <section className="rounded-3xl border border-border bg-white p-5">
                <div className="mb-5">
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Partner pool</p>
                  <h4 className="mt-1 text-xl font-semibold text-clinic-ink">Commission rules</h4>
                </div>
                <div className="grid gap-4 xl:grid-cols-2">
                  <Field label="Direct sale share">
                    <div className="relative">
                      <Input name="commissionPercent" type="number" min="0" max="50" step="0.01" defaultValue={manager.commissionBps / 100} className="pr-10" required />
                      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-400">%</span>
                    </div>
                  </Field>
                  <Field label="Team override">
                    <div className="relative">
                      <Input name="leaderOverridePercent" type="number" min="0" max="50" step="0.01" defaultValue={manager.leaderOverrideBps / 100} className="pr-10" required />
                      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-400">%</span>
                    </div>
                  </Field>
                </div>
              </section>

              <div className="flex flex-col-reverse gap-3 border-t border-border pt-5 sm:flex-row sm:justify-end">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <SubmitButton variant="accent" pendingText="Saving manager...">Save manager</SubmitButton>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}

export function ManagerSection({
  partnerProfileId,
  managers,
  returnTo
}: {
  partnerProfileId: string;
  managers: Manager[];
  returnTo?: string;
}) {
  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-clinic-ink">Managers</h2>
          <p className="mt-1 text-sm text-slate-500">Create manager profiles and control manager direct share plus leader overrides.</p>
        </div>
        <CreateManagerModal partnerProfileId={partnerProfileId} />
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {managers.map((manager) => (
          <div key={manager.id} className="rounded-3xl border border-border bg-white p-5 shadow-line transition hover:-translate-y-0.5 hover:border-clinic-navy/30 hover:shadow-soft">
            <div className="flex items-start justify-between gap-4">
              <div className="flex min-w-0 items-center gap-3">
                <div
                  className="grid size-12 shrink-0 place-items-center rounded-2xl border border-border bg-clinic-mist bg-cover bg-center text-sm font-bold text-clinic-navy"
                  style={manager.user.avatarUrl ? { backgroundImage: `url(${manager.user.avatarUrl})` } : undefined}
                >
                  {manager.user.avatarUrl ? null : initialsFromName(manager.displayName)}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-lg font-semibold text-clinic-ink">{manager.displayName}</p>
                  <p className="mt-1 truncate text-sm text-slate-500">{manager.user.email}</p>
                </div>
              </div>
              <Badge className="border-blue-100 bg-blue-50 text-clinic-navy">{percentLabel(manager.commissionBps)}</Badge>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-2 text-center text-xs font-semibold text-slate-500">
              <div className="rounded-2xl bg-clinic-mist px-2 py-3">
                <p className="text-2xl text-clinic-navy">{percentLabel(manager.commissionBps)}</p>
                <p className="mt-1">Direct share</p>
              </div>
              <div className="rounded-2xl bg-blue-50 px-2 py-3">
                <p className="text-2xl text-clinic-navy">{percentLabel(manager.leaderOverrideBps)}</p>
                <p className="mt-1">Team override</p>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4">
              <a
                href={`/admin/consultants?partnerId=${partnerProfileId}&section=hierarchy&managerId=${manager.id}`}
                className="inline-flex h-9 items-center rounded-xl border border-border bg-white px-3 text-sm font-semibold text-clinic-ink transition hover:bg-clinic-mist"
              >
                View hierarchy
              </a>
              <EditManagerModal manager={manager} returnTo={returnTo} />
            </div>
          </div>
        ))}
        {managers.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-border bg-white p-6 md:col-span-2 xl:col-span-3">
            <h3 className="text-lg font-semibold text-clinic-ink">No managers yet</h3>
            <p className="mt-2 text-sm text-slate-500">Create managers when this partner needs a layer between leaders and the partner.</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
