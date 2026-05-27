import { Award, CalendarDays, CheckCircle2, Gift, Lock, Medal, Sparkles, Target, Trophy } from "lucide-react";
import { redeemRewardCampaign } from "@/app/rewards/actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { currency } from "@/lib/utils";

type RewardLevel = {
  id: string;
  level: number;
  name: string;
  salesThreshold: number;
  accentColor: string;
  rewards: Array<{
    id: string;
    title: string;
    description: string | null;
    imageUrl: string | null;
    valueCents: number;
  }>;
};

type LeaderboardRow = {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  role: string;
  salesCount: number;
};

type CampaignProgress = {
  id: string;
  title: string;
  description: string | null;
  startsAt: Date | string;
  endsAt: Date | string;
  rewardTitle: string;
  rewardDescription: string | null;
  rewardImageUrl: string | null;
  rewardValueType: "CASH" | "NON_CASH";
  rewardValueCents: number;
  goalMode: "TOTAL_UNITS" | "PRODUCT_BUNDLE";
  windowMode: "CAMPAIGN_RANGE" | "ROLLING_DAYS";
  rollingWindowDays: number | null;
  soldQuantity: number;
  rawSoldQuantity: number;
  targetQuantity: number;
  revenueCents: number;
  marginCents: number;
  isCompleted: boolean;
  activeWindowStartsAt: Date | string | null;
  activeWindowEndsAt: Date | string | null;
  claimId: string | null;
  claimStatus: "EARNED" | "PAYOUT_PENDING" | "PAYOUT_APPLIED" | "REDEEM_REQUESTED" | "FULFILLED" | null;
  claimRewardValueType: "CASH" | "NON_CASH" | null;
  claimRewardValueCents: number | null;
  progressPercent: number;
  remainingQuantity: number;
  products: Array<{ product: { title: string } }>;
  productProgress: Array<{
    productId: string;
    title: string;
    targetQuantity: number;
    soldQuantity: number;
    remainingQuantity: number;
    isCompleted: boolean;
  }>;
};

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

function formatShortDate(value: Date | string) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(value));
}

function durationLabel(startsAt: Date | string, endsAt: Date | string) {
  const start = new Date(startsAt).getTime();
  const end = new Date(endsAt).getTime();
  const days = Math.max(Math.ceil((end - start) / 86_400_000), 1);

  if (days <= 8) return "Weekly sprint";
  if (days <= 35) return "Monthly goal";
  return `${days}-day challenge`;
}

function campaignWindowLabel(campaign: CampaignProgress) {
  if (campaign.windowMode === "ROLLING_DAYS") {
    const days = Math.max(campaign.rollingWindowDays ?? 1, 1);
    const bestWindow =
      campaign.activeWindowStartsAt && campaign.activeWindowEndsAt
        ? ` · best window ${formatShortDate(campaign.activeWindowStartsAt)} to ${formatShortDate(campaign.activeWindowEndsAt)}`
        : "";
    return `${days}-day rolling sprint${bestWindow}`;
  }

  return `${durationLabel(campaign.startsAt, campaign.endsAt)} · ${formatShortDate(campaign.startsAt)} to ${formatShortDate(campaign.endsAt)}`;
}

function productBundleLabel(campaign: CampaignProgress) {
  if (campaign.goalMode === "PRODUCT_BUNDLE" && campaign.productProgress.length) {
    return campaign.productProgress.map((item) => `${item.targetQuantity} ${item.title}`).join(" + ");
  }

  const names = campaign.products.map((item) => item.product.title);
  if (!names.length) return "Selected products";
  if (campaign.goalMode === "TOTAL_UNITS") {
    const label = names.length <= 2 ? names.join(" or ") : `${names.slice(0, 2).join(" or ")} + ${names.length - 2} more`;
    return `${campaign.targetQuantity} total units from ${label}`;
  }
  if (names.length <= 2) return names.join(" + ");
  return `${names.slice(0, 2).join(" + ")} + ${names.length - 2} more`;
}

function campaignStatusText(campaign: CampaignProgress) {
  if (!campaign.isCompleted) {
    if (campaign.goalMode === "PRODUCT_BUNDLE") return `${campaign.remainingQuantity} required units remaining`;
    return `${campaign.remainingQuantity} more to unlock`;
  }
  if (campaign.rewardValueType === "CASH") {
    return campaign.claimStatus === "PAYOUT_APPLIED" ? "Applied to payout" : "Queued for payout";
  }
  if (campaign.claimStatus === "REDEEM_REQUESTED") return "Redemption requested";
  if (campaign.claimStatus === "FULFILLED") return "Fulfilled";
  return "Unlocked";
}

export function RewardDashboard({
  sellerName,
  avatarUrl,
  salesCount,
  levels,
  currentLevel,
  nextLevel,
  progressPercent,
  salesToNextLevel,
  earnedRewards,
  campaignProgress = [],
  leaderboard = []
}: {
  sellerName: string;
  avatarUrl?: string | null;
  salesCount: number;
  levels: RewardLevel[];
  currentLevel: RewardLevel | null;
  nextLevel: RewardLevel | null;
  progressPercent: number;
  salesToNextLevel: number;
  earnedRewards: Array<{ level: RewardLevel; reward: RewardLevel["rewards"][number] }>;
  campaignProgress?: CampaignProgress[];
  leaderboard?: LeaderboardRow[];
}) {
  const currentReward = currentLevel?.rewards[0] ?? null;
  const nextReward = nextLevel?.rewards[0] ?? null;
  const topSeller = leaderboard[0] ?? null;
  const initials = initialsFor(sellerName) || "AF";

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden rounded-[2rem] border-white/80 bg-white shadow-[0_24px_80px_rgba(7,55,99,0.10)]">
        <div className="grid gap-6 p-6 lg:grid-cols-[1fr_360px] lg:p-8">
          <div className="flex flex-col justify-between rounded-[1.75rem] bg-clinic-navy p-6 text-white shadow-soft">
            <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
              <div className="flex items-center gap-4">
                <div className="relative grid size-24 shrink-0 place-items-center rounded-full border border-white/20 bg-white/10">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt={sellerName} className="size-20 rounded-full object-cover" />
                  ) : (
                    <div className="grid size-20 place-items-center rounded-full bg-white text-2xl font-semibold text-clinic-navy">{initials}</div>
                  )}
                  <div className="absolute -bottom-1 -right-1 grid size-10 place-items-center rounded-full border-4 border-clinic-navy bg-clinic-red text-sm font-bold">
                    {currentLevel?.level ?? 0}
                  </div>
                </div>
                <div>
                  <p className="text-sm font-semibold text-white/70">Your personal reward status</p>
                  <h2 className="mt-1 text-3xl font-semibold">{sellerName}</h2>
                  <p className="mt-2 text-sm font-semibold text-white/80">
                    {currentLevel ? `Level ${currentLevel.level}: ${currentLevel.name}` : "Start with your first captured sale"}
                  </p>
                </div>
              </div>

              <div className="rounded-3xl border border-white/15 bg-white/10 p-4 text-left md:w-44">
                <p className="text-xs font-bold uppercase text-white/60">Captured sales</p>
                <p className="mt-2 text-4xl font-semibold">{salesCount}</p>
              </div>
            </div>

            <div className="mt-8 rounded-3xl border border-white/15 bg-white/10 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-white/70">Next unlock</p>
                  <p className="mt-1 text-lg font-semibold">
                    {nextLevel ? `${salesToNextLevel} sale${salesToNextLevel === 1 ? "" : "s"} to Level ${nextLevel.level}` : "All levels unlocked"}
                  </p>
                </div>
                {nextReward ? (
                  <div className="rounded-full bg-white px-4 py-2 text-sm font-bold text-clinic-navy">{nextReward.title}</div>
                ) : null}
              </div>
              <div className="mt-5 h-4 rounded-full bg-white/15 p-1">
                <div className="h-2 rounded-full bg-white transition-all" style={{ width: `${progressPercent}%` }} />
              </div>
            </div>
          </div>

          <div className="grid gap-4">
            <div className="rounded-[1.75rem] border border-border bg-clinic-mist p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase text-slate-500">Current reward</p>
                  <h3 className="mt-2 text-xl font-semibold text-clinic-ink">{currentReward?.title ?? "No reward unlocked yet"}</h3>
                </div>
                <div className="grid size-12 place-items-center rounded-2xl bg-white text-clinic-red shadow-line">
                  <Gift className="h-5 w-5" />
                </div>
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                {currentReward?.description ?? "Close your first paid order to begin unlocking rewards and moving up the seller levels."}
              </p>
              {currentReward ? <p className="mt-4 text-sm font-bold text-emerald-700">Valued at {money(currentReward.valueCents)}</p> : null}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-[1.5rem] border border-border bg-white p-4 shadow-line">
                <p className="text-xs font-bold uppercase text-slate-500">Active campaigns</p>
                <p className="mt-2 text-3xl font-semibold text-clinic-navy">{campaignProgress.length}</p>
              </div>
              <div className="rounded-[1.5rem] border border-border bg-white p-4 shadow-line">
                <p className="text-xs font-bold uppercase text-slate-500">Top seller</p>
                <p className="mt-2 truncate text-lg font-semibold text-clinic-ink">{topSeller?.name ?? "Pending"}</p>
                <p className="mt-1 text-sm font-semibold text-clinic-navy">{topSeller ? `${topSeller.salesCount} sales` : "No captured sales"}</p>
              </div>
            </div>
          </div>
        </div>
      </Card>

      <Card className="overflow-hidden rounded-[2rem] border-white/80 bg-white shadow-[0_22px_70px_rgba(7,55,99,0.08)]">
        <div className="border-b border-border p-6">
          <div className="flex items-center gap-3">
            <Sparkles className="h-5 w-5 text-clinic-red" />
            <div>
              <p className="text-xs font-bold uppercase text-slate-500">Level path</p>
              <h2 className="mt-1 text-2xl font-semibold text-clinic-ink">Your personal achievement path</h2>
            </div>
          </div>
        </div>
        <div className="grid gap-4 p-6 md:grid-cols-2 xl:grid-cols-3">
          {levels.map((level) => {
            const unlocked = salesCount >= level.salesThreshold;
            const active = currentLevel?.id === level.id;
            const reward = level.rewards[0];

            return (
              <div
                key={level.id}
                className={`rounded-[1.75rem] border p-5 transition ${
                  active
                    ? "border-clinic-navy bg-blue-50 shadow-line"
                    : unlocked
                      ? "border-emerald-100 bg-emerald-50"
                      : "border-border bg-white"
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-xs font-bold uppercase text-slate-500">Level {level.level}</p>
                    <h3 className="mt-1 text-lg font-semibold text-clinic-ink">{level.name}</h3>
                  </div>
                  <div
                    className="grid size-12 shrink-0 place-items-center rounded-2xl text-sm font-bold"
                    style={{ backgroundColor: unlocked ? level.accentColor : "#eef3f8", color: unlocked ? "#ffffff" : "#64748b" }}
                  >
                    {unlocked ? <CheckCircle2 className="h-5 w-5" /> : <Lock className="h-5 w-5" />}
                  </div>
                </div>
                <div className="mt-5 rounded-2xl bg-white/80 p-4 shadow-line">
                  <p className="text-sm font-semibold text-clinic-navy">{level.salesThreshold} captured sales</p>
                  <p className="mt-1 text-sm text-slate-500">{reward?.title ?? "Reward pending"}</p>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_.9fr]">
        <Card className="overflow-hidden rounded-[2rem]">
          <div className="border-b border-border p-6">
            <div className="flex items-center gap-3">
              <CalendarDays className="h-5 w-5 text-clinic-red" />
              <div>
                <p className="text-xs font-bold uppercase text-slate-500">Timed challenges</p>
                <h2 className="mt-1 text-2xl font-semibold text-clinic-ink">Active reward campaigns</h2>
              </div>
            </div>
          </div>
          <div className="grid gap-4 p-6">
            {campaignProgress.length ? (
              campaignProgress.map((campaign) => (
                <div key={campaign.id} className="rounded-[1.75rem] border border-border bg-white p-5 shadow-line">
                  <div className="flex flex-col gap-4 md:flex-row md:items-center">
                    <div className="grid size-20 shrink-0 place-items-center overflow-hidden rounded-3xl bg-clinic-mist">
                      {campaign.rewardImageUrl ? (
                        <img src={campaign.rewardImageUrl} alt={campaign.rewardTitle} className="h-full w-full object-cover" />
                      ) : (
                        <Target className="h-8 w-8 text-clinic-red" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <h3 className="text-lg font-semibold text-clinic-ink">{campaign.title}</h3>
                          <p className="mt-1 text-sm text-slate-500">
                            {campaignWindowLabel(campaign)}
                          </p>
                          <p className="mt-1 text-xs font-semibold text-clinic-navy">{productBundleLabel(campaign)}</p>
                        </div>
                        <span className="rounded-full bg-clinic-mist px-4 py-2 text-sm font-bold text-clinic-navy">
                          {campaign.soldQuantity}/{campaign.targetQuantity}
                        </span>
                      </div>
                      <div className="mt-4 h-4 rounded-full bg-clinic-mist p-1">
                        <div className="h-2 rounded-full bg-clinic-red transition-all" style={{ width: `${campaign.progressPercent}%` }} />
                      </div>
                      {campaign.goalMode === "PRODUCT_BUNDLE" && campaign.productProgress.length ? (
                        <div className="mt-4 grid gap-2 sm:grid-cols-2">
                          {campaign.productProgress.map((item) => (
                            <div
                              key={item.productId}
                              className={`rounded-2xl border px-3 py-2 ${
                                item.isCompleted ? "border-emerald-100 bg-emerald-50" : "border-border bg-clinic-mist"
                              }`}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <p className="truncate text-xs font-bold text-clinic-ink">{item.title}</p>
                                <span className={`text-xs font-bold ${item.isCompleted ? "text-emerald-700" : "text-clinic-navy"}`}>
                                  {item.soldQuantity}/{item.targetQuantity}
                                </span>
                              </div>
                              <div className="mt-2 h-2 rounded-full bg-white">
                                <div
                                  className={`h-2 rounded-full ${item.isCompleted ? "bg-emerald-500" : "bg-clinic-navy"}`}
                                  style={{ width: `${Math.min(Math.round((item.soldQuantity / Math.max(item.targetQuantity, 1)) * 100), 100)}%` }}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : null}
                      <div className="mt-4 flex flex-col gap-3 rounded-2xl bg-emerald-50 p-4 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="text-xs font-bold uppercase text-emerald-700">Reward</p>
                          <p className="mt-1 font-semibold text-emerald-900">
                            {campaign.rewardTitle}
                            {campaign.rewardValueCents > 0 ? ` · ${money(campaign.rewardValueCents)}` : ""}
                          </p>
                          <p className="mt-1 text-xs font-semibold text-emerald-700">
                            {money(campaign.revenueCents)} revenue · {money(campaign.marginCents)} margin
                          </p>
                        </div>
                        <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
                          <p className="text-sm font-semibold text-emerald-700">{campaignStatusText(campaign)}</p>
                          {campaign.isCompleted && campaign.rewardValueType === "NON_CASH" && campaign.claimStatus === "EARNED" && campaign.claimId ? (
                            <form action={redeemRewardCampaign}>
                              <input type="hidden" name="claimId" value={campaign.claimId} />
                              <Button type="submit" variant="accent" size="sm">Redeem</Button>
                            </form>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-3xl border border-dashed border-border bg-clinic-mist p-6 text-sm font-medium text-slate-500">
                No reward campaigns are active right now. Keep closing personal sales to move up your level path.
              </div>
            )}
          </div>
        </Card>

        <Card className="overflow-hidden rounded-[2rem]">
          <div className="border-b border-border p-6">
            <div className="flex items-center gap-3">
              <Trophy className="h-5 w-5 text-clinic-red" />
              <div>
                <p className="text-xs font-bold uppercase text-slate-500">Leaderboard</p>
                <h2 className="mt-1 text-2xl font-semibold text-clinic-ink">Top sellers</h2>
              </div>
            </div>
          </div>
          <div className="space-y-3 p-5">
            {leaderboard.length ? (
              leaderboard.map((row, index) => (
                <div key={row.id} className="flex items-center gap-3 rounded-2xl border border-border bg-white p-3">
                  <div className={`grid size-10 shrink-0 place-items-center rounded-full text-sm font-bold ${index < 3 ? "bg-clinic-red text-white" : "bg-clinic-mist text-clinic-navy"}`}>
                    {index < 3 ? <Medal className="h-4 w-4" /> : index + 1}
                  </div>
                  <div className="grid size-11 shrink-0 place-items-center overflow-hidden rounded-full bg-clinic-navy text-xs font-bold text-white">
                    {row.avatarUrl ? <img src={row.avatarUrl} alt={row.name} className="h-full w-full object-cover" /> : initialsFor(row.name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-clinic-ink">{row.name}</p>
                    <p className="truncate text-xs text-slate-500">{row.role}</p>
                  </div>
                  <p className="text-sm font-bold text-clinic-navy">{row.salesCount}</p>
                </div>
              ))
            ) : (
              <div className="rounded-3xl border border-dashed border-border bg-clinic-mist p-6 text-sm font-medium text-slate-500">
                Personal captured sales will build the leaderboard.
              </div>
            )}
          </div>
        </Card>
      </div>

      <Card className="overflow-hidden rounded-[2rem]">
        <div className="border-b border-border p-6">
          <div className="flex items-center gap-3">
            <Award className="h-5 w-5 text-clinic-red" />
            <div>
              <p className="text-xs font-bold uppercase text-slate-500">Reward vault</p>
              <h2 className="mt-1 text-2xl font-semibold text-clinic-ink">Unlocked rewards</h2>
            </div>
          </div>
        </div>
        <div className="grid gap-5 p-6 md:grid-cols-2 xl:grid-cols-3">
          {earnedRewards.length ? (
            earnedRewards.map(({ level, reward }) => (
              <div
                key={reward.id}
                className="overflow-hidden rounded-[1.75rem] border border-border bg-white shadow-[0_18px_50px_rgba(7,55,99,0.08)]"
              >
                <div className="grid aspect-[16/10] place-items-center overflow-hidden bg-clinic-mist">
                  {reward.imageUrl ? (
                    <img src={reward.imageUrl} alt={reward.title} className="h-full w-full object-cover" />
                  ) : (
                    <Award className="h-10 w-10 text-clinic-navy" />
                  )}
                </div>
                <div className="relative bg-white p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-bold uppercase text-slate-500">Level {level.level}</p>
                      <h3 className="mt-1 text-lg font-semibold leading-tight text-clinic-ink">{reward.title}</h3>
                    </div>
                    <div className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-800">
                      {money(reward.valueCents)}
                    </div>
                  </div>
                  {reward.description ? (
                    <p className="mt-3 line-clamp-2 text-sm leading-6 text-slate-500">{reward.description}</p>
                  ) : null}
                  <p className="mt-4 text-sm font-semibold text-emerald-700">Unlocked reward</p>
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-3xl border border-dashed border-border bg-clinic-mist p-6 text-sm font-medium text-slate-500 md:col-span-2 xl:col-span-3">
              Your first unlocked reward will appear here after a captured sale.
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
