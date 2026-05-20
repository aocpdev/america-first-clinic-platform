import { Gift, Settings2 } from "lucide-react";
import { saveReward, updateRewardLevel } from "@/app/admin/rewards/actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

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

export function AdminRewardsEditor({ levels }: { levels: RewardLevel[] }) {
  return (
    <Card className="overflow-hidden rounded-[2rem]">
      <div className="border-b border-border p-6">
        <div className="flex items-center gap-3">
          <Settings2 className="h-5 w-5 text-clinic-red" />
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Admin only</p>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight text-clinic-ink">Reward level settings</h2>
            <p className="mt-1 text-sm leading-6 text-slate-500">Edit sales thresholds, reward names, images, and estimated value.</p>
          </div>
        </div>
      </div>
      <div className="grid gap-4 p-6 xl:grid-cols-2">
        {levels.map((level) => {
          const reward = level.rewards[0];

          return (
            <div key={level.id} className="rounded-3xl border border-border bg-white p-4 shadow-line">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Level {level.level}</p>
                  <h3 className="mt-1 text-lg font-semibold text-clinic-ink">{level.name}</h3>
                </div>
                <div className="grid size-12 place-items-center rounded-2xl text-sm font-bold text-white" style={{ backgroundColor: level.accentColor }}>
                  {level.level}
                </div>
              </div>

              <form action={updateRewardLevel} className="mt-4 grid gap-3 sm:grid-cols-[1fr_140px_120px_auto]">
                <input type="hidden" name="levelId" value={level.id} />
                <Input name="name" defaultValue={level.name} placeholder="Level name" />
                <Input name="salesThreshold" type="number" min={0} defaultValue={level.salesThreshold} placeholder="Sales" />
                <Input name="accentColor" defaultValue={level.accentColor} placeholder="#073763" />
                <Button type="submit" variant="outline">Save</Button>
              </form>

              <form action={saveReward} className="mt-4 rounded-2xl bg-clinic-mist p-4">
                <input type="hidden" name="levelId" value={level.id} />
                {reward ? <input type="hidden" name="rewardId" value={reward.id} /> : null}
                <div className="flex items-center gap-2">
                  <Gift className="h-4 w-4 text-clinic-red" />
                  <p className="text-sm font-semibold text-clinic-ink">Reward</p>
                </div>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <Input name="title" defaultValue={reward?.title ?? ""} placeholder="Reward title" />
                  <Input name="valueDollars" type="number" min={0} step="0.01" defaultValue={reward ? reward.valueCents / 100 : 0} placeholder="Valued at" />
                  <Input name="imageUrl" defaultValue={reward?.imageUrl ?? ""} placeholder="Image URL" className="md:col-span-2" />
                  <textarea
                    name="description"
                    defaultValue={reward?.description ?? ""}
                    placeholder="Short reward description"
                    className="min-h-20 rounded-lg border border-input bg-white px-3 py-2 text-sm text-clinic-ink shadow-line transition placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:col-span-2"
                  />
                </div>
                <Button type="submit" className="mt-3 w-full" variant="accent">Save reward</Button>
              </form>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
