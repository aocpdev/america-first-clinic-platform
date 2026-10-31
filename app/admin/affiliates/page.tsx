import Link from "next/link";
import { SidebarShell } from "@/components/layout/sidebar-shell";
import { Card } from "@/components/ui/card";
import { prisma } from "@/lib/db/prisma";
import { adminNav } from "@/lib/constants/navigation";
import { requireAffiliateAdmin } from "@/lib/referrals/affiliate-admin";
import { DefaultCommissionForm, AffiliateForm } from "./forms";

export const dynamic = "force-dynamic";
const statuses = ["PENDING", "APPROVED", "SUSPENDED", "ARCHIVED"];

export default async function AffiliatesPage({ searchParams }: {
  searchParams: Promise<{ q?: string; status?: string; page?: string }>;
}) {
  const { companyId } = await requireAffiliateAdmin();
  const query = await searchParams;
  const q = (query.q ?? "").trim().slice(0, 100);
  const status = statuses.includes(query.status ?? "") ? query.status : undefined;
  const requestedPage = Number(query.page ?? 1);
  const page = Number.isInteger(requestedPage) && requestedPage > 0 ? Math.min(requestedPage, 10000) : 1;
  const where = { companyId, ...(status ? { status } : {}), ...(q ? { OR: [
    { displayName: { contains: q, mode: "insensitive" as const } },
    { email: { contains: q, mode: "insensitive" as const } }
  ] } : {}) };
  const [settings, affiliates, count] = await Promise.all([
    prisma.affiliateProgramSetting.findUnique({ where: { companyId } }),
    prisma.affiliateProfile.findMany({ where, orderBy: [{ createdAt: "desc" }, { id: "asc" }], take: 20, skip: (page - 1) * 20 }),
    prisma.affiliateProfile.count({ where })
  ]);
  const defaultRate = settings?.commissionBps ?? 2500;
  function pageLink(next: number) {
    return `/admin/affiliates?${new URLSearchParams({ q, status: status ?? "", page: String(next) })}`;
  }
  return <SidebarShell nav={[...adminNav, { href: "/admin/affiliates", label: "Affiliates" }]} eyebrow="Go Virtual Health" title="Affiliates">
    <div className="space-y-6">
      <div><h2 className="text-2xl font-semibold tracking-tight text-clinic-ink">Affiliate program</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">Manage independent referral partners. Internal agent commissions and team structures remain unchanged.</p></div>
      <Card className="border-blue-100 bg-blue-50 p-4 text-sm text-clinic-navy">Setup mode · Affiliate checkout, login invitations and payouts are not activated by these settings.</Card>
      <div className="grid items-start gap-6 lg:grid-cols-[1fr_320px]">
        <Card className="space-y-5 rounded-2xl p-5 sm:p-6"><h3 className="font-semibold">New affiliate</h3><AffiliateForm /></Card>
        <Card className="space-y-5 rounded-2xl p-5 sm:p-6"><h3 className="font-semibold">Commission rules</h3>
          <DefaultCommissionForm key={settings?.revision ?? 0} rateBps={defaultRate} revision={settings?.revision ?? 0} />
          <p className="border-t pt-4 text-xs leading-5 text-slate-500">Existing discount funding rules apply. Agency fee is calculated separately, with no additional deduction from this basis.</p></Card>
      </div>
      <Card className="rounded-2xl p-5 sm:p-6">
        <form className="flex flex-col gap-3 sm:flex-row" role="search">
          <label className="flex-1 text-sm">Search affiliates<input name="q" defaultValue={q} placeholder="Name or email" className="mt-2 h-11 w-full rounded-lg border px-3" /></label>
          <label className="text-sm">Status<select name="status" defaultValue={status ?? ""} className="mt-2 block h-11 rounded-lg border px-3"><option value="">All statuses</option>{statuses.map(value => <option key={value}>{value}</option>)}</select></label>
          <button className="h-11 rounded-lg bg-clinic-navy px-5 text-sm font-semibold text-white sm:self-end">Search</button>
        </form>
        <p className="mt-5 text-xs text-slate-500">{count} matching affiliate{count === 1 ? "" : "s"}</p>
        <div className="mt-3 divide-y">{affiliates.map(affiliate => <div key={affiliate.id} className="flex flex-col gap-3 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0"><Link href={`/admin/affiliates/${affiliate.id}`} className="font-semibold text-clinic-navy underline-offset-4 hover:underline">{affiliate.displayName}</Link>
            <p className="mt-1 break-all text-sm text-slate-500">{affiliate.email}</p></div>
          <div className="text-sm sm:text-right"><span className="rounded-full bg-slate-100 px-3 py-1 text-xs">{affiliate.status}</span>
            <p className="mt-2 font-medium">{(affiliate.commissionBps ?? defaultRate) / 100}% <span className="font-normal text-slate-500">{affiliate.commissionBps == null ? "· Default" : "· Individual"}</span></p></div>
        </div>)}</div>
        {!affiliates.length && <p className="py-10 text-center text-sm text-slate-500">No affiliates found. Create a profile above to get started.</p>}
        <nav aria-label="Affiliate pages" className="mt-5 flex justify-between text-sm text-clinic-navy">{page > 1 ? <Link href={pageLink(page - 1)}>Previous</Link> : <span />}{page * 20 < count && <Link href={pageLink(page + 1)}>Next</Link>}</nav>
      </Card>
    </div>
  </SidebarShell>;
}
