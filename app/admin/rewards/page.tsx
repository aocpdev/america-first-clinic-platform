import { Trophy } from "lucide-react";
import { AdminRewardsEditor } from "@/components/rewards/admin-rewards-editor";
import { RewardDashboard } from "@/components/rewards/reward-dashboard";
import { Card } from "@/components/ui/card";
import { requireRole } from "@/lib/auth/current-user";
import { adminNav } from "@/lib/constants/navigation";
import { SidebarShell } from "@/components/layout/sidebar-shell";
import { getCompanyRewardLeaderboard, getRewardLevels } from "@/lib/rewards/reward-engine";

export default async function AdminRewardsPage() {
  const user = await requireRole("COMPANY_ADMIN");

  if (!user.companyId) {
    return (
      <SidebarShell nav={adminNav} eyebrow="Admin" title="Rewards">
        <Card className="p-6">
          <h2 className="text-xl font-semibold text-clinic-ink">Company profile required</h2>
          <p className="mt-2 text-slate-600">Assign this user to a company before rewards can be configured.</p>
        </Card>
      </SidebarShell>
    );
  }

  const [levels, leaderboard] = await Promise.all([
    getRewardLevels(user.companyId),
    getCompanyRewardLeaderboard(user.companyId)
  ]);

  return (
    <SidebarShell nav={adminNav} eyebrow="Admin" title="Rewards">
      <div className="space-y-6">
        <Card className="overflow-hidden rounded-[2rem] border-white/80 bg-white p-6 shadow-[0_22px_70px_rgba(7,55,99,0.08)]">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-3xl">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Sales gamification</p>
              <h2 className="mt-2 text-3xl font-semibold tracking-tight text-clinic-ink">Reward captured sales without touching commissions.</h2>
              <p className="mt-3 text-sm leading-6 text-slate-500">
                Levels are based on paid/captured sales. Admins control each threshold, reward, image, and estimated value.
              </p>
            </div>
            <div className="grid size-20 place-items-center rounded-3xl bg-clinic-navy text-white shadow-soft">
              <Trophy className="h-8 w-8" />
            </div>
          </div>
        </Card>

        <RewardDashboard
          sellerName="America First Clinic"
          salesCount={leaderboard.reduce((sum, row) => sum + row.salesCount, 0)}
          levels={levels}
          currentLevel={null}
          nextLevel={levels[0] ?? null}
          progressPercent={0}
          salesToNextLevel={0}
          earnedRewards={[]}
          leaderboard={leaderboard}
          showAdminSummary
        />

        <AdminRewardsEditor levels={levels} />
      </div>
    </SidebarShell>
  );
}
