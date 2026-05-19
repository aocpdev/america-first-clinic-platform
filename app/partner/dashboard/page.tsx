import { MetricCard } from "@/components/dashboard/metric-card";
import { SidebarShell } from "@/components/layout/sidebar-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { groupLeaderNav, partnerNav } from "@/lib/constants/navigation";
import { requirePartner } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db/prisma";
import { getPartnerMetrics } from "@/lib/partner/metrics";
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
  const partnerProfile = await getPartnerProfile(user.id);

  if (!partnerProfile) {
    return (
      <SidebarShell nav={nav} eyebrow={isGroupLeader ? "Group leader" : "Partner"} title={isGroupLeader ? "Leader dashboard" : "Partner dashboard"}>
        <Card className="p-6">
          <h2 className="text-xl font-semibold text-clinic-ink">{isGroupLeader ? "Leader dashboard is coming next" : "Partner profile not configured"}</h2>
          <p className="mt-2 text-slate-600">{isGroupLeader ? "Use Team, Sales, Pipeline, and Commissions to review your assigned hierarchy." : "An owner must create and assign your partner profile before profit appears here."}</p>
        </Card>
      </SidebarShell>
    );
  }

  const metrics = await getPartnerMetrics(partnerProfile.id);

  return (
    <SidebarShell nav={nav} eyebrow="Partner" title="Partner performance">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Attributed revenue" value={currency(metrics.attributedRevenueCents / 100)} change={`${metrics.attributedOrderCount} partner-linked orders`} />
        <MetricCard label="Partner profit" value={currency(metrics.partnerCommissionCents / 100)} change="25% of margin in dollars" />
        <MetricCard label="Consultant payouts" value={currency(metrics.consultantPayoutsByStatus.PENDING / 100)} change="Pending seller payouts" tone="red" />
        <MetricCard label="Assigned consultants" value={`${metrics.consultants.length}`} change="Active seller network" />
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_1fr]">
        <Card>
          <CardHeader><CardTitle>Profit formula</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm text-slate-600">
            <div className="rounded-lg bg-clinic-mist p-4 font-semibold text-clinic-ink">Margin = sale price - internal cost</div>
            <div className="rounded-lg bg-clinic-mist p-4 font-semibold text-clinic-ink">Partner profit = 25% of margin</div>
            <div className="rounded-lg bg-clinic-blush p-4 font-semibold text-clinic-red">Consultant payout is tracked separately</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Partner payout responsibility</CardTitle></CardHeader>
          <CardContent>
            <p className="text-sm leading-6 text-slate-600">
              This workspace only includes sales created by consultants assigned to this partner profile.
              Sales from other partner groups are excluded from revenue, partner profit, and payout queues.
            </p>
          </CardContent>
        </Card>
      </div>
    </SidebarShell>
  );
}
