import { ConsultantTable } from "@/components/dashboard/data-table";
import { MetricCard } from "@/components/dashboard/metric-card";
import { RevenueChart } from "@/components/dashboard/revenue-chart";
import { SidebarShell } from "@/components/layout/sidebar-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { adminNav } from "@/lib/constants/navigation";
import { activity } from "@/lib/mock-data";

export default function AdminDashboardPage() {
  return (
    <SidebarShell nav={adminNav} eyebrow="Company admin" title="Revenue command center">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Total revenue" value="$104.5K" change="+18.2% vs last month" />
        <MetricCard label="Total orders" value="1,284" change="+11.6% vs last month" tone="green" />
        <MetricCard label="Pending commissions" value="$15.8K" change="42 payouts queued" tone="red" />
        <MetricCard label="Active subscriptions" value="418" change="+24 renewals this week" />
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-[1.4fr_.6fr]">
        <Card>
          <CardHeader>
            <CardTitle>Revenue analytics</CardTitle>
          </CardHeader>
          <CardContent>
            <RevenueChart />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Recent activity</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {activity.map((item) => (
              <div key={item} className="rounded-lg border border-border bg-clinic-mist p-3 text-sm font-medium text-clinic-ink">
                {item}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
      <div className="mt-6">
        <ConsultantTable />
      </div>
    </SidebarShell>
  );
}
