import { RewardDashboard } from "@/components/rewards/reward-dashboard";
import { Card } from "@/components/ui/card";
import { SidebarShell } from "@/components/layout/sidebar-shell";
import { requirePartner } from "@/lib/auth/current-user";
import { groupLeaderNav, partnerNav } from "@/lib/constants/navigation";
import { getCompanyRewardLeaderboard, getRewardProgress } from "@/lib/rewards/reward-engine";

export default async function PartnerRewardsPage() {
  const user = await requirePartner();
  const isGroupLeader = user.role === "GROUP_LEADER";
  const nav = isGroupLeader ? groupLeaderNav : partnerNav;

  if (!user.companyId || (!user.partnerProfile?.id && !user.groupLeaderProfile?.id)) {
    return (
      <SidebarShell nav={nav} eyebrow={isGroupLeader ? "Group leader" : "Partner"} title="Rewards">
        <Card className="p-6">
          <h2 className="text-xl font-semibold text-clinic-ink">Seller profile required</h2>
          <p className="mt-2 text-slate-600">Your partner or group leader profile is required before rewards can be calculated.</p>
        </Card>
      </SidebarShell>
    );
  }

  const sellerName =
    user.partnerProfile?.companyName ||
    user.partnerProfile?.displayName ||
    user.groupLeaderProfile?.displayName ||
    [user.firstName, user.lastName].filter(Boolean).join(" ").trim() ||
    user.email;

  const [progress, leaderboard] = await Promise.all([
    getRewardProgress({
      companyId: user.companyId,
      sellerName,
      avatarUrl: user.avatarUrl,
      partnerProfileId: user.partnerProfile?.id,
      groupLeaderProfileId: user.groupLeaderProfile?.id
    }),
    getCompanyRewardLeaderboard(user.companyId)
  ]);

  return (
    <SidebarShell nav={nav} eyebrow={isGroupLeader ? "Group leader" : "Partner"} title="Rewards">
      <RewardDashboard {...progress} leaderboard={leaderboard} />
    </SidebarShell>
  );
}
