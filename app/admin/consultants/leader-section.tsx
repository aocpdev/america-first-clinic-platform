"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowDownRight, Pencil, Plus, X } from "lucide-react";
import { convertLeaderToConsultant, createGroupLeader, updateGroupLeaderProfile } from "@/app/(auth)/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PhoneInput } from "@/components/ui/phone-input";
import { SubmitButton } from "@/components/ui/submit-button";
import { percentLabel } from "@/lib/network/sales-hierarchy";

type Leader = {
  id: string;
  userId: string;
  partnerProfileId: string;
  displayName: string;
  commissionBps: number;
  consultantOverrideBps: number;
  user: {
    email: string;
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

function Field({
  label,
  children
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="space-y-2">
      <span className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">{label}</span>
      {children}
    </label>
  );
}

export function CreateLeaderModal({ partnerProfileId }: { partnerProfileId: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button type="button" variant="accent" size="lg" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" />
        Create leader
      </Button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-end bg-clinic-navy/30 p-0 backdrop-blur-sm sm:items-center sm:p-6">
          <div className="mx-auto max-h-[92vh] w-full max-w-3xl overflow-hidden rounded-t-3xl border border-white/70 bg-white shadow-[0_24px_80px_rgba(7,55,99,0.18)] sm:rounded-3xl">
            <div className="flex items-start justify-between gap-4 border-b border-border px-6 py-5">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Partner team</p>
                <h3 className="mt-2 text-2xl font-semibold text-clinic-ink">Create group leader</h3>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                  Add a leader under this partner and define their share of the partner margin pool for direct sales and consultant overrides.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border bg-white text-slate-500 transition hover:bg-clinic-mist hover:text-clinic-ink"
                aria-label="Close create leader modal"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form action={createGroupLeader} className="grid max-h-[calc(92vh-120px)] gap-5 overflow-y-auto p-6">
              <input type="hidden" name="partnerProfileId" value={partnerProfileId} />
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="First name">
                  <Input name="firstName" placeholder="John" required />
                </Field>
                <Field label="Last name">
                  <Input name="lastName" placeholder="Doe" required />
                </Field>
                <Field label="Email">
                  <Input name="email" type="email" placeholder="leader@company.com" required />
                </Field>
                <Field label="Phone">
                  <PhoneInput name="phone" />
                </Field>
                <Field label="Temporary password">
                  <Input name="password" type="password" minLength={8} placeholder="Minimum 8 characters" required />
                </Field>
                <Field label="Direct share of partner pool">
                  <div className="relative">
                    <Input name="commissionPercent" type="number" min="0" max="100" step="0.01" defaultValue="25" className="pr-10" required />
                    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-400">%</span>
                  </div>
                  <p className="text-xs leading-5 text-slate-500">Used when this leader creates the sale. It is never calculated from full margin.</p>
                </Field>
                <Field label="Consultant override from partner pool">
                  <div className="relative">
                    <Input name="consultantOverridePercent" type="number" min="0" max="100" step="0.01" defaultValue="0" className="pr-10" required />
                    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-400">%</span>
                  </div>
                  <p className="text-xs leading-5 text-slate-500">Used only for consultants under this leader and deducted inside the partner pool.</p>
                </Field>
              </div>

              <div className="flex flex-col-reverse gap-3 border-t border-border pt-5 sm:flex-row sm:justify-end">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <SubmitButton variant="accent" pendingText="Creating leader...">Create leader</SubmitButton>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}

export function EditLeaderModal({ leader, returnTo }: { leader: Leader; returnTo?: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Pencil className="h-4 w-4" />
        Edit
      </Button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-end bg-clinic-navy/30 p-0 backdrop-blur-sm sm:items-center sm:p-6">
          <div className="mx-auto max-h-[92vh] w-full max-w-2xl overflow-hidden rounded-t-3xl border border-white/70 bg-white shadow-[0_24px_80px_rgba(7,55,99,0.18)] sm:rounded-3xl">
            <div className="flex items-start justify-between gap-4 border-b border-border px-6 py-5">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Leader profile</p>
                <h3 className="mt-2 text-2xl font-semibold text-clinic-ink">{leader.displayName}</h3>
                <p className="mt-2 text-sm text-slate-600">{leader.user.email}</p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border bg-white text-slate-500 transition hover:bg-clinic-mist hover:text-clinic-ink"
                aria-label="Close edit leader modal"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form action={updateGroupLeaderProfile} className="grid gap-5 p-6">
              <input type="hidden" name="groupLeaderProfileId" value={leader.id} />
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Direct share of partner pool">
                  <div className="relative">
                    <Input name="commissionPercent" type="number" min="0" max="100" step="0.01" defaultValue={leader.commissionBps / 100} className="pr-10" required />
                    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-400">%</span>
                  </div>
                </Field>
                <Field label="Consultant override from partner pool">
                  <div className="relative">
                    <Input name="consultantOverridePercent" type="number" min="0" max="100" step="0.01" defaultValue={leader.consultantOverrideBps / 100} className="pr-10" required />
                    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-400">%</span>
                  </div>
                </Field>
              </div>

              <div className="flex flex-col-reverse gap-3 border-t border-border pt-5 sm:flex-row sm:justify-end">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <SubmitButton variant="accent" pendingText="Saving leader...">Save leader</SubmitButton>
              </div>
            </form>

            <form action={convertLeaderToConsultant} className="border-t border-border bg-clinic-mist/50 px-6 py-5">
              <input type="hidden" name="groupLeaderProfileId" value={leader.id} />
              {returnTo ? <input type="hidden" name="returnTo" value={returnTo} /> : null}
              <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Role conversion</p>
                  <h4 className="mt-1 text-lg font-semibold text-clinic-ink">Convert leader to consultant</h4>
                  <p className="mt-1 text-sm leading-6 text-slate-600">
                    The leader becomes an active seller. Current sellers under this leader move directly under the partner.
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-[150px_auto]">
                  <Input name="consultantCommissionPercent" type="number" min="0" max="100" step="0.01" defaultValue="50" aria-label="Consultant share percent" />
                  <SubmitButton variant="outline" pendingText="Converting...">
                    <ArrowDownRight className="h-4 w-4" />
                    Convert
                  </SubmitButton>
                </div>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}

export function LeaderSection({
  partnerProfileId,
  leaders,
  returnTo
}: {
  partnerProfileId: string;
  leaders: Leader[];
  returnTo?: string;
}) {
  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-clinic-ink">Group leaders</h2>
          <p className="mt-1 text-sm text-slate-500">Manage leader profiles and how the partner margin pool is distributed.</p>
        </div>
        <CreateLeaderModal partnerProfileId={partnerProfileId} />
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {leaders.map((leader) => (
          <div
            key={leader.id}
            className="group rounded-3xl border border-border bg-white p-5 shadow-line transition hover:-translate-y-0.5 hover:border-clinic-navy/30 hover:shadow-soft"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex min-w-0 items-center gap-3">
                <div
                  className="grid size-12 shrink-0 place-items-center rounded-2xl border border-border bg-clinic-mist bg-cover bg-center text-sm font-bold text-clinic-navy"
                  style={leader.user.avatarUrl ? { backgroundImage: `url(${leader.user.avatarUrl})` } : undefined}
                  aria-label={`${leader.displayName} avatar`}
                >
                  {leader.user.avatarUrl ? null : initialsFromName(leader.displayName)}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-lg font-semibold text-clinic-ink">{leader.displayName}</p>
                  <p className="mt-1 truncate text-sm text-slate-500">{leader.user.email}</p>
                </div>
              </div>
              <Badge className="border-blue-100 bg-blue-50 text-clinic-navy">{percentLabel(leader.commissionBps)}</Badge>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-2 text-center text-xs font-semibold text-slate-500">
              <div className="rounded-2xl bg-clinic-mist px-2 py-3">
                <p className="text-2xl text-clinic-navy">{percentLabel(leader.commissionBps)}</p>
                <p className="mt-1">Direct pool</p>
              </div>
              <div className="rounded-2xl bg-blue-50 px-2 py-3">
                <p className="text-2xl text-clinic-navy">{percentLabel(leader.consultantOverrideBps)}</p>
                <p className="mt-1">Override pool</p>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4">
              <Link
                href={`/admin/consultants?partnerId=${partnerProfileId}&section=hierarchy&leaderId=${leader.id}`}
                className="inline-flex h-9 items-center rounded-xl border border-border bg-white px-3 text-sm font-semibold text-clinic-ink transition hover:bg-clinic-mist"
              >
                View hierarchy
              </Link>
              <EditLeaderModal leader={leader} returnTo={returnTo} />
            </div>
          </div>
        ))}
        {leaders.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-border bg-white p-6 md:col-span-2 xl:col-span-3">
            <h3 className="text-lg font-semibold text-clinic-ink">No group leaders yet</h3>
            <p className="mt-2 text-sm text-slate-500">Create the first leader when this partner is ready to organize consultants by group.</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
