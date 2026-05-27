import { MetricCard } from "@/components/dashboard/metric-card";
import { DashboardDateRangeFilter } from "@/components/dashboard/date-range-filter";
import { RevenueChart } from "@/components/dashboard/revenue-chart";
import { SidebarShell } from "@/components/layout/sidebar-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { groupLeaderNav, partnerNav } from "@/lib/constants/navigation";
import { requirePartner } from "@/lib/auth/current-user";
import { getGroupLeaderDashboardMetrics, getPartnerDashboardMetrics } from "@/lib/dashboard/metrics";
import { parseDashboardDateRange } from "@/lib/dashboard/date-range";
import { prisma } from "@/lib/db/prisma";
import { currency } from "@/lib/utils";

async function getPartnerProfile(userId: string) {
  return prisma.partnerProfile.findUnique({
    where: { userId },
    include: { user: true }
  });
}

export default async function PartnerDashboardPage({
  searchParams
}: {
  searchParams: Promise<{ range?: string; from?: string; to?: string }>;
}) {
  const user = await requirePartner();
  const params = await searchParams;
  const dateRange = parseDashboardDateRange(params);
  const isGroupLeader = user.role === "GROUP_LEADER";
  const nav = isGroupLeader ? groupLeaderNav : partnerNav;
  const [partnerProfile, groupLeaderProfile] = await Promise.all([
    getPartnerProfile(user.id),
    prisma.groupLeaderProfile.findUnique({
      where: { userId: user.id },
      include: { partnerProfile: true }
    })
  ]);

  if (!partnerProfile && !groupLeaderProfile) {
    return (
      <SidebarShell nav={nav} eyebrow={isGroupLeader ? "Group leader" : "Partner"} title={isGroupLeader ? "Leader dashboard" : "Partner dashboard"}>
        <Card className="p-6">
          <h2 className="text-xl font-semibold text-clinic-ink">{isGroupLeader ? "Leader dashboard is coming next" : "Partner profile not configured"}</h2>
          <p className="mt-2 text-slate-600">{isGroupLeader ? "Use Team, Sales, Pipeline, and Commissions to review your assigned hierarchy." : "An owner must create and assign your partner profile before profit appears here."}</p>
        </Card>
      </SidebarShell>
    );
  }

  const metrics = partnerProfile
    ? await getPartnerDashboardMetrics(user.companyId!, partnerProfile.id, dateRange)
    : await getGroupLeaderDashboardMetrics(user.companyId!, groupLeaderProfile!.id, dateRange);
  const isLeaderDashboard = !partnerProfile && Boolean(groupLeaderProfile);
  const managerCount = "managerCount" in metrics ? metrics.managerCount : 0;
  const leaderCount = "leaderCount" in metrics ? metrics.leaderCount : 0;
  const pendingDownlinePayoutCents = "pendingDownlinePayoutCents" in metrics
    ? metrics.pendingDownlinePayoutCents
    : metrics.pendingConsultantPayoutCents;

  return (
    <SidebarShell nav={nav} eyebrow={isLeaderDashboard ? "Group leader" : "Partner"} title={isLeaderDashboard ? "Leader performance" : "Partner performance"}>
      <DashboardDateRangeFilter range={dateRange} resetHref="/partner/dashboard" />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label={isLeaderDashboard ? "Team revenue" : "Network revenue"} value={currency(metrics.revenueCents / 100)} change={`${metrics.paidOrderCount} paid orders in scope`} />
        <MetricCard label="Personal revenue" value={currency(metrics.personalRevenueCents / 100)} change={`${metrics.personalOrderCount} direct sales`} />
        <MetricCard label={isLeaderDashboard ? "Leader earnings" : "Partner earnings"} value={currency(metrics.profitCents / 100)} change="Personal earnings plus approved overrides" tone="green" />
        <MetricCard label="Pending downline payouts" value={currency(pendingDownlinePayoutCents / 100)} change="Commissions still pending approval" tone="red" />
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-3">
        {!isLeaderDashboard ? <MetricCard label="Managers" value={`${managerCount}`} change="Manager layer in your network" /> : null}
        <MetricCard label="Leaders" value={`${leaderCount}`} change={isLeaderDashboard ? "Current leader scope" : "Group leaders in network"} />
        <MetricCard label="Consultants" value={`${metrics.consultantCount}`} change={isLeaderDashboard ? "Direct sellers under you" : "Sellers across the partner network"} />
        <MetricCard label="Personal earnings" value={currency(metrics.personalProfitCents / 100)} change="Only sales personally created by this account" tone="green" />
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_1fr]">
        <Card>
          <CardHeader><CardTitle>Revenue and earnings</CardTitle></CardHeader>
          <CardContent>
            <RevenueChart data={metrics.chartData} earningsLabel={isLeaderDashboard ? "Leader profit" : "Partner profit"} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>{isLeaderDashboard ? "Leader visibility" : "Partner visibility"}</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm leading-6 text-slate-600">
              This dashboard only includes captured sales inside your assigned hierarchy. Pending payment links and unpaid invoices are excluded from real revenue and earnings.
            </p>
            <div className="rounded-2xl border border-border bg-clinic-mist p-4">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Scope</p>
              <p className="mt-2 font-semibold text-clinic-ink">
                {isLeaderDashboard ? `Consultants assigned to ${groupLeaderProfile!.displayName}` : `Leaders and consultants assigned to ${partnerProfile!.companyName ?? partnerProfile!.displayName}`}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </SidebarShell>
  );
}
