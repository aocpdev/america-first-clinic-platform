import { MetricCard } from "@/components/dashboard/metric-card";
import { RevenueChart } from "@/components/dashboard/revenue-chart";
import { SidebarShell } from "@/components/layout/sidebar-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { groupLeaderNav, partnerNav } from "@/lib/constants/navigation";
import { requirePartner } from "@/lib/auth/current-user";
import { getGroupLeaderDashboardMetrics, getPartnerDashboardMetrics } from "@/lib/dashboard/metrics";
import { prisma } from "@/lib/db/prisma";
import { currency } from "@/lib/utils";

async function getPartnerProfile(userId: string) {
  return prisma.partnerProfile.findUnique({
    where: { userId },
    include: { user: true }
  });
}

export default async function PartnerDashboardPage() {
  const user = await requirePartner();
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
    ? await getPartnerDashboardMetrics(user.companyId!, partnerProfile.id)
    : await getGroupLeaderDashboardMetrics(user.companyId!, groupLeaderProfile!.id);
  const isLeaderDashboard = !partnerProfile && Boolean(groupLeaderProfile);
  const leaderCount = "leaderCount" in metrics ? metrics.leaderCount : 0;

  return (
    <SidebarShell nav={nav} eyebrow={isLeaderDashboard ? "Group leader" : "Partner"} title={isLeaderDashboard ? "Leader performance" : "Partner performance"}>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Collected revenue" value={currency(metrics.revenueCents / 100)} change={`${metrics.paidOrderCount} paid orders in your network`} />
        <MetricCard label={isLeaderDashboard ? "Leader profit" : "Partner profit"} value={currency(metrics.profitCents / 100)} change="Real earnings from captured payments" tone="green" />
        <MetricCard label="Pending seller payouts" value={currency(metrics.pendingConsultantPayoutCents / 100)} change="Consultant commissions awaiting payout" tone="red" />
        <MetricCard label="Assigned consultants" value={`${metrics.consultantCount}`} change={isLeaderDashboard ? "Direct team members" : `${leaderCount} leaders in network`} />
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
