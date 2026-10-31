import Link from "next/link";
import { Card } from "@/components/ui/card";
import { prisma } from "@/lib/db/prisma";
import { requireAffiliateSession } from "@/lib/referrals/affiliate-session";

export default async function AffiliateOverviewPage() {
  const affiliate = await requireAffiliateSession();
  const settings = await prisma.affiliateProgramSetting.findUnique({ where: { companyId: affiliate.companyId } });
  return <div className="space-y-7">
    <div><p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Your affiliate workspace</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight text-clinic-navy">Welcome, {affiliate.displayName}</h1>
      <p className="mt-3 text-sm leading-6 text-slate-500">Your independent referral partnership with Go Virtual Health.</p></div>
    <div className="grid gap-5 sm:grid-cols-2">
      <Card className="rounded-2xl p-6"><p className="text-sm text-slate-500">Your commission rate</p>
        <p className="mt-3 text-4xl font-semibold text-clinic-navy">{(affiliate.commissionBps ?? settings?.commissionBps ?? 2500) / 100}%</p>
        <p className="mt-3 text-sm leading-6 text-slate-500">Of commissionable margin, using existing discount rules. Applicable terms will be saved with each future purchase.</p></Card>
      <Card className="rounded-2xl p-6"><h2 className="font-semibold">Explore the catalog</h2>
        <p className="mt-3 text-sm leading-6 text-slate-500">Review current products and your estimated earnings. Product and store links are available in the catalog when enabled; online purchasing remains closed.</p>
        <Link className="mt-5 inline-flex min-h-11 items-center rounded-lg bg-clinic-navy px-5 text-sm font-semibold text-white" href="/affiliates/products">View products</Link></Card>
    </div>
    <Card className="rounded-2xl p-6"><div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center"><div><h2 className="font-semibold text-clinic-navy">Prepare to receive payments</h2><p className="mt-2 text-sm leading-6 text-slate-500">Review your payment setup before approved earnings can be sent to your bank.</p></div><Link href="/affiliates/payouts" className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-lg border px-5 text-sm font-semibold text-clinic-navy">Review payment setup</Link></div></Card>
    <Card className="rounded-2xl border-blue-100 bg-blue-50 p-5"><h2 className="text-sm font-semibold text-clinic-navy">Launch preparation</h2>
      <p className="mt-2 text-sm leading-6 text-slate-600">Referral purchase tracking, earnings and payouts are not activated yet. No estimated commissions are displayed as earned funds.</p></Card>
  </div>;
}
