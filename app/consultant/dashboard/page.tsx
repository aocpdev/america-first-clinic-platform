import { ConsultantTable } from "@/components/dashboard/data-table";
import { MetricCard } from "@/components/dashboard/metric-card";
import { RevenueChart } from "@/components/dashboard/revenue-chart";
import { SidebarShell } from "@/components/layout/sidebar-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { consultantNav } from "@/lib/constants/navigation";
import { products } from "@/lib/mock-data";

export default function ConsultantDashboardPage() {
  return (
    <SidebarShell nav={consultantNav} eyebrow="Consultant" title="Sales performance">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Daily sales" value="$2.8K" change="+9.4% today" />
        <MetricCard label="Monthly sales" value="$28.4K" change="78% of monthly goal" tone="green" />
        <MetricCard label="Pending commissions" value="$4.2K" change="12 orders awaiting approval" tone="red" />
        <MetricCard label="Referral conversion" value="18.4%" change="+2.1 pts this month" />
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-[1.2fr_.8fr]">
        <Card>
          <CardHeader><CardTitle>Revenue and commissions</CardTitle></CardHeader>
          <CardContent><RevenueChart /></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Top products sold</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {products.map((product) => (
              <div key={product.slug} className="flex items-center justify-between rounded-lg border border-border p-3">
                <span className="text-sm font-semibold text-clinic-ink">{product.title}</span>
                <span className="text-sm font-semibold text-clinic-red">{product.consultantCommission}</span>
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
