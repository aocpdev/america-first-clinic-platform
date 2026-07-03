import { RewardDashboard } from "@/components/rewards/reward-dashboard";
import { Card } from "@/components/ui/card";
import { SidebarShell } from "@/components/layout/sidebar-shell";
import { requireApprovedConsultant } from "@/lib/auth/current-user";
import { consultantNav } from "@/lib/constants/navigation";
import { getActiveRewardCampaignProgress, getCompanyRewardLeaderboard, getRewardClaimHistory, getRewardProgress } from "@/lib/rewards/reward-engine";

export default async function ConsultantRewardsPage() {
  const user = await requireApprovedConsultant();

  if (!user.companyId || !user.consultantProfile?.id) {
    return (
      <SidebarShell nav={consultantNav} eyebrow="Agent" title="Rewards">
        <Card className="p-6">
          <h2 className="text-xl font-semibold text-clinic-ink">Agent profile required</h2>
          <p className="mt-2 text-slate-600">Your approved agent profile is required before rewards can be calculated.</p>
        </Card>
      </SidebarShell>
    );
  }

  const agentName = [user.firstName, user.lastName].filter(Boolean).join(" ").trim() || user.email;
  const [progress, leaderboard, campaignProgress, claimHistory] = await Promise.all([
    getRewardProgress({
      companyId: user.companyId,
      agentName,
      avatarUrl: user.avatarUrl,
      consultantProfileId: user.consultantProfile.id
    }),
    getCompanyRewardLeaderboard(user.companyId),
    getActiveRewardCampaignProgress({
      companyId: user.companyId,
      userId: user.id,
      consultantProfileId: user.consultantProfile.id
    }),
    getRewardClaimHistory({ companyId: user.companyId, userId: user.id })
  ]);

  return (
    <SidebarShell nav={consultantNav} eyebrow="Agent" title="Rewards">
      <RewardDashboard {...progress} leaderboard={leaderboard} campaignProgress={campaignProgress} claimHistory={claimHistory} />
    </SidebarShell>
  );
}
