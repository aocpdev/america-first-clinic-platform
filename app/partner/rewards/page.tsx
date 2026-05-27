import { CalendarDays, Medal, Target, Trophy, Users } from "lucide-react";
import { RewardDashboard } from "@/components/rewards/reward-dashboard";
import { Card } from "@/components/ui/card";
import { SidebarShell } from "@/components/layout/sidebar-shell";
import { requirePartner } from "@/lib/auth/current-user";
import { groupLeaderNav, managerNav, partnerNav } from "@/lib/constants/navigation";
import {
  getActiveRewardCampaignProgress,
  getCompanyRewardLeaderboard,
  getRewardCampaigns,
  getRewardLevels,
  getRewardProgress,
  getScopedRewardLeaderboard
} from "@/lib/rewards/reward-engine";
import { currency } from "@/lib/utils";

function money(cents: number) {
  return currency(cents / 100);
}

function initialsFor(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function formatDateRange(startsAt: Date | string, endsAt: Date | string) {
  const formatter = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });
  return `${formatter.format(new Date(startsAt))} - ${formatter.format(new Date(endsAt))}`;
}

function durationLabel(startsAt: Date | string, endsAt: Date | string) {
  const start = new Date(startsAt).getTime();
  const end = new Date(endsAt).getTime();
  const days = Math.max(Math.ceil((end - start) / 86_400_000), 1);

  if (days <= 8) return "Weekly sprint";
  if (days <= 35) return "Monthly campaign";
  return `${days}-day campaign`;
}

function campaignTimingLabel(campaign: {
  startsAt: Date | string;
  endsAt: Date | string;
  windowMode: "CAMPAIGN_RANGE" | "ROLLING_DAYS";
  rollingWindowDays: number | null;
}) {
  if (campaign.windowMode === "ROLLING_DAYS") {
    const days = Math.max(campaign.rollingWindowDays ?? 1, 1);
    return `${days}-day rolling sprint · ${formatDateRange(campaign.startsAt, campaign.endsAt)}`;
  }

  return `${durationLabel(campaign.startsAt, campaign.endsAt)} · ${formatDateRange(campaign.startsAt, campaign.endsAt)}`;
}

function campaignTargetLabel(campaign: {
  goalMode: "TOTAL_UNITS" | "PRODUCT_BUNDLE";
  totalTargetQuantity: number;
  products: Array<{ targetQuantity: number; product: { title: string } }>;
}) {
  if (campaign.goalMode === "PRODUCT_BUNDLE") {
    return campaign.products.map((item) => `${item.targetQuantity} ${item.product.title}`).join(" + ");
  }

  const names = campaign.products.map((item) => item.product.title);
  const productLabel =
    names.length <= 2 ? names.join(" or ") : `${names.slice(0, 2).join(" or ")} + ${names.length - 2} more`;

  return `${campaign.totalTargetQuantity} total units${productLabel ? ` from ${productLabel}` : ""}`;
}

export default async function PartnerRewardsPage() {
  const user = await requirePartner();
  const isGroupLeader = user.role === "GROUP_LEADER";
  const isManager = user.role === "MANAGER";
  const nav = isManager ? managerNav : isGroupLeader ? groupLeaderNav : partnerNav;

  if (!user.companyId || (!user.partnerProfile?.id && !user.managerProfile?.id && !user.groupLeaderProfile?.id)) {
    return (
      <SidebarShell nav={nav} eyebrow={isManager ? "Manager" : isGroupLeader ? "Group leader" : "Partner"} title="Rewards">
        <Card className="p-6">
          <h2 className="text-xl font-semibold text-clinic-ink">Seller profile required</h2>
          <p className="mt-2 text-slate-600">Your partner, manager, or group leader profile is required before rewards can be viewed.</p>
        </Card>
      </SidebarShell>
    );
  }

  if (isManager && user.managerProfile?.id) {
    const sellerName = user.managerProfile.displayName || [user.firstName, user.lastName].filter(Boolean).join(" ").trim() || user.email;
    const [progress, leaderboard, campaignProgress] = await Promise.all([
      getRewardProgress({
        companyId: user.companyId,
        sellerName,
        avatarUrl: user.avatarUrl,
        managerProfileId: user.managerProfile.id
      }),
      getCompanyRewardLeaderboard(user.companyId),
      getActiveRewardCampaignProgress({
        companyId: user.companyId,
        userId: user.id,
        managerProfileId: user.managerProfile.id
      })
    ]);

    return (
      <SidebarShell nav={nav} eyebrow="Manager" title="Rewards">
        <RewardDashboard {...progress} leaderboard={leaderboard} campaignProgress={campaignProgress} />
      </SidebarShell>
    );
  }

  if (isGroupLeader && user.groupLeaderProfile?.id) {
    const sellerName = user.groupLeaderProfile.displayName || [user.firstName, user.lastName].filter(Boolean).join(" ").trim() || user.email;
    const [progress, leaderboard, campaignProgress] = await Promise.all([
      getRewardProgress({
        companyId: user.companyId,
        sellerName,
        avatarUrl: user.avatarUrl,
        groupLeaderProfileId: user.groupLeaderProfile.id
      }),
      getCompanyRewardLeaderboard(user.companyId),
      getActiveRewardCampaignProgress({
        companyId: user.companyId,
        userId: user.id,
        groupLeaderProfileId: user.groupLeaderProfile.id
      })
    ]);

    return (
      <SidebarShell nav={nav} eyebrow="Group leader" title="Rewards">
        <RewardDashboard {...progress} leaderboard={leaderboard} campaignProgress={campaignProgress} />
      </SidebarShell>
    );
  }

  const [networkRows, campaigns, levels] = await Promise.all([
    getScopedRewardLeaderboard({
      companyId: user.companyId,
      partnerProfileId: user.partnerProfile?.id
    }),
    getRewardCampaigns(user.companyId),
    getRewardLevels(user.companyId)
  ]);

  const activeCampaigns = campaigns.filter((campaign) => campaign.isLive);
  const totalSales = networkRows.reduce((sum, row) => sum + row.salesCount, 0);
  const topSeller = networkRows[0] ?? null;

  return (
    <SidebarShell nav={nav} eyebrow="Partner" title="Rewards">
      <div className="space-y-6">
        <Card className="overflow-hidden rounded-[2rem] border-white/80 bg-white shadow-[0_24px_80px_rgba(7,55,99,0.10)]">
          <div className="grid gap-6 p-6 lg:grid-cols-[1fr_360px] lg:p-8">
            <div className="rounded-[1.75rem] bg-clinic-navy p-6 text-white shadow-soft">
              <p className="text-sm font-semibold text-white/70">Partner rewards command center</p>
              <h2 className="mt-2 max-w-3xl text-3xl font-semibold">Track reward progress across your seller network.</h2>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-white/75">
                Partners do not compete for rewards. This page shows each manager, group leader, and consultant as an individual competitor. Team overrides do not count toward reward progress.
              </p>
              <div className="mt-8 grid gap-3 sm:grid-cols-3">
                <div className="rounded-3xl border border-white/15 bg-white/10 p-4">
                  <p className="text-xs font-bold uppercase text-white/60">Eligible people</p>
                  <p className="mt-2 text-3xl font-semibold">{networkRows.length}</p>
                </div>
                <div className="rounded-3xl border border-white/15 bg-white/10 p-4">
                  <p className="text-xs font-bold uppercase text-white/60">Captured sales</p>
                  <p className="mt-2 text-3xl font-semibold">{totalSales}</p>
                </div>
                <div className="rounded-3xl border border-white/15 bg-white/10 p-4">
                  <p className="text-xs font-bold uppercase text-white/60">Live campaigns</p>
                  <p className="mt-2 text-3xl font-semibold">{activeCampaigns.length}</p>
                </div>
              </div>
            </div>

            <div className="grid gap-4">
              <div className="rounded-[1.75rem] border border-border bg-clinic-mist p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase text-slate-500">Top performer</p>
                    <h3 className="mt-2 truncate text-xl font-semibold text-clinic-ink">{topSeller?.name ?? "No captured sales yet"}</h3>
                  </div>
                  <div className="grid size-12 place-items-center rounded-2xl bg-white text-clinic-red shadow-line">
                    <Trophy className="h-5 w-5" />
                  </div>
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-600">
                  {topSeller ? `${topSeller.role} · ${topSeller.salesCount} captured sale${topSeller.salesCount === 1 ? "" : "s"}` : "Seller progress will appear as captured payments come in."}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-[1.5rem] border border-border bg-white p-4 shadow-line">
                  <p className="text-xs font-bold uppercase text-slate-500">Configured levels</p>
                  <p className="mt-2 text-3xl font-semibold text-clinic-navy">{levels.length}</p>
                </div>
                <div className="rounded-[1.5rem] border border-border bg-white p-4 shadow-line">
                  <p className="text-xs font-bold uppercase text-slate-500">People with sales</p>
                  <p className="mt-2 text-3xl font-semibold text-clinic-navy">{networkRows.filter((row) => row.salesCount > 0).length}</p>
                </div>
              </div>
            </div>
          </div>
        </Card>

        <div className="grid gap-6 xl:grid-cols-[1.1fr_.9fr]">
          <Card className="overflow-hidden rounded-[2rem]">
            <div className="border-b border-border p-6">
              <div className="flex items-center gap-3">
                <Users className="h-5 w-5 text-clinic-red" />
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Network progress</p>
                  <h2 className="mt-1 text-2xl font-semibold tracking-tight text-clinic-ink">Sellers moving through rewards</h2>
                </div>
              </div>
            </div>
            <div className="space-y-3 p-5">
              {networkRows.length ? (
                networkRows.map((row, index) => {
                  const nextLevel = levels.find((level) => level.salesThreshold > row.salesCount);
                  const currentLevel = [...levels].reverse().find((level) => row.salesCount >= level.salesThreshold);
                  const previousThreshold = currentLevel?.salesThreshold ?? 0;
                  const nextThreshold = nextLevel?.salesThreshold ?? Math.max(row.salesCount, previousThreshold);
                  const progressPercent = nextLevel
                    ? Math.round((Math.max(Math.min(row.salesCount - previousThreshold, nextThreshold - previousThreshold), 0) / Math.max(nextThreshold - previousThreshold, 1)) * 100)
                    : 100;

                  return (
                    <div key={row.id} className="rounded-[1.5rem] border border-border bg-white p-4 shadow-line">
                      <div className="flex items-center gap-3">
                        <div className="grid size-9 shrink-0 place-items-center rounded-full bg-clinic-mist text-sm font-bold text-clinic-navy">{index + 1}</div>
                        <div className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-2xl bg-clinic-navy text-sm font-bold text-white">
                          {row.avatarUrl ? <img src={row.avatarUrl} alt={row.name} className="h-full w-full object-cover" /> : initialsFor(row.name)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-semibold text-clinic-ink">{row.name}</p>
                          <p className="truncate text-sm text-slate-500">{row.role}</p>
                        </div>
                        <p className="text-sm font-bold text-clinic-navy">{row.salesCount} sales</p>
                      </div>
                      <div className="mt-4 h-3 rounded-full bg-clinic-mist p-1">
                        <div className="h-1.5 rounded-full bg-clinic-red transition-all" style={{ width: `${progressPercent}%` }} />
                      </div>
                      <p className="mt-2 text-xs font-semibold text-slate-500">
                        {nextLevel ? `${Math.max(nextLevel.salesThreshold - row.salesCount, 0)} sale${nextLevel.salesThreshold - row.salesCount === 1 ? "" : "s"} to Level ${nextLevel.level}` : "Top level unlocked"}
                      </p>
                    </div>
                  );
                })
              ) : (
                <div className="rounded-3xl border border-dashed border-border bg-clinic-mist p-6 text-sm font-medium text-slate-500">
                  Eligible managers, group leaders, and consultants will appear here after they are active.
                </div>
              )}
            </div>
          </Card>

          <Card className="overflow-hidden rounded-[2rem]">
            <div className="border-b border-border p-6">
              <div className="flex items-center gap-3">
                <CalendarDays className="h-5 w-5 text-clinic-red" />
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Timed campaigns</p>
                  <h2 className="mt-1 text-2xl font-semibold tracking-tight text-clinic-ink">Current incentives</h2>
                </div>
              </div>
            </div>
            <div className="space-y-3 p-5">
              {activeCampaigns.length ? (
                activeCampaigns.map((campaign) => (
                  <div key={campaign.id} className="rounded-3xl border border-border bg-white p-4 shadow-line">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-clinic-ink">{campaign.title}</p>
                        <p className="mt-1 line-clamp-2 text-sm text-slate-500">{campaignTargetLabel(campaign)}</p>
                        <p className="mt-1 text-sm font-semibold text-clinic-navy">
                          {campaignTimingLabel(campaign)}
                        </p>
                      </div>
                      <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">Live</span>
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-3">
                      <div className="rounded-2xl bg-clinic-mist p-3">
                        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">Revenue target</p>
                        <p className="mt-1 font-semibold text-clinic-navy">{money(campaign.projectedRevenueCents)}</p>
                      </div>
                      <div className="rounded-2xl bg-emerald-50 p-3">
                        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-emerald-700">Margin target</p>
                        <p className="mt-1 font-semibold text-emerald-800">{money(campaign.projectedMarginCents)}</p>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-3xl border border-dashed border-border bg-clinic-mist p-6 text-sm font-medium text-slate-500">
                  No live reward campaigns yet.
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>
    </SidebarShell>
  );
}
