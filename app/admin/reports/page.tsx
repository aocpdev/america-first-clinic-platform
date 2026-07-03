import { ReportsWorkspace } from "@/components/reports/reports-workspace";
import { Card } from "@/components/ui/card";
import { SidebarShell } from "@/components/layout/sidebar-shell";
import { requireRole } from "@/lib/auth/current-user";
import { adminNav } from "@/lib/constants/navigation";
import { parseDashboardDateRange } from "@/lib/dashboard/date-range";
import { getReportData } from "@/lib/reports/queries";

export default async function AdminReportsPage({
  searchParams
}: {
  searchParams: Promise<{ range?: string; from?: string; to?: string }>;
}) {
  const user = await requireRole("COMPANY_ADMIN");
  const params = await searchParams;
  const range = parseDashboardDateRange(params);

  if (!user.companyId) {
    return (
      <SidebarShell nav={adminNav} eyebrow="Admin" title="Reports">
        <Card className="p-6">
          <h2 className="text-xl font-semibold text-clinic-ink">Company profile required</h2>
          <p className="mt-2 text-slate-600">Assign this account to a company before reports can be generated.</p>
        </Card>
      </SidebarShell>
    );
  }

  const data = await getReportData({ companyId: user.companyId, role: "admin", dateRange: range });

  return (
    <SidebarShell nav={adminNav} eyebrow="Admin" title="Reports">
      <ReportsWorkspace
        eyebrow="Executive reporting"
        title="Company-wide sales intelligence"
        range={range}
        resetHref="/admin/reports"
        exportBaseHref="/api/reports/export"
        earningsLabel="Gross margin"
        directLabel="Admin direct revenue"
        showAgencyFee
        scopeDescription="Admin reports include captured sales across the entire company, all originators, product mix, gross margin, and downloadable CSV exports for reconciliation."
        data={data}
      />
    </SidebarShell>
  );
}
