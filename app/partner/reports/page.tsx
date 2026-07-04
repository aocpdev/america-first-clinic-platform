import { ReportsWorkspace, normalizeComparisonView, normalizeReportView } from "@/components/reports/reports-workspace";
import { Card } from "@/components/ui/card";
import { SidebarShell } from "@/components/layout/sidebar-shell";
import { requirePartner } from "@/lib/auth/current-user";
import { groupLeaderNav, partnerNav } from "@/lib/constants/navigation";
import { parseDashboardDateRange } from "@/lib/dashboard/date-range";
import { prisma } from "@/lib/db/prisma";
import { getReportData } from "@/lib/reports/queries";

export default async function PartnerReportsPage({
  searchParams
}: {
  searchParams: Promise<{ range?: string; from?: string; to?: string; compare?: string; report?: string }>;
}) {
  const user = await requirePartner();
  const params = await searchParams;
  const range = parseDashboardDateRange(params);
  const compare = normalizeComparisonView(params.compare);
  const activeReport = normalizeReportView(params.report);
  const isGroupLeader = user.role === "GROUP_LEADER";
  const nav = isGroupLeader ? groupLeaderNav : partnerNav;
  const [partnerProfile, groupLeaderProfile] = await Promise.all([
    prisma.partnerProfile.findUnique({ where: { userId: user.id } }),
    prisma.groupLeaderProfile.findUnique({ where: { userId: user.id } })
  ]);

  const reportInput = partnerProfile
    ? { companyId: user.companyId!, role: "partner" as const, partnerProfileId: partnerProfile.id, dateRange: range }
    : groupLeaderProfile
      ? { companyId: user.companyId!, role: "group_leader" as const, groupLeaderProfileId: groupLeaderProfile.id, dateRange: range }
      : null;

  if (!user.companyId || !reportInput) {
    return (
      <SidebarShell nav={nav} eyebrow={isGroupLeader ? "Group leader" : "Partner"} title="Reports">
        <Card className="p-6">
          <h2 className="text-xl font-semibold text-clinic-ink">Reporting profile not configured</h2>
          <p className="mt-2 text-slate-600">A partner, manager, or admin must assign your reporting profile before reports are available.</p>
        </Card>
      </SidebarShell>
    );
  }

  const data = await getReportData(reportInput);
  const leader = reportInput.role === "group_leader";

  return (
    <SidebarShell nav={nav} eyebrow={leader ? "Group leader" : "Partner"} title="Reports">
      <ReportsWorkspace
        eyebrow={leader ? "Leader reporting" : "Partner reporting"}
        title={leader ? "Team sales and agent performance" : "Partner network reporting"}
        range={range}
        resetHref="/partner/reports"
        exportBaseHref="/api/reports/export"
        comparisonView={compare}
        comparisonBaseHref="/partner/reports"
        activeReport={activeReport}
        reportBaseHref="/partner/reports"
        earningsLabel={leader ? "Leader earnings" : "Partner earnings"}
        directLabel={leader ? "Leader direct revenue" : "Partner direct revenue"}
        partnerPayoutLabel={leader ? "Partner Override" : "Partner Commission"}
        scopeDescription={leader
          ? "Leader reports include your personal sales and the agents assigned under your leadership. Partner-only payout reconciliation is intentionally outside this view."
          : "Partner reports include the full hierarchy you control: your own sales, managers, leaders, agents, product performance, and CSV exports for payout reconciliation."}
        data={data}
      />
    </SidebarShell>
  );
}
