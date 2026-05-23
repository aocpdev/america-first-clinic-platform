"use client";

import { useState } from "react";
import { ArrowRightLeft, ShieldCheck, UserRoundCheck, X } from "lucide-react";
import { assignConsultantToLeader } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";

type LeaderOption = {
  id: string;
  displayName: string;
};

type ConsultantForAssignment = {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string | null;
  groupLeaderProfileId: string | null;
};

function initialsFromName(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function AssignConsultantModal({
  consultant,
  partnerProfileId,
  groupLeaders,
  returnTo
}: {
  consultant: ConsultantForAssignment;
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
        size="sm"
        onClick={() => setOpen(true)}
        aria-label={`Assign ${consultant.name}`}
      >
        <ArrowRightLeft className="h-4 w-4" />
        Assign
      </Button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-end bg-clinic-navy/30 p-0 backdrop-blur-sm sm:items-center sm:p-6">
          <div className="mx-auto max-h-[92vh] w-full max-w-2xl overflow-hidden rounded-t-3xl border border-white/70 bg-white shadow-[0_24px_80px_rgba(7,55,99,0.18)] sm:rounded-3xl">
            <div className="flex items-start justify-between gap-4 border-b border-border px-6 py-5">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Seller assignment</p>
                <h3 className="mt-2 text-2xl font-semibold text-clinic-ink">Assign seller</h3>
                <p className="mt-2 max-w-xl text-sm leading-6 text-slate-600">
                  Move this seller directly under the partner or assign them to a group leader. Customer ownership follows the seller automatically.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border bg-white text-slate-500 transition hover:bg-clinic-mist hover:text-clinic-ink"
                aria-label="Close assignment modal"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form action={assignConsultantToLeader} className="grid max-h-[calc(92vh-120px)] gap-5 overflow-y-auto p-6">
              <input type="hidden" name="consultantProfileId" value={consultant.id} />
              <input type="hidden" name="partnerProfileId" value={partnerProfileId} />
              <input type="hidden" name="returnTo" value={returnTo} />

              <div className="rounded-3xl border border-border bg-clinic-mist/70 p-4">
                <div className="flex items-center gap-3">
                  <div
                    className="grid size-14 shrink-0 place-items-center rounded-2xl border border-border bg-white bg-cover bg-center text-base font-bold text-clinic-navy"
                    style={consultant.avatarUrl ? { backgroundImage: `url(${consultant.avatarUrl})` } : undefined}
                    aria-label={`${consultant.name} avatar`}
                  >
                    {consultant.avatarUrl ? null : initialsFromName(consultant.name)}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-lg font-semibold text-clinic-ink">{consultant.name}</p>
                    <p className="mt-1 truncate text-sm text-slate-500">{consultant.email}</p>
                  </div>
                </div>
              </div>

              <label className="space-y-2">
                <span className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Assignment</span>
                <select
                  name="groupLeaderProfileId"
                  className="h-12 w-full rounded-2xl border border-input bg-white px-4 text-base font-semibold text-clinic-ink shadow-line outline-none transition focus:border-clinic-navy focus:ring-4 focus:ring-clinic-navy/10"
                  defaultValue={consultant.groupLeaderProfileId ?? ""}
                >
                  <option value="">Direct partner</option>
                  {groupLeaders.map((leader) => (
                    <option key={leader.id} value={leader.id}>{leader.displayName}</option>
                  ))}
                </select>
              </label>

              <div className="grid gap-3 rounded-3xl border border-blue-100 bg-blue-50 p-4 text-sm leading-6 text-clinic-navy sm:grid-cols-[auto_1fr]">
                <ShieldCheck className="mt-0.5 h-5 w-5" />
                <div>
                  <p className="font-semibold text-clinic-ink">Role protected assignment</p>
                  <p className="mt-1 text-slate-600">
                    Admins and partners can move sellers inside the partner network. Group leaders can view their own team, but cannot move sellers.
                  </p>
                </div>
              </div>

              <div className="rounded-3xl border border-amber-100 bg-amber-50/80 p-4">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-amber-800">Pending commission handling</p>
                <p className="mt-2 text-sm leading-6 text-slate-700">
                  If this seller has pending leader commissions, choose whether those pending leader earnings stay with the original leader or move to the newly selected leader.
                </p>
                <div className="mt-4 grid gap-3">
                  <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-white bg-white p-4 shadow-line">
                    <input type="radio" name="pendingLeaderCommissionMode" value="keep" defaultChecked className="mt-1 h-4 w-4 accent-clinic-navy" />
                    <span>
                      <span className="block font-semibold text-clinic-ink">Keep existing pending commissions</span>
                      <span className="mt-1 block text-sm text-slate-500">Recommended for historical accuracy. Future sales follow the new assignment.</span>
                    </span>
                  </label>
                  <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-white bg-white p-4 shadow-line">
                    <input type="radio" name="pendingLeaderCommissionMode" value="move" className="mt-1 h-4 w-4 accent-clinic-navy" />
                    <span>
                      <span className="block font-semibold text-clinic-ink">Move pending leader commissions to the selected leader</span>
                      <span className="mt-1 block text-sm text-slate-500">Only applies when assigning the seller to a leader and only affects pending leader splits.</span>
                    </span>
                  </label>
                </div>
              </div>

              <div className="flex flex-col-reverse gap-3 border-t border-border pt-5 sm:flex-row sm:justify-end">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <SubmitButton variant="accent" pendingText="Saving assignment...">
                  <UserRoundCheck className="h-4 w-4" />
                  Save assignment
                </SubmitButton>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
