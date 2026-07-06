import { MetricCard } from "@/components/dashboard/metric-card";
import { DashboardDateRangeFilter } from "@/components/dashboard/date-range-filter";
import { RevenueChart } from "@/components/dashboard/revenue-chart";
import { SidebarShell } from "@/components/layout/sidebar-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireRole } from "@/lib/auth/current-user";
import { adminNav } from "@/lib/constants/navigation";
import { getAdminDashboardMetrics } from "@/lib/dashboard/metrics";
import { parseDashboardDateRange } from "@/lib/dashboard/date-range";
import { prisma } from "@/lib/db/prisma";
import { currency } from "@/lib/utils";

export default async function AdminDashboardPage({
  searchParams
}: {
  searchParams: Promise<{ range?: string; from?: string; to?: string }>;
}) {
  const user = await requireRole("COMPANY_ADMIN");
  const params = await searchParams;
  const dateRange = parseDashboardDateRange(params);

  if (!user.companyId) {
    return (
      <SidebarShell nav={adminNav} eyebrow="Go Virtual Health" title="Revenue command center">
        <Card className="p-6">
          <h2 className="text-xl font-semibold text-clinic-ink">Company profile required</h2>
          <p className="mt-2 text-slate-600">Create or assign a company before revenue metrics can be calculated.</p>
        </Card>
      </SidebarShell>
    );
  }

  const [metrics, recentOrders] = await Promise.all([
    getAdminDashboardMetrics(user.companyId, dateRange),
    prisma.order.findMany({
      where: {
        companyId: user.companyId,
        paymentStatus: "CAPTURED",
        ...(dateRange.from || dateRange.to ? { createdAt: { ...(dateRange.from ? { gte: dateRange.from } : {}), ...(dateRange.to ? { lte: dateRange.to } : {}) } } : {})
      },
      include: {
        customer: true,
        consultantProfile: { include: { user: true } }
      },
      orderBy: { updatedAt: "desc" },
      take: 5
    })
  ]);

  return (
    <SidebarShell nav={adminNav} eyebrow="Go Virtual Health" title="Revenue command center">
      <DashboardDateRangeFilter range={dateRange} resetHref="/admin/dashboard" />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Collected revenue" value={currency(metrics.revenueCents / 100)} change={`${metrics.paidOrderCount} paid orders`} info="Total money collected from paid orders in this date range." />
        <MetricCard label="Gross margin" value={currency(metrics.grossProfitCents / 100)} change="Total margin from captured payments" tone="green" info="Money left after subtracting product cost from paid orders." />
        <MetricCard label="Go Virtual Health direct profit" value={currency(metrics.adminDirectProfitCents / 100)} change={`${metrics.adminDirectOrderCount} Go Virtual Health direct sales`} tone="green" info="Profit from paid orders created directly by Go Virtual Health, without an agent or partner attached." />
        <MetricCard label="Pending payouts" value={currency(metrics.pendingPayoutCents / 100)} change="Commission splits awaiting payout" tone="red" info="Commissions that are calculated but not ready or marked paid yet." />
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-[1.4fr_.6fr]">
        <Card>
          <CardHeader>
            <CardTitle>Revenue and gross profit</CardTitle>
          </CardHeader>
          <CardContent>
            <RevenueChart data={metrics.chartData} earningsLabel="Gross profit" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Recent paid orders</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {recentOrders.length ? recentOrders.map((order) => (
              <div key={order.id} className="rounded-2xl border border-border bg-clinic-mist p-4 text-sm">
                <p className="font-semibold text-clinic-ink">
                  {[order.customer.firstName, order.customer.lastName].filter(Boolean).join(" ").trim() || order.customer.email}
                </p>
                <div className="mt-2 flex items-center justify-between text-slate-600">
                  <span>{order.consultantProfile ? [order.consultantProfile.user.firstName, order.consultantProfile.user.lastName].filter(Boolean).join(" ") || order.consultantProfile.user.email : "Direct sale"}</span>
                  <span className="font-semibold text-clinic-navy">{currency(order.totalCents / 100)}</span>
                </div>
              </div>
            )) : (
              <div className="rounded-2xl border border-dashed border-border bg-clinic-mist p-5 text-sm font-medium text-slate-500">
                No captured orders yet.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </SidebarShell>
  );
}
