import { MetricCard } from "@/components/dashboard/metric-card";
import { SidebarShell } from "@/components/layout/sidebar-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { partnerNav } from "@/lib/constants/navigation";
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
  const partnerProfile = await getPartnerProfile(user.id);

  if (!partnerProfile) {
    return (
      <SidebarShell nav={partnerNav} eyebrow="Partner" title="Partner dashboard">
        <Card className="p-6">
          <h2 className="text-xl font-semibold text-clinic-ink">Partner profile not configured</h2>
          <p className="mt-2 text-slate-600">An owner must create and assign your partner profile before commissions appear here.</p>
        </Card>
      </SidebarShell>
    );
  }

  const metrics = await getPartnerMetrics(partnerProfile.id);

  return (
    <SidebarShell nav={partnerNav} eyebrow="Partner" title="Partner performance">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Partner commission" value={currency(metrics.partnerCommissionCents / 100)} change="50% of the 25% margin pool" />
        <MetricCard label="Consultant payouts" value={currency(metrics.consultantPayoutsByStatus.PENDING / 100)} change="Pending partner-paid payouts" tone="red" />
        <MetricCard label="Gross margin tracked" value={currency(metrics.grossMarginCents / 100)} change="Across attributed sales" tone="green" />
        <MetricCard label="Assigned consultants" value={`${metrics.consultants.length}`} change="Active seller network" />
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_1fr]">
        <Card>
          <CardHeader><CardTitle>Commission formula</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm text-slate-600">
            <div className="rounded-lg bg-clinic-mist p-4 font-semibold text-clinic-ink">Margin = sale price - internal cost</div>
            <div className="rounded-lg bg-clinic-mist p-4 font-semibold text-clinic-ink">Commission pool = 25% of margin</div>
            <div className="rounded-lg bg-clinic-blush p-4 font-semibold text-clinic-red">Partner 50% / Consultant 50%</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Partner payout responsibility</CardTitle></CardHeader>
          <CardContent>
            <p className="text-sm leading-6 text-slate-600">
              The owner can see the full split. The partner sees total partner commission and the consultant
              payout queue because the partner is responsible for paying assigned sellers.
            </p>
          </CardContent>
        </Card>
      </div>
    </SidebarShell>
  );
}
