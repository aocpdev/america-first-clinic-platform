import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { SidebarShell } from "@/components/layout/sidebar-shell";
import { Card } from "@/components/ui/card";
import { adminNav } from "@/lib/constants/navigation";
import { prisma } from "@/lib/db/prisma";
import { requireAffiliateAdmin } from "@/lib/referrals/affiliate-admin";
import { AffiliateForm, AffiliateLoginConnectionForm } from "../forms";

export default async function AffiliateDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { companyId } = await requireAffiliateAdmin();
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();
  const affiliate = await prisma.affiliateProfile.findFirst({ where: { id, companyId } });
  if (!affiliate) notFound();
  const events = await prisma.auditLog.findMany({ where: { companyId, resource: "AffiliateProfile", resourceId: id }, orderBy: { createdAt: "desc" }, take: 20 });
  const applicationEvent = await prisma.auditLog.findFirst({ where: { companyId, resource: "AffiliateProfile", resourceId: id, action: "AFFILIATE_APPLICATION_RECEIVED" }, orderBy: { createdAt: "asc" } });
  const application = z.object({ website: z.string(), message: z.string(), contactConsent: z.boolean() }).safeParse(applicationEvent?.metadata);
  return <SidebarShell nav={[...adminNav, { href: "/admin/affiliates", label: "Affiliates" }]} eyebrow="Go Virtual Health" title="Affiliate profile">
    <div className="mx-auto max-w-3xl space-y-6">
      <Link href="/admin/affiliates" className="text-sm text-clinic-navy">← All affiliates</Link>
      {application.success && <Card className="space-y-3 rounded-2xl p-5"><h2 className="font-semibold">Application from RX</h2><p className="break-all text-sm text-slate-600">Website / social: {application.data.website || "Not provided"}</p><p className="whitespace-pre-wrap text-sm leading-6 text-slate-600">{application.data.message || "No additional message."}</p><p className="text-xs text-slate-500">Contact consent recorded. Review before approval; no login or payout access was granted by this form.</p></Card>}
      <Card className="space-y-5 rounded-2xl p-5 sm:p-7"><h2 className="text-xl font-semibold">{affiliate.displayName}</h2>
        <AffiliateForm key={affiliate.revision} affiliate={{ id: affiliate.id, revision: affiliate.revision,
          displayName: affiliate.displayName, email: affiliate.email, category: affiliate.category,
          status: affiliate.status, commissionBps: affiliate.commissionBps }} /></Card>
      <Card className="space-y-3 rounded-2xl p-5"><h3 className="font-semibold">Referral identity</h3>
        <code className="block break-all text-sm">{affiliate.referralCode}</code>
        <p className="text-sm text-slate-500">This code is reserved. Shareable RX links will be available after checkout integration is verified.</p></Card>
      <Card className="space-y-4 rounded-2xl p-5"><h3 className="font-semibold">Workspace access</h3>
        {affiliate.authUserId ? <p className="text-sm text-slate-500">Verified account connected. Suspension or archive blocks workspace access. Email changes require a separate identity review.</p>
          : affiliate.status === "APPROVED" ? <AffiliateLoginConnectionForm key={affiliate.revision} id={affiliate.id} revision={affiliate.revision} />
          : <p className="text-sm text-slate-500">Approve this affiliate before connecting a verified account.</p>}
      </Card>
      <Card className="rounded-2xl p-5"><h3 className="font-semibold">Change history</h3>
        <ul className="mt-4 space-y-3">{events.map(event => <li key={event.id} className="flex flex-wrap justify-between gap-2 border-b pb-3 text-xs text-slate-500"><span>{event.action.replaceAll("_", " ")}</span><time dateTime={event.createdAt.toISOString()}>{event.createdAt.toISOString().slice(0, 16).replace("T", " ")} UTC</time></li>)}</ul></Card>
    </div>
  </SidebarShell>;
}
