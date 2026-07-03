import { BadgeDollarSign, ShieldCheck } from "lucide-react";
import { updateAgencyFeeSettings } from "@/app/settings/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

type AgencyFeeSetting = {
  isEnabled: boolean;
  agencyName: string;
  stripeConnectedAccountId: string | null;
  feeBps: number;
  basis: string;
} | null;

function percentFromBps(bps: number) {
  return (bps / 100).toFixed(2).replace(/\.?0+$/, "");
}

export function AgencyFeeSettings({ setting }: { setting: AgencyFeeSetting }) {
  const enabled = setting?.isEnabled ?? false;
  const feePercent = percentFromBps(setting?.feeBps ?? 800);
  const accountId = setting?.stripeConnectedAccountId ?? "";
  const ready = enabled && accountId.startsWith("acct_");

  return (
    <Card className="overflow-hidden rounded-3xl">
      <div className="border-b border-border bg-white p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <Badge>Admin only</Badge>
            <h2 className="mt-3 text-3xl font-semibold text-clinic-ink">Agency fee</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
              Automatically transfer a private agency fee from captured Stripe payments. This is hidden from customers, agents, leaders, managers, and partners, and does not create a manual payout task.
            </p>
          </div>
          <div className={`rounded-2xl border px-4 py-3 text-sm font-semibold ${ready ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-amber-200 bg-amber-50 text-amber-800"}`}>
            {ready ? "Ready for Stripe transfers" : "Needs connected account"}
          </div>
        </div>
      </div>

      <form action={updateAgencyFeeSettings} className="grid gap-5 p-6 lg:grid-cols-[320px_1fr]">
        <div className="rounded-3xl border border-border bg-clinic-mist p-5">
          <div className="grid size-12 place-items-center rounded-2xl bg-white text-clinic-navy shadow-sm">
            <BadgeDollarSign className="size-5" />
          </div>
          <p className="mt-5 text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Calculation</p>
          <p className="mt-2 text-3xl font-semibold text-clinic-ink">{feePercent}%</p>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            Calculated from 100% of the order gross margin and stored as an order-level snapshot when payment is captured.
          </p>
        </div>

        <div className="space-y-4">
          <label className="flex items-start gap-3 rounded-3xl border border-border bg-white p-5">
            <input name="isEnabled" type="checkbox" defaultChecked={enabled} className="mt-1 size-4" />
            <span>
              <span className="block font-semibold text-clinic-ink">Enable automatic agency fee</span>
              <span className="text-sm leading-6 text-slate-500">When enabled, captured Stripe orders create an internal fee record and a Stripe transfer to the connected agency account automatically.</span>
            </span>
          </label>

          <div className="grid gap-4 md:grid-cols-2">
            <label>
              <span className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Agency name</span>
              <input
                name="agencyName"
                defaultValue={setting?.agencyName ?? "Agency"}
                className="mt-2 h-12 w-full rounded-2xl border border-border bg-white px-4 text-sm font-semibold text-clinic-ink outline-none transition focus:border-clinic-blue/40 focus:ring-4 focus:ring-blue-100"
                placeholder="Agency"
              />
            </label>
            <label>
              <span className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Agency fee percent</span>
              <input
                name="feePercent"
                type="number"
                min="0"
                max="50"
                step="0.01"
                defaultValue={feePercent}
                className="mt-2 h-12 w-full rounded-2xl border border-border bg-white px-4 text-sm font-semibold text-clinic-ink outline-none transition focus:border-clinic-blue/40 focus:ring-4 focus:ring-blue-100"
              />
            </label>
          </div>

          <label>
            <span className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Stripe connected account ID</span>
            <input
              name="stripeConnectedAccountId"
              defaultValue={accountId}
              className="mt-2 h-12 w-full rounded-2xl border border-border bg-white px-4 text-sm font-semibold text-clinic-ink outline-none transition focus:border-clinic-blue/40 focus:ring-4 focus:ring-blue-100"
              placeholder="acct_..."
            />
            <span className="mt-2 block text-xs leading-5 text-slate-500">
              The agency must be a Stripe Connect connected account under Go Virtual Health&apos;s platform account.
            </span>
          </label>

          <input type="hidden" name="basis" value="GROSS_MARGIN" />

          <div className="flex flex-col gap-3 rounded-3xl border border-blue-100 bg-blue-50 p-5 text-sm text-clinic-navy lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 size-5" />
              <p>Reports show this as informational. Refunds reverse the agency transfer amount, while Stripe refund processing cost remains with Go Virtual Health.</p>
            </div>
            <Button type="submit" variant="accent">Save agency fee</Button>
          </div>
        </div>
      </form>
    </Card>
  );
}
