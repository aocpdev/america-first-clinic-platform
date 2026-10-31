import { Card } from "@/components/ui/card";
import { prisma } from "@/lib/db/prisma";
import { requireAffiliateSession } from "@/lib/referrals/affiliate-session";

const eventLabels: Record<string, string> = { AFFILIATE_CREATED: "Profile created", AFFILIATE_UPDATED: "Profile updated",
  AFFILIATE_LOGIN_CONNECTED: "Verified login connected", AFFILIATE_PAYOUT_SETUP_STARTED: "Payment setup started" };

export default async function AffiliateActivityPage() {
  const affiliate = await requireAffiliateSession();
  const events = await prisma.auditLog.findMany({ where: { companyId: affiliate.companyId,
    resource: "AffiliateProfile", resourceId: affiliate.id, action: { in: Object.keys(eventLabels) } },
    select: { id: true, action: true, createdAt: true }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 50 });
  return <div className="space-y-6"><div><h1 className="text-3xl font-semibold tracking-tight text-clinic-navy">Activity</h1>
    <p className="mt-3 text-sm leading-6 text-slate-500">Your latest account and payment-setup activity. Customer referral and purchase history is not activated yet.</p></div>
    <Card className="rounded-2xl p-6"><h2 className="text-lg font-semibold text-clinic-navy">Account history</h2>
      {events.length ? <ol className="mt-5 divide-y">{events.map(event => <li key={event.id} className="flex flex-wrap items-center justify-between gap-3 py-4 text-sm"><span>{eventLabels[event.action]}</span><time dateTime={event.createdAt.toISOString()} className="text-xs text-slate-500">{event.createdAt.toISOString().slice(0, 16).replace("T", " ")} UTC</time></li>)}</ol> : <p className="mt-5 text-sm text-slate-500">No account activity has been recorded.</p>}
      <p className="mt-4 text-xs text-slate-500">Latest 50 events. Patient identities and clinical information are never displayed here.</p></Card>
  </div>;
}
