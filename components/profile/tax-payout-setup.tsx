import { BadgeCheck, Building2, FileCheck2, LockKeyhole, ShieldCheck, WalletCards } from "lucide-react";

import { connectPayoutAccount, openPayoutDashboard } from "@/app/profile/actions";
import { SubmitButton } from "@/components/ui/submit-button";

export type PayoutSetupView = {
  status: string;
  connected: boolean;
  detailsSubmitted: boolean;
  transfersEnabled: boolean;
  payoutsEnabled: boolean;
  bankName: string | null;
  bankAccountLast4: string | null;
  requirementsCount: number;
  lastSyncedAt: Date | null;
};

export function TaxPayoutSetup({ setup }: { setup: PayoutSetupView | null }) {
  if (!setup) return null;
  const ready = setup.status === "READY" && setup.transfersEnabled;
  const title = ready ? "Tax and payout setup complete" : setup.connected ? "Finish tax and payout setup" : "Set up tax information and payouts";
  const action = ready ? openPayoutDashboard : connectPayoutAccount;

  return (
    <section id="tax-payout-setup" className="overflow-hidden rounded-[30px] border border-blue-100 bg-white shadow-sm">
      <div className="bg-gradient-to-br from-white via-blue-50/40 to-emerald-50/50 p-6 sm:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex max-w-3xl items-start gap-4">
            <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-clinic-navy text-white shadow-sm">
              {ready ? <BadgeCheck className="h-6 w-6" /> : <FileCheck2 className="h-6 w-6" />}
            </span>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-clinic-red">Go Virtual Health payouts</p>
              <h3 className="mt-2 text-2xl font-semibold tracking-tight text-clinic-ink">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Complete the secure Go Virtual Health setup for taxpayer identity, W-9 information, and the bank account where you want to receive approved payments. No separate Stripe account is required.
              </p>
            </div>
          </div>
          <div className={ready ? "rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-800" : "rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-800"}>
            <p className="text-sm font-semibold">{ready ? "Ready to receive payments" : setup.connected ? "Action required" : "Not started"}</p>
            {!ready && setup.requirementsCount ? <p className="mt-1 text-xs">{setup.requirementsCount} Stripe requirement(s) remain.</p> : null}
          </div>
        </div>
      </div>

      <div className="grid gap-4 border-t border-blue-100 p-5 md:grid-cols-3">
        {[
          { icon: ShieldCheck, label: "Identity & W-9", done: setup.detailsSubmitted, copy: "Entered securely through the Go Virtual Health setup." },
          { icon: Building2, label: "Payment account", done: setup.payoutsEnabled, copy: setup.bankAccountLast4 ? `${setup.bankName || "Bank account"} •••• ${setup.bankAccountLast4}` : "Add the bank destination for your payments." },
          { icon: WalletCards, label: "Direct payouts", done: setup.transfersEnabled, copy: "Approved payments can be sent from the platform." }
        ].map(({ icon: Icon, label, done, copy }) => (
          <div key={label} className="rounded-[22px] border border-border bg-slate-50/70 p-4">
            <div className="flex items-center gap-3">
              <span className={done ? "grid size-9 place-items-center rounded-xl bg-emerald-100 text-emerald-700" : "grid size-9 place-items-center rounded-xl bg-white text-slate-500 shadow-sm"}>
                <Icon className="h-4 w-4" />
              </span>
              <p className="font-semibold text-clinic-ink">{label}</p>
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-500">{copy}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-4 border-t border-border bg-white p-5 sm:flex-row sm:items-center sm:justify-between">
        <p className="flex max-w-2xl items-start gap-2 text-xs leading-5 text-slate-500">
          <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0 text-clinic-navy" />
          Go Virtual Health stores only the secure payment reference and masked bank details. Full SSN, EIN, bank numbers, and certifications are encrypted and safeguarded by our payment processor.
        </p>
        <form action={action}>
          <SubmitButton pendingText="Opening secure setup..." className="min-w-48 rounded-2xl">
            {ready ? "Manage payout account" : setup.connected ? "Continue secure setup" : "Start secure setup"}
          </SubmitButton>
        </form>
      </div>
    </section>
  );
}
