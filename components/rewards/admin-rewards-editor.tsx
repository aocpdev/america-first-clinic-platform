"use client";

import { useMemo, useState } from "react";
import { CalendarDays, Gift, Pencil, Plus, Settings2, Target, Trophy } from "lucide-react";
import { saveRewardCampaign, saveRewardLevelBundle } from "@/app/admin/rewards/actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { currency } from "@/lib/utils";

type RewardLevel = {
  id: string;
  level: number;
  name: string;
  salesThreshold: number;
  accentColor: string;
  projectedRevenueCents: number;
  projectedMarginCents: number;
  averageRevenueCents: number;
  averageMarginCents: number;
  rewards: Array<{
    id: string;
    title: string;
    description: string | null;
    imageUrl: string | null;
    valueCents: number;
  }>;
};

type RewardProduct = {
  id: string;
  title: string;
  priceCents: number;
  internalCostCents: number;
  category: { name: string };
};

type RewardCampaign = {
  id: string;
  title: string;
  description: string | null;
  startsAt: Date | string;
  endsAt: Date | string;
  status: "DRAFT" | "ACTIVE" | "PAUSED" | "COMPLETED";
  rewardTitle: string;
  rewardDescription: string | null;
  rewardImageUrl: string | null;
  rewardValueType: "CASH" | "NON_CASH";
  rewardValueCents: number;
  projectedRevenueCents: number;
  projectedMarginCents: number;
  totalTargetQuantity: number;
  products: Array<{
    productId: string;
    targetQuantity: number;
    product: RewardProduct;
  }>;
};

function money(cents: number) {
  return currency(cents / 100);
}

function dateInputValue(value: Date | string) {
  const date = new Date(value);
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60000).toISOString().slice(0, 16);
}

function defaultCampaignStart() {
  const date = new Date();
  date.setHours(8, 0, 0, 0);
  return dateInputValue(date);
}

function defaultCampaignEnd() {
  const date = new Date();
  date.setDate(date.getDate() + 30);
  date.setHours(23, 59, 0, 0);
  return dateInputValue(date);
}

function formatDateRange(startsAt: Date | string, endsAt: Date | string) {
  const formatter = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" });
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

function LevelModal({ level, onClose }: { level: RewardLevel; onClose: () => void }) {
  const reward = level.rewards[0];

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-clinic-ink/30 px-4 py-6 backdrop-blur-sm">
      <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-[2rem] border border-white/80 bg-white shadow-[0_30px_90px_rgba(7,55,99,0.22)]">
        <div className="flex items-start justify-between gap-4 border-b border-border p-6">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-clinic-red">Level {level.level}</p>
            <h3 className="mt-1 text-2xl font-semibold tracking-tight text-clinic-ink">Edit level and reward</h3>
            <p className="mt-2 text-sm leading-6 text-slate-500">Update the seller milestone, reward details, image, and visible value.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-full border border-border px-4 py-2 text-sm font-semibold text-clinic-navy">
            Close
          </button>
        </div>

        <form action={saveRewardLevelBundle} className="space-y-5 p-6">
          <input type="hidden" name="levelId" value={level.id} />
          {reward ? <input type="hidden" name="rewardId" value={reward.id} /> : null}
          <div className="grid gap-4 md:grid-cols-[1fr_160px_150px]">
            <label className="space-y-2">
              <span className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Level name</span>
              <Input name="name" defaultValue={level.name} />
            </label>
            <label className="space-y-2">
              <span className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Sales needed</span>
              <Input name="salesThreshold" type="number" min={0} defaultValue={level.salesThreshold} />
            </label>
            <label className="space-y-2">
              <span className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Accent</span>
              <Input name="accentColor" defaultValue={level.accentColor} />
            </label>
          </div>

          <div className="grid gap-4 rounded-3xl bg-clinic-mist p-4 md:grid-cols-2">
            <div className="rounded-2xl bg-white p-4 shadow-line">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Projected gross revenue</p>
              <p className="mt-2 text-2xl font-semibold text-clinic-navy">{money(level.projectedRevenueCents)}</p>
              <p className="mt-1 text-xs text-slate-500">Based on average active product price.</p>
            </div>
            <div className="rounded-2xl bg-emerald-50 p-4 shadow-line">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-emerald-700">Projected gross margin</p>
              <p className="mt-2 text-2xl font-semibold text-emerald-800">{money(level.projectedMarginCents)}</p>
              <p className="mt-1 text-xs text-emerald-700">Based on price minus internal cost.</p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2">
              <span className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Reward title</span>
              <Input name="rewardTitle" defaultValue={reward?.title ?? ""} placeholder="Reward title" />
            </label>
            <label className="space-y-2">
              <span className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Valued at</span>
              <Input name="rewardValueDollars" type="number" min={0} step="0.01" defaultValue={reward ? reward.valueCents / 100 : 0} />
            </label>
            <label className="space-y-2 md:col-span-2">
              <span className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Image URL</span>
              <Input name="rewardImageUrl" defaultValue={reward?.imageUrl ?? ""} placeholder="Optional image URL" />
            </label>
            <label className="space-y-2 md:col-span-2">
              <span className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Description</span>
              <textarea
                name="rewardDescription"
                defaultValue={reward?.description ?? ""}
                className="min-h-28 w-full rounded-2xl border border-input bg-white px-4 py-3 text-sm text-clinic-ink shadow-line outline-none transition focus:ring-2 focus:ring-ring"
              />
            </label>
          </div>

          <div className="flex justify-end">
            <Button type="submit" variant="accent">Save level</Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function CampaignModal({
  campaign,
  products,
  onClose
}: {
  campaign?: RewardCampaign;
  products: RewardProduct[];
  onClose: () => void;
}) {
  const selected = new Set(campaign?.products.map((item) => item.productId) ?? []);
  const campaignQuantity = (productId: string) => campaign?.products.find((item) => item.productId === productId)?.targetQuantity ?? 1;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-clinic-ink/30 px-4 py-6 backdrop-blur-sm">
      <div className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-[2rem] border border-white/80 bg-white shadow-[0_30px_90px_rgba(7,55,99,0.22)]">
        <div className="flex items-start justify-between gap-4 border-b border-border p-6">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-clinic-red">Timed campaign</p>
            <h3 className="mt-1 text-2xl font-semibold tracking-tight text-clinic-ink">{campaign ? "Edit reward campaign" : "Create reward campaign"}</h3>
            <p className="mt-2 text-sm leading-6 text-slate-500">Choose products, quantities, a custom date window, and the reward sellers unlock.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-full border border-border px-4 py-2 text-sm font-semibold text-clinic-navy">
            Close
          </button>
        </div>

        <form action={saveRewardCampaign} className="space-y-5 p-6">
          {campaign ? <input type="hidden" name="campaignId" value={campaign.id} /> : null}
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2">
              <span className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Campaign name</span>
              <Input name="title" defaultValue={campaign?.title ?? ""} placeholder="B-12 Spring Push" />
            </label>
            <label className="space-y-2">
              <span className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Status</span>
              <select name="status" defaultValue={campaign?.status ?? "ACTIVE"} className="h-12 w-full rounded-2xl border border-input bg-white px-4 text-sm font-semibold text-clinic-ink shadow-line outline-none focus:ring-2 focus:ring-ring">
                <option value="ACTIVE">Active</option>
                <option value="DRAFT">Draft</option>
                <option value="PAUSED">Paused</option>
                <option value="COMPLETED">Completed</option>
              </select>
            </label>
            <label className="space-y-2">
              <span className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Starts</span>
              <Input name="startsAt" type="datetime-local" defaultValue={campaign ? dateInputValue(campaign.startsAt) : defaultCampaignStart()} />
            </label>
            <label className="space-y-2">
              <span className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Ends</span>
              <Input name="endsAt" type="datetime-local" defaultValue={campaign ? dateInputValue(campaign.endsAt) : defaultCampaignEnd()} />
            </label>
            <label className="space-y-2 md:col-span-2">
              <span className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Description</span>
              <textarea name="description" defaultValue={campaign?.description ?? ""} className="min-h-20 w-full rounded-2xl border border-input bg-white px-4 py-3 text-sm text-clinic-ink shadow-line outline-none focus:ring-2 focus:ring-ring" />
            </label>
          </div>

          <div className="rounded-3xl border border-border bg-clinic-mist p-4">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-clinic-red" />
              <p className="text-sm font-semibold text-clinic-ink">Eligible products and targets</p>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {products.map((product) => {
                const marginCents = Math.max(product.priceCents - product.internalCostCents, 0);
                return (
                  <label key={product.id} className="grid gap-3 rounded-2xl border border-border bg-white p-4 shadow-line">
                    <div className="flex items-start gap-3">
                      <input name="productId" value={product.id} type="checkbox" defaultChecked={selected.has(product.id)} className="mt-1 size-5 rounded border-slate-300" />
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-clinic-ink">{product.title}</p>
                        <p className="text-sm text-slate-500">{product.category.name}</p>
                        <p className="mt-2 text-sm font-semibold text-emerald-700">
                          {money(product.priceCents)} sale / {money(marginCents)} margin
                        </p>
                      </div>
                    </div>
                    <Input name={`targetQuantity:${product.id}`} type="number" min={1} defaultValue={campaignQuantity(product.id)} placeholder="Target units" />
                  </label>
                );
              })}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2">
              <span className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Reward title</span>
              <Input name="rewardTitle" defaultValue={campaign?.rewardTitle ?? ""} placeholder="Reward name" />
            </label>
            <label className="space-y-2">
              <span className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Reward type</span>
              <select name="rewardValueType" defaultValue={campaign?.rewardValueType ?? "NON_CASH"} className="h-12 w-full rounded-2xl border border-input bg-white px-4 text-sm font-semibold text-clinic-ink shadow-line outline-none focus:ring-2 focus:ring-ring">
                <option value="NON_CASH">Non-cash reward</option>
                <option value="CASH">Cash reward</option>
              </select>
            </label>
            <label className="space-y-2">
              <span className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Valued at</span>
              <Input name="rewardValueDollars" type="number" min={0} step="0.01" defaultValue={campaign ? campaign.rewardValueCents / 100 : 0} />
            </label>
            <label className="space-y-2">
              <span className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Image URL</span>
              <Input name="rewardImageUrl" defaultValue={campaign?.rewardImageUrl ?? ""} placeholder="Optional image URL" />
            </label>
            <label className="space-y-2 md:col-span-2">
              <span className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Reward details</span>
              <textarea name="rewardDescription" defaultValue={campaign?.rewardDescription ?? ""} className="min-h-20 w-full rounded-2xl border border-input bg-white px-4 py-3 text-sm text-clinic-ink shadow-line outline-none focus:ring-2 focus:ring-ring" />
            </label>
          </div>

          <div className="flex justify-end">
            <Button type="submit" variant="accent">{campaign ? "Save campaign" : "Create campaign"}</Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function AdminRewardsEditor({
  levels,
  products,
  campaigns
}: {
  levels: RewardLevel[];
  products: RewardProduct[];
  campaigns: RewardCampaign[];
}) {
  const [editingLevel, setEditingLevel] = useState<RewardLevel | null>(null);
  const [editingCampaign, setEditingCampaign] = useState<RewardCampaign | null | "new">(null);
  const totals = useMemo(
    () => ({
      levelMargin: levels.reduce((sum, level) => sum + level.projectedMarginCents, 0),
      campaignMargin: campaigns.reduce((sum, campaign) => sum + campaign.projectedMarginCents, 0),
      activeCampaigns: campaigns.filter((campaign) => campaign.status === "ACTIVE").length
    }),
    [levels, campaigns]
  );

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden rounded-[2rem] border-white/80 bg-white shadow-[0_22px_70px_rgba(7,55,99,0.08)]">
        <div className="grid gap-4 p-6 md:grid-cols-3">
          <div className="rounded-3xl bg-clinic-mist p-5">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Active campaigns</p>
            <p className="mt-2 text-3xl font-semibold text-clinic-navy">{totals.activeCampaigns}</p>
          </div>
          <div className="rounded-3xl bg-emerald-50 p-5">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-700">Projected campaign margin</p>
            <p className="mt-2 text-3xl font-semibold text-emerald-800">{money(totals.campaignMargin)}</p>
          </div>
          <div className="rounded-3xl bg-white p-5 shadow-line">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Configured levels</p>
            <p className="mt-2 text-3xl font-semibold text-clinic-navy">{levels.length}</p>
          </div>
        </div>
      </Card>

      <Card className="overflow-hidden rounded-[2rem]">
        <div className="flex flex-col gap-4 border-b border-border p-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <Settings2 className="h-5 w-5 text-clinic-red" />
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Admin configuration</p>
              <h2 className="mt-1 text-2xl font-semibold tracking-tight text-clinic-ink">Reward levels</h2>
              <p className="mt-1 text-sm leading-6 text-slate-500">Each level estimates company revenue and gross margin using active product pricing and cost.</p>
            </div>
          </div>
        </div>

        <div className="grid gap-4 p-6 xl:grid-cols-3">
          {levels.map((level) => {
            const reward = level.rewards[0];
            return (
              <button
                key={level.id}
                type="button"
                onClick={() => setEditingLevel(level)}
                className="group rounded-[1.75rem] border border-border bg-white p-5 text-left shadow-line transition hover:-translate-y-0.5 hover:shadow-[0_20px_50px_rgba(7,55,99,0.10)]"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Level {level.level}</p>
                    <h3 className="mt-1 text-xl font-semibold text-clinic-ink">{level.name}</h3>
                  </div>
                  <div className="grid size-12 place-items-center rounded-2xl text-sm font-bold text-white" style={{ backgroundColor: level.accentColor }}>
                    {level.level}
                  </div>
                </div>
                <div className="mt-5 grid gap-3">
                  <div className="rounded-2xl bg-clinic-mist p-4">
                    <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Captured sales</p>
                    <p className="mt-1 text-2xl font-semibold text-clinic-navy">{level.salesThreshold}</p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl bg-white p-4 shadow-line">
                      <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">Revenue</p>
                      <p className="mt-1 font-semibold text-clinic-navy">{money(level.projectedRevenueCents)}</p>
                    </div>
                    <div className="rounded-2xl bg-emerald-50 p-4">
                      <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-emerald-700">Margin</p>
                      <p className="mt-1 font-semibold text-emerald-800">{money(level.projectedMarginCents)}</p>
                    </div>
                  </div>
                </div>
                <div className="mt-5 flex items-center justify-between gap-3 border-t border-border pt-4">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-clinic-ink">{reward?.title ?? "No reward set"}</p>
                    <p className="text-sm text-slate-500">{reward ? `Valued at ${money(reward.valueCents)}` : "Add a reward"}</p>
                  </div>
                  <Pencil className="h-5 w-5 shrink-0 text-clinic-navy transition group-hover:text-clinic-red" />
                </div>
              </button>
            );
          })}
        </div>
      </Card>

      <Card className="overflow-hidden rounded-[2rem]">
        <div className="flex flex-col gap-4 border-b border-border p-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <CalendarDays className="h-5 w-5 text-clinic-red" />
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Timed reward campaigns</p>
              <h2 className="mt-1 text-2xl font-semibold tracking-tight text-clinic-ink">Campaigns</h2>
              <p className="mt-1 text-sm leading-6 text-slate-500">Create weekly, monthly, or custom-date sales pushes and preview expected company revenue before launch.</p>
            </div>
          </div>
          <Button type="button" variant="accent" onClick={() => setEditingCampaign("new")}>
            <Plus className="mr-2 h-4 w-4" />
            Create campaign
          </Button>
        </div>

        <div className="grid gap-4 p-6 xl:grid-cols-2">
          {campaigns.length ? (
            campaigns.map((campaign) => (
              <button
                type="button"
                key={campaign.id}
                onClick={() => setEditingCampaign(campaign)}
                className="rounded-[1.75rem] border border-border bg-white p-5 text-left shadow-line transition hover:-translate-y-0.5 hover:shadow-[0_20px_50px_rgba(7,55,99,0.10)]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">{campaign.status}</p>
                    <h3 className="mt-1 truncate text-xl font-semibold text-clinic-ink">{campaign.title}</h3>
                    <p className="mt-1 text-sm text-slate-500">
                      {campaign.totalTargetQuantity} target units across {campaign.products.length} product{campaign.products.length === 1 ? "" : "s"}
                    </p>
                    <p className="mt-2 text-sm font-semibold text-clinic-navy">
                      {durationLabel(campaign.startsAt, campaign.endsAt)} · {formatDateRange(campaign.startsAt, campaign.endsAt)}
                    </p>
                  </div>
                  <span className="rounded-full bg-clinic-mist px-3 py-1 text-xs font-bold text-clinic-navy">
                    {campaign.rewardValueType === "CASH" ? "Cash" : "Reward"}
                  </span>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl bg-clinic-mist p-4">
                    <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">Revenue</p>
                    <p className="mt-1 font-semibold text-clinic-navy">{money(campaign.projectedRevenueCents)}</p>
                  </div>
                  <div className="rounded-2xl bg-emerald-50 p-4">
                    <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-emerald-700">Margin</p>
                    <p className="mt-1 font-semibold text-emerald-800">{money(campaign.projectedMarginCents)}</p>
                  </div>
                  <div className="rounded-2xl bg-white p-4 shadow-line">
                    <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">Reward</p>
                    <p className="mt-1 font-semibold text-clinic-navy">{money(campaign.rewardValueCents)}</p>
                  </div>
                </div>
                <div className="mt-4 flex items-center gap-2 border-t border-border pt-4 text-sm font-semibold text-clinic-navy">
                  <Gift className="h-4 w-4 text-clinic-red" />
                  {campaign.rewardTitle}
                </div>
              </button>
            ))
          ) : (
            <div className="rounded-3xl border border-dashed border-border bg-clinic-mist p-6 text-sm font-medium text-slate-500 xl:col-span-2">
              No timed campaigns yet. Create the first one to give consultants a focused sales target.
            </div>
          )}
        </div>
      </Card>

      {editingLevel ? <LevelModal level={editingLevel} onClose={() => setEditingLevel(null)} /> : null}
      {editingCampaign ? (
        <CampaignModal
          campaign={editingCampaign === "new" ? undefined : editingCampaign}
          products={products}
          onClose={() => setEditingCampaign(null)}
        />
      ) : null}
    </div>
  );
}
