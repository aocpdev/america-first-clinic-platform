import { Card } from "@/components/ui/card";
import { requireAffiliateSession } from "@/lib/referrals/affiliate-session";
import Link from "next/link";

export default async function AffiliateAccountPage() {
  const affiliate = await requireAffiliateSession();
  return <div className="max-w-2xl space-y-6"><h1 className="text-3xl font-semibold tracking-tight text-clinic-navy">Your account</h1>
    <Card className="rounded-2xl p-6"><dl className="space-y-5">
      <div><dt className="text-xs text-slate-500">Name</dt><dd className="mt-1 font-medium">{affiliate.displayName}</dd></div>
      <div><dt className="text-xs text-slate-500">Verified email</dt><dd className="mt-1 break-all font-medium">{affiliate.email}</dd></div>
      <div><dt className="text-xs text-slate-500">Program status</dt><dd className="mt-1 font-medium">Approved</dd></div>
    </dl><p className="mt-6 border-t pt-5 text-sm leading-6 text-slate-500">Contact your program administrator for account corrections. Do not send bank or tax numbers by email.</p><Link href="/affiliates/payouts" className="mt-5 inline-flex min-h-11 items-center rounded-lg bg-clinic-navy px-5 text-sm font-medium text-white">Payment setup</Link></Card>
  </div>;
}
