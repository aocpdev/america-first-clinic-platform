import { Trophy } from "lucide-react";
import { AdminRewardsEditor } from "@/components/rewards/admin-rewards-editor";
import { Card } from "@/components/ui/card";
import { requireRole } from "@/lib/auth/current-user";
import { adminNav } from "@/lib/constants/navigation";
import { SidebarShell } from "@/components/layout/sidebar-shell";
import { getRewardCampaigns, getRewardClaimQueue, getRewardLevelAdminModels, getRewardProducts } from "@/lib/rewards/reward-engine";

export default async function AdminRewardsPage() {
  const user = await requireRole("COMPANY_ADMIN");

  if (!user.companyId) {
    return (
      <SidebarShell nav={adminNav} eyebrow="Go Virtual Health" title="Rewards">
        <Card className="p-6">
          <h2 className="text-xl font-semibold text-clinic-ink">Company profile required</h2>
          <p className="mt-2 text-slate-600">Assign this user to a company before rewards can be configured.</p>
        </Card>
      </SidebarShell>
    );
  }

  const [levels, products, campaigns, claims] = await Promise.all([
    getRewardLevelAdminModels(user.companyId),
    getRewardProducts(user.companyId),
    getRewardCampaigns(user.companyId),
    getRewardClaimQueue(user.companyId)
  ]);
  const serializedLevels = levels.map((level) => ({
    id: level.id,
    level: level.level,
    name: level.name,
    salesThreshold: level.salesThreshold,
    accentColor: level.accentColor,
    projectedRevenueCents: level.projectedRevenueCents,
    projectedMarginCents: level.projectedMarginCents,
    averageRevenueCents: level.averageRevenueCents,
    averageMarginCents: level.averageMarginCents,
    rewards: level.rewards.map((reward) => ({
      id: reward.id,
      title: reward.title,
      description: reward.description,
      imageUrl: reward.imageUrl,
      valueCents: reward.valueCents
    }))
  }));
  const serializedCampaigns = campaigns.map((campaign) => ({
    id: campaign.id,
    title: campaign.title,
    description: campaign.description,
    startsAt: campaign.startsAt.toISOString(),
    endsAt: campaign.endsAt.toISOString(),
    status: campaign.status,
    goalMode: campaign.goalMode,
    windowMode: campaign.windowMode,
    rollingWindowDays: campaign.rollingWindowDays,
    rewardTitle: campaign.rewardTitle,
    rewardDescription: campaign.rewardDescription,
    rewardImageUrl: campaign.rewardImageUrl,
    rewardValueType: campaign.rewardValueType,
    rewardValueCents: campaign.rewardValueCents,
    targetQuantity: campaign.targetQuantity,
    maxWinsPerParticipant: campaign.maxWinsPerParticipant,
    maxTotalClaims: campaign.maxTotalClaims,
    claimCount: campaign.claimCount,
    remainingClaimInventory: campaign.remainingClaimInventory,
    projectedRevenueCents: campaign.projectedRevenueCents,
    projectedMarginCents: campaign.projectedMarginCents,
    totalTargetQuantity: campaign.totalTargetQuantity,
    products: campaign.products.map((item) => ({
      productId: item.productId,
      targetQuantity: item.targetQuantity,
      product: item.product
    }))
  }));
  const serializedClaims = claims.map((claim) => ({
    id: claim.id,
    status: claim.status,
    participantRole: claim.participantRole,
    rewardValueType: claim.rewardValueType,
    rewardValueCents: claim.rewardValueCents,
    completedAt: claim.completedAt.toISOString(),
    redeemedAt: claim.redeemedAt?.toISOString() ?? null,
    user: claim.user,
    campaign: claim.campaign
  }));

  return (
    <SidebarShell nav={adminNav} eyebrow="Go Virtual Health" title="Rewards">
      <div className="space-y-6">
        <Card className="overflow-hidden rounded-[2rem] border-white/80 bg-white p-6 shadow-[0_22px_70px_rgba(7,55,99,0.08)]">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-3xl">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Sales gamification</p>
              <h2 className="mt-2 text-3xl font-semibold tracking-tight text-clinic-ink">Control individual rewards without making admins or partners competitors.</h2>
              <p className="mt-3 text-sm leading-6 text-slate-500">
                Configure personal achievement levels, reward value, images, and timed campaigns while previewing projected revenue and gross margin before launch.
              </p>
            </div>
            <div className="grid size-20 place-items-center rounded-3xl bg-clinic-navy text-white shadow-soft">
              <Trophy className="h-8 w-8" />
            </div>
          </div>
        </Card>

        <AdminRewardsEditor levels={serializedLevels} products={products} campaigns={serializedCampaigns} claims={serializedClaims} />
      </div>
    </SidebarShell>
  );
}
