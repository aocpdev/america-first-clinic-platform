import { MetricCard } from "@/components/dashboard/metric-card";
import { DashboardDateRangeFilter } from "@/components/dashboard/date-range-filter";
import { RevenueChart } from "@/components/dashboard/revenue-chart";
import { SidebarShell } from "@/components/layout/sidebar-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireApprovedConsultant } from "@/lib/auth/current-user";
import { consultantNav } from "@/lib/constants/navigation";
import { getConsultantDashboardMetrics } from "@/lib/dashboard/metrics";
import { parseDashboardDateRange } from "@/lib/dashboard/date-range";
import { currency } from "@/lib/utils";

export default async function ConsultantDashboardPage({
  searchParams
}: {
  searchParams: Promise<{ range?: string; from?: string; to?: string }>;
}) {
  const user = await requireApprovedConsultant();
  const params = await searchParams;
  const dateRange = parseDashboardDateRange(params);

  if (!user.companyId || !user.consultantProfile?.id) {
    return (
      <SidebarShell nav={consultantNav} eyebrow="Consultant" title="Sales performance">
        <Card className="p-6">
          <h2 className="text-xl font-semibold text-clinic-ink">Consultant profile required</h2>
          <p className="mt-2 text-slate-600">Your consultant profile must be approved before performance metrics are available.</p>
        </Card>
      </SidebarShell>
    );
  }

  const metrics = await getConsultantDashboardMetrics(user.companyId, user.consultantProfile.id, dateRange);

  return (
    <SidebarShell nav={consultantNav} eyebrow="Consultant" title="Sales performance">
      <DashboardDateRangeFilter range={dateRange} resetHref="/consultant/dashboard" />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Collected revenue" value={currency(metrics.revenueCents / 100)} change={`${metrics.paidOrderCount} paid orders`} info="Total money collected from your paid sales in this date range." />
        <MetricCard label="Commission earned" value={currency(metrics.commissionCents / 100)} change="Real earnings from captured payments" tone="green" info="Your commission from paid orders in this date range." />
        <MetricCard label="Pending commissions" value={currency(metrics.pendingCommissionCents / 100)} change="Awaiting payout approval" tone="red" info="Your commissions that are calculated but not ready or marked paid yet." />
        <MetricCard label="Assigned customers" value={`${metrics.customerCount}`} change="Customers assigned to you" info="Customers currently assigned to your seller profile." />
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-[1.2fr_.8fr]">
        <Card>
          <CardHeader><CardTitle>Revenue and commissions</CardTitle></CardHeader>
          <CardContent><RevenueChart data={metrics.chartData} earningsLabel="Commission earned" /></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Top products sold</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {metrics.topProducts.length ? metrics.topProducts.map((product) => (
              <div key={product.title} className="flex items-center justify-between rounded-2xl border border-border p-4">
                <div>
                  <span className="text-sm font-semibold text-clinic-ink">{product.title}</span>
                  <p className="mt-1 text-xs font-medium text-slate-500">{product.quantity} sold</p>
                </div>
                <span className="text-sm font-semibold text-clinic-red">{currency(product.revenueCents / 100)}</span>
              </div>
            )) : (
              <div className="rounded-2xl border border-dashed border-border bg-clinic-mist p-5 text-sm font-medium text-slate-500">
                Paid product sales will appear here.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      <div className="mt-6">
        <Card>
          <CardHeader>
            <CardTitle>Personal sales activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-3">
              {[
                ["Recent orders", "Track your latest customer purchases and payment status."],
                ["Customer follow-ups", "Keep your assigned customers moving through the pipeline."],
                ["Monthly goal", "Monitor progress against your personal sales target."]
              ].map(([title, description]) => (
                <div key={title} className="rounded-2xl border border-border bg-white p-4">
                  <p className="font-semibold text-clinic-ink">{title}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-500">{description}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </SidebarShell>
  );
}
