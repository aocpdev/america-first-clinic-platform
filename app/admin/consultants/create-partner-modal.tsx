"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import { Plus, X } from "lucide-react";
import { createPartnerByAdmin } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

export function CreatePartnerModal() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="flex flex-col gap-3 rounded-3xl border border-border bg-white p-5 shadow-line sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Partner network</p>
          <h2 className="mt-2 text-2xl font-semibold text-clinic-ink">Partners</h2>
        </div>
        <Button type="button" variant="accent" size="lg" onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" />
          Create partner
        </Button>
      </div>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-end bg-clinic-navy/30 p-0 backdrop-blur-sm sm:items-center sm:p-6">
          <div className="mx-auto max-h-[92vh] w-full max-w-3xl overflow-hidden rounded-t-3xl border border-white/70 bg-white shadow-[0_24px_80px_rgba(7,55,99,0.18)] sm:rounded-3xl">
            <div className="flex items-start justify-between gap-4 border-b border-border px-6 py-5">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Admin only</p>
                <h3 className="mt-2 text-2xl font-semibold text-clinic-ink">Create partner</h3>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                  Add the partner account, company name, and margin pool. The partner can later distribute their pool across leaders and consultants.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border bg-white text-slate-500 transition hover:bg-clinic-mist hover:text-clinic-ink"
                aria-label="Close create partner modal"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form action={createPartnerByAdmin} className="grid max-h-[calc(92vh-120px)] gap-5 overflow-y-auto p-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="First name">
                  <Input name="firstName" placeholder="O’Neal" required />
                </Field>
                <Field label="Last name">
                  <Input name="lastName" placeholder="Acevedo" required />
                </Field>
                <Field label="Email">
                  <Input name="email" type="email" placeholder="partner@company.com" required />
                </Field>
                <Field label="Temporary password">
                  <Input name="password" type="password" minLength={8} placeholder="Minimum 8 characters" required />
                </Field>
                <Field label="Company">
                  <Input name="companyName" placeholder="American First Healthcare" required />
                </Field>
                <Field label="Partner pool">
                  <div className="relative">
                    <Input
                      name="commissionPercent"
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      defaultValue="25"
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
                <SubmitButton variant="accent" pendingText="Creating partner...">Create partner</SubmitButton>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
