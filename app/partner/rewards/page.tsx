import { CalendarDays, Medal, Trophy } from "lucide-react";
import { Card } from "@/components/ui/card";
import { SidebarShell } from "@/components/layout/sidebar-shell";
import { requirePartner } from "@/lib/auth/current-user";
import { groupLeaderNav, partnerNav } from "@/lib/constants/navigation";
import { getRewardCampaigns, getScopedRewardLeaderboard } from "@/lib/rewards/reward-engine";
import { currency } from "@/lib/utils";

function money(cents: number) {
  return currency(cents / 100);
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

export default async function PartnerRewardsPage() {
  const user = await requirePartner();
  const isGroupLeader = user.role === "GROUP_LEADER";
  const nav = isGroupLeader ? groupLeaderNav : partnerNav;

  if (!user.companyId || (!user.partnerProfile?.id && !user.groupLeaderProfile?.id)) {
    return (
      <SidebarShell nav={nav} eyebrow={isGroupLeader ? "Group leader" : "Partner"} title="Rewards">
        <Card className="p-6">
          <h2 className="text-xl font-semibold text-clinic-ink">Seller profile required</h2>
          <p className="mt-2 text-slate-600">Your partner or group leader profile is required before rewards can be viewed.</p>
        </Card>
      </SidebarShell>
    );
  }

  const [leaderboard, campaigns] = await Promise.all([
    getScopedRewardLeaderboard({
      companyId: user.companyId,
      partnerProfileId: user.partnerProfile?.id,
      groupLeaderProfileId: user.groupLeaderProfile?.id
    }),
    getRewardCampaigns(user.companyId)
  ]);

  return (
    <SidebarShell nav={nav} eyebrow={isGroupLeader ? "Group leader" : "Partner"} title="Rewards">
      <div className="space-y-6">
        <Card className="overflow-hidden rounded-[2rem] border-white/80 bg-white p-6 shadow-[0_22px_70px_rgba(7,55,99,0.08)]">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Network rewards</p>
              <h2 className="mt-2 text-3xl font-semibold tracking-tight text-clinic-ink">Track seller motivation across your team.</h2>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-500">
                Partners and group leaders do not compete in the rewards program. This view shows the eligible consultants underneath your network.
              </p>
            </div>
            <div className="grid size-20 place-items-center rounded-3xl bg-clinic-navy text-white shadow-soft">
              <Trophy className="h-8 w-8" />
            </div>
          </div>
        </Card>

        <div className="grid gap-6 xl:grid-cols-[1fr_.9fr]">
          <Card className="overflow-hidden rounded-[2rem]">
            <div className="border-b border-border p-6">
              <div className="flex items-center gap-3">
                <Medal className="h-5 w-5 text-clinic-red" />
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Eligible consultants</p>
                  <h2 className="mt-1 text-2xl font-semibold tracking-tight text-clinic-ink">Leaderboard</h2>
                </div>
              </div>
            </div>
            <div className="space-y-3 p-5">
              {leaderboard.length ? (
                leaderboard.map((row, index) => (
                  <div key={row.id} className="flex items-center gap-3 rounded-2xl border border-border bg-white p-3">
                    <div className="grid size-9 shrink-0 place-items-center rounded-full bg-clinic-mist text-sm font-bold text-clinic-navy">
                      {index + 1}
                    </div>
                    <div className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-full bg-clinic-navy text-xs font-bold text-white">
                      {row.avatarUrl ? <img src={row.avatarUrl} alt={row.name} className="h-full w-full object-cover" /> : row.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-clinic-ink">{row.name}</p>
                      <p className="truncate text-xs text-slate-500">{row.email}</p>
                    </div>
                    <p className="text-sm font-bold text-clinic-navy">{row.salesCount} sales</p>
                  </div>
                ))
              ) : (
                <div className="rounded-3xl border border-dashed border-border bg-clinic-mist p-6 text-sm font-medium text-slate-500">
                  Captured consultant sales will appear here.
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
              {campaigns.filter((campaign) => campaign.status === "ACTIVE").length ? (
                campaigns
                  .filter((campaign) => campaign.status === "ACTIVE")
                  .map((campaign) => (
                    <div key={campaign.id} className="rounded-3xl border border-border bg-white p-4 shadow-line">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-clinic-ink">{campaign.title}</p>
                          <p className="mt-1 text-sm text-slate-500">{campaign.totalTargetQuantity} target units</p>
                          <p className="mt-1 text-sm font-semibold text-clinic-navy">
                            {durationLabel(campaign.startsAt, campaign.endsAt)} · {formatDateRange(campaign.startsAt, campaign.endsAt)}
                          </p>
                        </div>
                        <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">Active</span>
                      </div>
                      <div className="mt-4 grid grid-cols-2 gap-3">
                        <div className="rounded-2xl bg-clinic-mist p-3">
                          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">Revenue</p>
                          <p className="mt-1 font-semibold text-clinic-navy">{money(campaign.projectedRevenueCents)}</p>
                        </div>
                        <div className="rounded-2xl bg-emerald-50 p-3">
                          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-emerald-700">Margin</p>
                          <p className="mt-1 font-semibold text-emerald-800">{money(campaign.projectedMarginCents)}</p>
                        </div>
                      </div>
                    </div>
                  ))
              ) : (
                <div className="rounded-3xl border border-dashed border-border bg-clinic-mist p-6 text-sm font-medium text-slate-500">
                  No active reward campaigns yet.
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>
    </SidebarShell>
  );
}
