import { Award, CalendarDays, Gift, Lock, Medal, Trophy } from "lucide-react";
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
  soldQuantity: number;
  targetQuantity: number;
  progressPercent: number;
  remainingQuantity: number;
  products: Array<{ product: { title: string } }>;
};

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
  leaderboard = [],
  showAdminSummary = false
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
  showAdminSummary?: boolean;
}) {
  const initials = sellerName
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden rounded-[2rem] border-white/80 bg-white shadow-[0_22px_70px_rgba(7,55,99,0.08)]">
        <div className="grid gap-8 p-6 lg:grid-cols-[340px_1fr] lg:p-8">
          <div className="flex flex-col items-center justify-center text-center">
            <div className="relative">
              <div className="grid size-44 place-items-center rounded-full border-[10px] border-clinic-mist bg-white shadow-inner">
                {avatarUrl ? (
                  <img src={avatarUrl} alt={sellerName} className="size-36 rounded-full object-cover" />
                ) : (
                  <div className="grid size-36 place-items-center rounded-full bg-clinic-navy text-4xl font-semibold text-white">
                    {initials || "AF"}
                  </div>
                )}
              </div>
              <div className="absolute bottom-2 right-2 grid size-14 place-items-center rounded-full bg-clinic-navy text-xl font-semibold text-white shadow-soft">
                {currentLevel?.level ?? 0}
              </div>
            </div>
            <p className="mt-5 text-2xl font-semibold tracking-tight text-clinic-ink">{sellerName}</p>
            <p className="mt-1 text-sm font-bold text-clinic-navy">
              {currentLevel ? `Level ${currentLevel.level} - ${currentLevel.name}` : "No level yet"}
            </p>
            <p className="mt-1 text-sm text-slate-500">
              {nextLevel ? `${salesToNextLevel} captured sales to level up` : "Top level unlocked"}
            </p>
            <div className="mt-5 w-full max-w-xs rounded-full bg-clinic-mist p-1">
              <div className="h-3 rounded-full bg-clinic-navy transition-all" style={{ width: `${progressPercent}%` }} />
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            {levels.map((level) => {
              const unlocked = salesCount >= level.salesThreshold;
              const active = currentLevel?.id === level.id;

              return (
                <div
                  key={level.id}
                  className={`flex min-w-0 items-start gap-4 rounded-3xl border p-4 transition ${
                    active
                      ? "border-clinic-navy bg-blue-50/60 shadow-line"
                      : unlocked
                        ? "border-emerald-100 bg-emerald-50/50"
                        : "border-border bg-white"
                  }`}
                >
                  <div
                    className="grid size-12 shrink-0 place-items-center rounded-full text-sm font-bold"
                    style={{ backgroundColor: unlocked ? level.accentColor : "#eef3f8", color: unlocked ? "#ffffff" : "#64748b" }}
                  >
                    {unlocked ? level.level : <Lock className="h-4 w-4" />}
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-clinic-ink">Level {level.level} - {level.name}</p>
                    <p className="mt-1 text-sm text-slate-500">
                      {level.salesThreshold} captured sale{level.salesThreshold === 1 ? "" : "s"} required
                    </p>
                    {level.rewards[0] ? (
                      <p className="mt-2 text-sm font-semibold text-clinic-navy">{level.rewards[0].title}</p>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </Card>

      {campaignProgress.length ? (
        <Card className="overflow-hidden rounded-[2rem]">
          <div className="border-b border-border p-6">
            <div className="flex items-center gap-3">
              <CalendarDays className="h-5 w-5 text-clinic-red" />
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Weekly rewards</p>
                <h2 className="mt-1 text-2xl font-semibold tracking-tight text-clinic-ink">Active campaigns</h2>
              </div>
            </div>
          </div>
          <div className="grid gap-4 p-6 lg:grid-cols-2">
            {campaignProgress.map((campaign) => (
              <div key={campaign.id} className="overflow-hidden rounded-3xl border border-border bg-white shadow-line">
                <div className="flex items-start gap-4 p-5">
                  <div className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-2xl bg-clinic-mist">
                    {campaign.rewardImageUrl ? (
                      <img src={campaign.rewardImageUrl} alt={campaign.rewardTitle} className="h-full w-full object-cover" />
                    ) : (
                      <Gift className="h-7 w-7 text-clinic-red" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-semibold text-clinic-ink">{campaign.title}</p>
                      <span className="rounded-full bg-clinic-mist px-3 py-1 text-xs font-bold text-clinic-navy">
                        {campaign.soldQuantity}/{campaign.targetQuantity}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-slate-500">
                      {campaign.remainingQuantity > 0
                        ? `${campaign.remainingQuantity} more eligible sale${campaign.remainingQuantity === 1 ? "" : "s"} to unlock`
                        : "Reward unlocked"}
                    </p>
                    <div className="mt-4 h-3 rounded-full bg-clinic-mist">
                      <div className="h-3 rounded-full bg-clinic-red transition-all" style={{ width: `${campaign.progressPercent}%` }} />
                    </div>
                    <div className="mt-4 rounded-2xl bg-emerald-50 p-3">
                      <p className="text-xs font-bold uppercase tracking-[0.12em] text-emerald-700">Reward</p>
                      <p className="mt-1 text-sm font-semibold text-emerald-900">
                        {campaign.rewardTitle}
                        {campaign.rewardValueCents > 0 ? ` · ${currency(campaign.rewardValueCents / 100)}` : ""}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1fr_.8fr]">
        <Card className="overflow-hidden rounded-[2rem]">
          <div className="border-b border-border p-6">
            <div className="flex items-center gap-3">
              <Gift className="h-5 w-5 text-clinic-red" />
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Earned rewards</p>
                <h2 className="mt-1 text-2xl font-semibold tracking-tight text-clinic-ink">Unlocked by captured sales</h2>
              </div>
            </div>
          </div>
          <div className="grid gap-4 p-6 md:grid-cols-2">
            {earnedRewards.length ? (
              earnedRewards.map(({ level, reward }) => (
                <div key={reward.id} className="overflow-hidden rounded-3xl border border-border bg-white shadow-line">
                  <div className="flex items-center gap-4 p-4">
                    <div className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-2xl bg-clinic-mist">
                      {reward.imageUrl ? (
                        <img src={reward.imageUrl} alt={reward.title} className="h-full w-full object-cover" />
                      ) : (
                        <Award className="h-7 w-7 text-clinic-navy" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold uppercase tracking-[0.14em] text-slate-500">Level {level.level}</p>
                      <p className="mt-1 font-semibold text-clinic-ink">{reward.title}</p>
                      <p className="mt-1 text-sm font-semibold text-emerald-700">Valued at {currency(reward.valueCents / 100)}</p>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-3xl border border-dashed border-border bg-clinic-mist p-6 text-sm font-medium text-slate-500 md:col-span-2">
                Rewards unlock after the first captured sale.
              </div>
            )}
          </div>
        </Card>

        <Card className="overflow-hidden rounded-[2rem]">
          <div className="border-b border-border p-6">
            <div className="flex items-center gap-3">
              <Trophy className="h-5 w-5 text-clinic-red" />
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Leaderboard</p>
                <h2 className="mt-1 text-2xl font-semibold tracking-tight text-clinic-ink">{showAdminSummary ? "Seller network" : "Top sellers"}</h2>
              </div>
            </div>
          </div>
          <div className="space-y-3 p-5">
            {leaderboard.length ? (
              leaderboard.map((row, index) => (
                <div key={row.id} className="flex items-center gap-3 rounded-2xl border border-border bg-white p-3">
                  <div className="grid size-9 shrink-0 place-items-center rounded-full bg-clinic-mist text-sm font-bold text-clinic-navy">
                    {index < 3 ? <Medal className="h-4 w-4" /> : index + 1}
                  </div>
                  <div className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-full bg-clinic-navy text-xs font-bold text-white">
                    {row.avatarUrl ? <img src={row.avatarUrl} alt={row.name} className="h-full w-full object-cover" /> : row.name.slice(0, 2).toUpperCase()}
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
                Captured sales will build the leaderboard.
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
