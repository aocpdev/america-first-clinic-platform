import { MetricCard } from "@/components/dashboard/metric-card";
import { DashboardDateRangeFilter } from "@/components/dashboard/date-range-filter";
import { RevenueChart } from "@/components/dashboard/revenue-chart";
import { SidebarShell } from "@/components/layout/sidebar-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireManager } from "@/lib/auth/current-user";
import { managerNav } from "@/lib/constants/navigation";
import { getManagerDashboardMetrics } from "@/lib/dashboard/metrics";
import { parseDashboardDateRange } from "@/lib/dashboard/date-range";
import { prisma } from "@/lib/db/prisma";
import { currency } from "@/lib/utils";

async function getManagerProfile(userId: string) {
  return prisma.managerProfile.findUnique({
    where: { userId },
    include: { partnerProfile: true }
  });
}

export default async function ManagerDashboardPage({
  searchParams
}: {
  searchParams: Promise<{ range?: string; from?: string; to?: string }>;
}) {
  const user = await requireManager();
  const params = await searchParams;
  const dateRange = parseDashboardDateRange(params);
  const managerProfile = user.managerProfile ?? await getManagerProfile(user.id);

  if (!managerProfile || !user.companyId) {
    return (
      <SidebarShell nav={managerNav} eyebrow="Manager" title="Manager dashboard">
        <Card className="p-6">
          <h2 className="text-xl font-semibold text-clinic-ink">Manager profile not configured</h2>
          <p className="mt-2 text-slate-600">A partner or Go Virtual Health must assign your manager profile before team performance appears here.</p>
        </Card>
      </SidebarShell>
    );
  }

  const metrics = await getManagerDashboardMetrics(user.companyId, managerProfile.id, dateRange);

  return (
    <SidebarShell nav={managerNav} eyebrow="Manager" title="Manager dashboard">
      <DashboardDateRangeFilter range={dateRange} resetHref="/manager/dashboard" />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Team revenue" value={currency(metrics.revenueCents / 100)} change={`${metrics.paidOrderCount} paid orders in your team`} info="Total money collected from your sales and your team's paid sales." />
        <MetricCard label="Personal revenue" value={currency(metrics.personalRevenueCents / 100)} change={`${metrics.personalOrderCount} direct sales`} info="Money collected from orders you personally created." />
        <MetricCard label="Manager earnings" value={currency(metrics.profitCents / 100)} change="Direct earnings plus team overrides" tone="green" info="Your manager commission from paid orders in your scope." />
        <MetricCard label="Pending team payouts" value={currency(metrics.pendingDownlinePayoutCents / 100)} change="Leader and agent commissions pending" tone="red" info="Team commissions that are calculated but not ready or marked paid yet." />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_0.7fr]">
        <Card>
          <CardHeader><CardTitle>Revenue and earnings</CardTitle></CardHeader>
          <CardContent>
            <RevenueChart data={metrics.chartData} earningsLabel="Manager earnings" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Team scope</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-clinic-mist p-4">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Leaders</p>
                <p className="mt-2 text-3xl font-semibold text-clinic-navy">{metrics.leaderCount}</p>
              </div>
              <div className="rounded-2xl bg-clinic-mist p-4">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Agents</p>
                <p className="mt-2 text-3xl font-semibold text-clinic-navy">{metrics.consultantCount}</p>
              </div>
            </div>
            <div className="rounded-2xl border border-border bg-white p-4">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Customers</p>
              <p className="mt-2 text-2xl font-semibold text-clinic-ink">{metrics.customerCount}</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">Includes customers owned directly by you and customers assigned to your leaders and agents.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </SidebarShell>
  );
}
