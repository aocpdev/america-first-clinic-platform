import { ReportsWorkspace } from "@/components/reports/reports-workspace";
import { Card } from "@/components/ui/card";
import { SidebarShell } from "@/components/layout/sidebar-shell";
import { requireManager } from "@/lib/auth/current-user";
import { managerNav } from "@/lib/constants/navigation";
import { parseDashboardDateRange } from "@/lib/dashboard/date-range";
import { prisma } from "@/lib/db/prisma";
import { getReportData } from "@/lib/reports/queries";

export default async function ManagerReportsPage({
  searchParams
}: {
  searchParams: Promise<{ range?: string; from?: string; to?: string }>;
}) {
  const user = await requireManager();
  const params = await searchParams;
  const range = parseDashboardDateRange(params);
  const managerProfile = user.managerProfile ?? await prisma.managerProfile.findUnique({ where: { userId: user.id } });

  if (!user.companyId || !managerProfile) {
    return (
      <SidebarShell nav={managerNav} eyebrow="Manager" title="Reports">
        <Card className="p-6">
          <h2 className="text-xl font-semibold text-clinic-ink">Manager profile not configured</h2>
          <p className="mt-2 text-slate-600">A partner or admin must assign your manager profile before reports are available.</p>
        </Card>
      </SidebarShell>
    );
  }

  const data = await getReportData({
    companyId: user.companyId,
    role: "manager",
    managerProfileId: managerProfile.id,
    dateRange: range
  });

  return (
    <SidebarShell nav={managerNav} eyebrow="Manager" title="Reports">
      <ReportsWorkspace
        eyebrow="Manager reporting"
        title="Personal sales and team performance"
        range={range}
        resetHref="/manager/reports"
        exportBaseHref="/api/reports/export"
        earningsLabel="Manager earnings"
        directLabel="Manager direct revenue"
        scopeDescription="Manager reports treat managers as agents first, while adding visibility into leaders and agents assigned under the manager hierarchy."
        data={data}
      />
    </SidebarShell>
  );
}
