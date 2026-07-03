import { ReportsWorkspace } from "@/components/reports/reports-workspace";
import { Card } from "@/components/ui/card";
import { SidebarShell } from "@/components/layout/sidebar-shell";
import { requireApprovedConsultant } from "@/lib/auth/current-user";
import { consultantNav } from "@/lib/constants/navigation";
import { parseDashboardDateRange } from "@/lib/dashboard/date-range";
import { getReportData } from "@/lib/reports/queries";

export default async function ConsultantReportsPage({
  searchParams
}: {
  searchParams: Promise<{ range?: string; from?: string; to?: string }>;
}) {
  const user = await requireApprovedConsultant();
  const params = await searchParams;
  const range = parseDashboardDateRange(params);

  if (!user.companyId || !user.consultantProfile?.id) {
    return (
      <SidebarShell nav={consultantNav} eyebrow="Agent" title="Reports">
        <Card className="p-6">
          <h2 className="text-xl font-semibold text-clinic-ink">Agent profile required</h2>
          <p className="mt-2 text-slate-600">Your agent profile must be approved before reports are available.</p>
        </Card>
      </SidebarShell>
    );
  }

  const data = await getReportData({
    companyId: user.companyId,
    role: "consultant",
    consultantProfileId: user.consultantProfile.id,
    dateRange: range
  });

  return (
    <SidebarShell nav={consultantNav} eyebrow="Agent" title="Reports">
      <ReportsWorkspace
        eyebrow="Agent reporting"
        title="Personal sales and commissions"
        range={range}
        resetHref="/consultant/reports"
        exportBaseHref="/api/reports/export"
        earningsLabel="Commission earned"
        directLabel="Personal revenue"
        scopeDescription="Agent reports include only your captured personal sales, product mix, customer orders, commissions, and downloadable CSV exports for your own records."
        data={data}
      />
    </SidebarShell>
  );
}
