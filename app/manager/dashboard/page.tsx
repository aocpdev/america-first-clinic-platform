import { ConsultantTable } from "@/components/dashboard/data-table";
import { MetricCard } from "@/components/dashboard/metric-card";
import { RevenueChart } from "@/components/dashboard/revenue-chart";
import { SidebarShell } from "@/components/layout/sidebar-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { adminNav } from "@/lib/constants/navigation";

export default function ManagerDashboardPage() {
  return (
    <SidebarShell nav={adminNav.slice(0, 4)} eyebrow="Manager" title="Team performance">
      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard label="Team revenue" value="$57.8K" change="+14.3% this month" />
        <MetricCard label="Assigned leads" value="126" change="38 contacted today" tone="green" />
        <MetricCard label="Team commissions" value="$8.7K" change="Pending approval" tone="red" />
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_1fr]">
        <Card><CardHeader><CardTitle>Team sales trend</CardTitle></CardHeader><CardContent><RevenueChart /></CardContent></Card>
        <ConsultantTable />
      </div>
    </SidebarShell>
  );
}
