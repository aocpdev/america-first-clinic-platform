import { MetricCard } from "@/components/dashboard/metric-card";
import { RevenueChart } from "@/components/dashboard/revenue-chart";
import { SidebarShell } from "@/components/layout/sidebar-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireManager } from "@/lib/auth/current-user";
import { managerNav } from "@/lib/constants/navigation";
import { getManagerDashboardMetrics } from "@/lib/dashboard/metrics";
import { prisma } from "@/lib/db/prisma";
import { currency } from "@/lib/utils";

async function getManagerProfile(userId: string) {
  return prisma.managerProfile.findUnique({
    where: { userId },
    include: { partnerProfile: true }
  });
}

export default async function ManagerDashboardPage() {
  const user = await requireManager();
  const managerProfile = user.managerProfile ?? await getManagerProfile(user.id);

  if (!managerProfile || !user.companyId) {
    return (
      <SidebarShell nav={managerNav} eyebrow="Manager" title="Manager dashboard">
        <Card className="p-6">
          <h2 className="text-xl font-semibold text-clinic-ink">Manager profile not configured</h2>
          <p className="mt-2 text-slate-600">A partner or admin must assign your manager profile before team performance appears here.</p>
        </Card>
      </SidebarShell>
    );
  }

  const metrics = await getManagerDashboardMetrics(user.companyId, managerProfile.id);

  return (
    <SidebarShell nav={managerNav} eyebrow="Manager" title="Manager dashboard">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Team revenue" value={currency(metrics.revenueCents / 100)} change={`${metrics.paidOrderCount} paid orders in your team`} />
        <MetricCard label="Personal revenue" value={currency(metrics.personalRevenueCents / 100)} change={`${metrics.personalOrderCount} direct sales`} />
        <MetricCard label="Manager earnings" value={currency(metrics.profitCents / 100)} change="Direct earnings plus team overrides" tone="green" />
        <MetricCard label="Pending team payouts" value={currency(metrics.pendingDownlinePayoutCents / 100)} change="Leader and seller commissions pending" tone="red" />
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
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Sellers</p>
                <p className="mt-2 text-3xl font-semibold text-clinic-navy">{metrics.consultantCount}</p>
              </div>
            </div>
            <div className="rounded-2xl border border-border bg-white p-4">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Customers</p>
              <p className="mt-2 text-2xl font-semibold text-clinic-ink">{metrics.customerCount}</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">Includes customers owned directly by you and customers assigned to your leaders and sellers.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </SidebarShell>
  );
}
