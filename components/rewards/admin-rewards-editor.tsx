"use client";

import { type MouseEvent, useActionState, useEffect, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import { AlertTriangle, CalendarDays, CheckCircle2, DollarSign, Gift, Loader2, Pencil, Plus, Send, Settings2, Target, Trash2, Trophy } from "lucide-react";
import {
  deleteRewardCampaign,
  fulfillRewardClaim,
  markRewardPayoutApplied,
  saveRewardCampaignWithState,
  saveRewardLevelBundle
} from "@/app/admin/rewards/actions";
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
  goalMode: "TOTAL_UNITS" | "PRODUCT_BUNDLE";
  windowMode: "CAMPAIGN_RANGE" | "ROLLING_DAYS";
  rollingWindowDays: number | null;
  rewardTitle: string;
  rewardDescription: string | null;
  rewardImageUrl: string | null;
  rewardValueType: "CASH" | "NON_CASH";
  rewardValueCents: number;
  projectedRevenueCents: number;
  projectedMarginCents: number;
  totalTargetQuantity: number;
  targetQuantity: number;
  maxWinsPerParticipant: number;
  maxTotalClaims: number | null;
  claimCount: number;
  remainingClaimInventory: number | null;
  products: Array<{
    productId: string;
    targetQuantity: number;
    product: RewardProduct;
  }>;
};

type RewardClaim = {
  id: string;
  status: "EARNED" | "PAYOUT_PENDING" | "PAYOUT_APPLIED" | "REDEEM_REQUESTED" | "FULFILLED";
  participantRole: "MANAGER" | "GROUP_LEADER" | "CONSULTANT";
  rewardValueType: "CASH" | "NON_CASH";
  rewardValueCents: number;
  completedAt: string;
  redeemedAt: string | null;
  user: { firstName: string | null; lastName: string | null; email: string; avatarUrl: string | null };
  campaign: {
    id: string;
    title: string;
    rewardTitle: string;
    rewardImageUrl: string | null;
    rewardValueType: "CASH" | "NON_CASH";
  };
};

function money(cents: number) {
  return currency(cents / 100);
}

function personName(person: RewardClaim["user"]) {
  return [person.firstName, person.lastName].filter(Boolean).join(" ").trim() || person.email;
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

function campaignTimingLabel(campaign: Pick<RewardCampaign, "startsAt" | "endsAt" | "windowMode" | "rollingWindowDays">) {
  if (campaign.windowMode === "ROLLING_DAYS") {
    const days = Math.max(campaign.rollingWindowDays ?? 1, 1);
    return `${days}-day rolling sprint · ${formatDateRange(campaign.startsAt, campaign.endsAt)}`;
  }

  return `${durationLabel(campaign.startsAt, campaign.endsAt)} · ${formatDateRange(campaign.startsAt, campaign.endsAt)}`;
}

function rangesOverlap(startA: Date, endA: Date, startB: Date | string, endB: Date | string) {
  return startA <= new Date(endB) && endA >= new Date(startB);
}

function confirmDeleteCampaign(event: MouseEvent<HTMLButtonElement>) {
  if (!window.confirm("Delete this reward campaign? This removes its progress and reward claims from the rewards workspace.")) {
    event.preventDefault();
  }
}

function CampaignSaveButton({ isSaved, isEditing }: { isSaved: boolean; isEditing: boolean }) {
  const { pending } = useFormStatus();

  return (
    <Button
      type="submit"
      variant={isSaved ? "default" : "accent"}
      disabled={pending}
      className={isSaved ? "bg-emerald-700 hover:bg-emerald-700" : undefined}
    >
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : isSaved ? <CheckCircle2 className="h-4 w-4" /> : null}
      {pending ? "Saving campaign..." : isSaved ? "Saved" : isEditing ? "Save campaign" : "Create campaign"}
    </Button>
  );
}

const initialRewardCampaignActionState = {
  ok: false,
  message: null,
  error: null,
  savedAt: null
};

function campaignTargetLabel(campaign: RewardCampaign) {
  if (campaign.goalMode === "PRODUCT_BUNDLE") {
    return `Bundle target: ${campaign.products
      .map((item) => `${item.targetQuantity} ${item.product.title}`)
      .join(" + ")}`;
  }

  return `${campaign.targetQuantity} total units from any of ${campaign.products.length} selected product${
    campaign.products.length === 1 ? "" : "s"
  }`;
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
            <p className="mt-2 text-sm leading-6 text-slate-500">Update the agent milestone, reward details, image, and visible value.</p>
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
  campaigns,
  onClose
}: {
  campaign?: RewardCampaign;
  products: RewardProduct[];
  campaigns: RewardCampaign[];
  onClose: () => void;
}) {
  const initialSelectedProductIds = useMemo(() => campaign?.products.map((item) => item.productId) ?? [], [campaign]);
  const initialQuantities = useMemo(
    () =>
      Object.fromEntries(
        (campaign?.products ?? []).map((item) => [item.productId, String(item.targetQuantity)])
      ) as Record<string, string>,
    [campaign]
  );
  const [goalMode, setGoalMode] = useState<RewardCampaign["goalMode"]>(campaign?.goalMode ?? "TOTAL_UNITS");
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>(initialSelectedProductIds);
  const [targetQuantities, setTargetQuantities] = useState<Record<string, string>>(initialQuantities);
  const [totalTargetQuantity, setTotalTargetQuantity] = useState(String(campaign?.targetQuantity ?? campaign?.totalTargetQuantity ?? 1));
  const [rewardValueDollars, setRewardValueDollars] = useState(campaign ? String(campaign.rewardValueCents / 100) : "0");
  const [maxWinsPerParticipant, setMaxWinsPerParticipant] = useState(String(campaign?.maxWinsPerParticipant ?? 1));
  const [maxTotalClaims, setMaxTotalClaims] = useState(campaign?.maxTotalClaims ? String(campaign.maxTotalClaims) : "");
  const [startsAtValue, setStartsAtValue] = useState(campaign ? dateInputValue(campaign.startsAt) : defaultCampaignStart());
  const [endsAtValue, setEndsAtValue] = useState(campaign ? dateInputValue(campaign.endsAt) : defaultCampaignEnd());
  const [windowMode, setWindowMode] = useState<RewardCampaign["windowMode"]>(campaign?.windowMode ?? "CAMPAIGN_RANGE");
  const [rollingWindowDays, setRollingWindowDays] = useState(String(campaign?.rollingWindowDays ?? 5));
  const [campaignActionState, campaignFormAction] = useActionState(saveRewardCampaignWithState, initialRewardCampaignActionState);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  useEffect(() => {
    if (campaignActionState.ok) {
      setHasUnsavedChanges(false);
    }
  }, [campaignActionState.ok, campaignActionState.savedAt]);

  const campaignQuantity = (productId: string) => targetQuantities[productId] ?? "1";
  const rewardValueCents = Math.max(Math.round((Number(rewardValueDollars) || 0) * 100), 0);
  const selectedProductIdSet = useMemo(() => new Set(selectedProductIds), [selectedProductIds]);
  const projection = useMemo(() => {
    const selectedProducts = products.filter((product) => selectedProductIdSet.has(product.id));

    if (goalMode === "TOTAL_UNITS") {
      const targetUnits = Math.max(Number(totalTargetQuantity) || 1, 1);
      const averageRevenueCents = selectedProducts.length
        ? Math.round(selectedProducts.reduce((sum, product) => sum + product.priceCents, 0) / selectedProducts.length)
        : 0;
      const averageMarginCents = selectedProducts.length
        ? Math.round(
            selectedProducts.reduce((sum, product) => sum + Math.max(product.priceCents - product.internalCostCents, 0), 0) /
              selectedProducts.length
          )
        : 0;

      return {
        units: targetUnits,
        revenueCents: averageRevenueCents * targetUnits,
        marginCents: averageMarginCents * targetUnits
      };
    }

    return selectedProducts.reduce(
      (total, product) => {
        const quantity = Math.max(Number(targetQuantities[product.id] || 1), 1);
        const productMarginCents = Math.max(product.priceCents - product.internalCostCents, 0);

        return {
          units: total.units + quantity,
          revenueCents: total.revenueCents + product.priceCents * quantity,
          marginCents: total.marginCents + productMarginCents * quantity
        };
      },
      { units: 0, revenueCents: 0, marginCents: 0 }
    );
  }, [goalMode, products, selectedProductIdSet, targetQuantities, totalTargetQuantity]);
  const possibleWins = Math.max(Number(maxTotalClaims || maxWinsPerParticipant || 1), 1);
  const projectedNetCents = projection.marginCents - rewardValueCents;
  const projectedMarginExposureCents = projection.marginCents * possibleWins;
  const projectedRewardExposureCents = rewardValueCents * possibleWins;
  const projectedNetExposureCents = projectedMarginExposureCents - projectedRewardExposureCents;
  const isProjectedLoss = projectedNetCents < 0;
  const overlapSummary = useMemo(() => {
    const startsAt = new Date(startsAtValue);
    const endsAt = new Date(endsAtValue);
    if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
      return { overlapping: [] as RewardCampaign[], rewardExposureCents: rewardValueCents, marginExposureCents: projection.marginCents, netExposureCents: projectedNetCents };
    }

    const overlapping = campaigns.filter((item) => {
      if (item.id === campaign?.id) return false;
      if (item.status === "COMPLETED") return false;
      return rangesOverlap(startsAt, endsAt, item.startsAt, item.endsAt);
    });
    const rewardExposureCents = projectedRewardExposureCents + overlapping.reduce((sum, item) => sum + item.rewardValueCents, 0);
    const marginExposureCents = projectedMarginExposureCents + overlapping.reduce((sum, item) => sum + item.projectedMarginCents, 0);
    return {
      overlapping,
      rewardExposureCents,
      marginExposureCents,
      netExposureCents: marginExposureCents - rewardExposureCents
    };
  }, [campaign?.id, campaigns, endsAtValue, projectedMarginExposureCents, projectedNetCents, projectedRewardExposureCents, rewardValueCents, startsAtValue]);

  function toggleProduct(productId: string, checked: boolean) {
    setSelectedProductIds((current) => {
      if (checked) return current.includes(productId) ? current : [...current, productId];
      return current.filter((id) => id !== productId);
    });
    setTargetQuantities((current) => ({ ...current, [productId]: current[productId] ?? "1" }));
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-clinic-ink/30 px-4 py-6 backdrop-blur-sm">
      <div className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-[2rem] border border-white/80 bg-white shadow-[0_30px_90px_rgba(7,55,99,0.22)]">
        <div className="flex items-start justify-between gap-4 border-b border-border p-6">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-clinic-red">Timed campaign</p>
            <h3 className="mt-1 text-2xl font-semibold tracking-tight text-clinic-ink">{campaign ? "Edit reward campaign" : "Create reward campaign"}</h3>
            <p className="mt-2 text-sm leading-6 text-slate-500">Choose products, quantities, a custom date window, and the reward agents unlock.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-full border border-border px-4 py-2 text-sm font-semibold text-clinic-navy">
            Close
          </button>
        </div>

        <form action={campaignFormAction} onChange={() => setHasUnsavedChanges(true)} className="space-y-5 p-6">
          {campaign ? <input type="hidden" name="campaignId" value={campaign.id} /> : null}
          <input type="hidden" name="targetQuantity" value={Math.max(Number(totalTargetQuantity) || 1, 1)} />
          <div aria-live="polite" className="space-y-3">
            {campaignActionState.ok && !hasUnsavedChanges ? (
              <div className="flex items-start gap-3 rounded-[1.35rem] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800 shadow-line">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
                <div>
                  <p>{campaignActionState.message}</p>
                  <p className="mt-1 text-xs font-medium text-emerald-700">
                    You can keep editing or close this modal when you are done.
                  </p>
                </div>
              </div>
            ) : null}
            {campaignActionState.error ? (
              <div className="flex items-start gap-3 rounded-[1.35rem] border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-clinic-red shadow-line">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
                <div>
                  <p>Campaign was not saved.</p>
                  <p className="mt-1 text-xs font-medium text-red-700">{campaignActionState.error}</p>
                </div>
              </div>
            ) : null}
          </div>
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
              <Input name="startsAt" type="datetime-local" value={startsAtValue} onChange={(event) => setStartsAtValue(event.target.value)} />
            </label>
            <label className="space-y-2">
              <span className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Ends</span>
              <Input name="endsAt" type="datetime-local" value={endsAtValue} onChange={(event) => setEndsAtValue(event.target.value)} />
            </label>
            <label className="space-y-2 md:col-span-2">
              <span className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Description</span>
              <textarea name="description" defaultValue={campaign?.description ?? ""} className="min-h-20 w-full rounded-2xl border border-input bg-white px-4 py-3 text-sm text-clinic-ink shadow-line outline-none focus:ring-2 focus:ring-ring" />
            </label>
          </div>

          <div className="rounded-3xl border border-border bg-white p-5 shadow-line">
            <div className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-clinic-red" />
              <p className="text-sm font-semibold text-clinic-ink">Campaign timing</p>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <label className="cursor-pointer rounded-[1.5rem] border border-border bg-clinic-mist p-4 transition has-[:checked]:border-clinic-navy has-[:checked]:bg-blue-50">
                <div className="flex items-start gap-3">
                  <input
                    type="radio"
                    name="windowMode"
                    value="CAMPAIGN_RANGE"
                    checked={windowMode === "CAMPAIGN_RANGE"}
                    onChange={() => setWindowMode("CAMPAIGN_RANGE")}
                    className="mt-1 size-5"
                  />
                  <div>
                    <p className="text-sm font-semibold text-clinic-ink">Campaign date range</p>
                    <p className="mt-1 text-sm leading-6 text-slate-500">Every qualifying sale between the start and end dates counts.</p>
                  </div>
                </div>
              </label>
              <label className="cursor-pointer rounded-[1.5rem] border border-border bg-clinic-mist p-4 transition has-[:checked]:border-clinic-navy has-[:checked]:bg-blue-50">
                <div className="flex items-start gap-3">
                  <input
                    type="radio"
                    name="windowMode"
                    value="ROLLING_DAYS"
                    checked={windowMode === "ROLLING_DAYS"}
                    onChange={() => setWindowMode("ROLLING_DAYS")}
                    className="mt-1 size-5"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-clinic-ink">Rolling day sprint</p>
                    <p className="mt-1 text-sm leading-6 text-slate-500">The agent must hit the target inside any rolling X-day window during this campaign.</p>
                    {windowMode === "ROLLING_DAYS" ? (
                      <Input
                        name="rollingWindowDays"
                        type="number"
                        min={1}
                        max={365}
                        value={rollingWindowDays}
                        onChange={(event) => setRollingWindowDays(event.target.value)}
                        className="mt-3"
                      />
                    ) : null}
                  </div>
                </div>
              </label>
            </div>
          </div>

          <div className="rounded-3xl border border-border bg-clinic-mist p-4">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-clinic-red" />
              <p className="text-sm font-semibold text-clinic-ink">Eligible products and targets</p>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <label className="cursor-pointer rounded-[1.5rem] border border-border bg-white p-4 shadow-line transition has-[:checked]:border-clinic-navy has-[:checked]:bg-blue-50">
                <div className="flex items-start gap-3">
                  <input
                    type="radio"
                    name="goalMode"
                    value="TOTAL_UNITS"
                    checked={goalMode === "TOTAL_UNITS"}
                    onChange={() => setGoalMode("TOTAL_UNITS")}
                    className="mt-1 size-5"
                  />
                  <div>
                    <p className="text-sm font-semibold text-clinic-ink">Total units across selected products</p>
                    <p className="mt-1 text-sm leading-6 text-slate-500">
                      Any mix of the selected products counts toward the total target.
                    </p>
                  </div>
                </div>
              </label>
              <label className="cursor-pointer rounded-[1.5rem] border border-border bg-white p-4 shadow-line transition has-[:checked]:border-clinic-navy has-[:checked]:bg-blue-50">
                <div className="flex items-start gap-3">
                  <input
                    type="radio"
                    name="goalMode"
                    value="PRODUCT_BUNDLE"
                    checked={goalMode === "PRODUCT_BUNDLE"}
                    onChange={() => setGoalMode("PRODUCT_BUNDLE")}
                    className="mt-1 size-5"
                  />
                  <div>
                    <p className="text-sm font-semibold text-clinic-ink">Required product bundle</p>
                    <p className="mt-1 text-sm leading-6 text-slate-500">
                      Every selected product must hit its own quantity target, like 3 B-12 plus 2 Glutathione.
                    </p>
                  </div>
                </div>
              </label>
            </div>
            {goalMode === "TOTAL_UNITS" ? (
              <div className="mt-4 rounded-[1.5rem] border border-blue-100 bg-blue-50 p-4">
                <div className="grid gap-4 md:grid-cols-[1fr_180px] md:items-end">
                  <div>
                    <p className="text-sm font-semibold text-clinic-ink">Any selected product target</p>
                    <p className="mt-1 text-sm leading-6 text-slate-600">
                      Agents can sell any combination of the selected products. The reward unlocks when the total reaches this quantity.
                    </p>
                  </div>
                  <label className="space-y-2">
                    <span className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Total units required</span>
                    <Input
                      type="number"
                      min={1}
                      max={999}
                      value={totalTargetQuantity}
                      onChange={(event) => setTotalTargetQuantity(event.target.value)}
                    />
                  </label>
                </div>
              </div>
            ) : null}
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {products.map((product) => {
                const marginCents = Math.max(product.priceCents - product.internalCostCents, 0);
                return (
                  <label key={product.id} className="grid gap-3 rounded-2xl border border-border bg-white p-4 shadow-line">
                    <div className="flex items-start gap-3">
                      <input
                        name="productId"
                        value={product.id}
                        type="checkbox"
                        checked={selectedProductIdSet.has(product.id)}
                        onChange={(event) => toggleProduct(product.id, event.target.checked)}
                        className="mt-1 size-5 rounded border-slate-300"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-clinic-ink">{product.title}</p>
                        <p className="text-sm text-slate-500">{product.category.name}</p>
                        <p className="mt-2 text-sm font-semibold text-emerald-700">
                          {money(product.priceCents)} sale / {money(marginCents)} margin
                        </p>
                      </div>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
                      {goalMode === "PRODUCT_BUNDLE" ? (
                        <Input
                          name={`targetQuantity:${product.id}`}
                          type="number"
                          min={1}
                          value={campaignQuantity(product.id)}
                          onChange={(event) => setTargetQuantities((current) => ({ ...current, [product.id]: event.target.value }))}
                          placeholder="Target units"
                        />
                      ) : (
                        <input type="hidden" name={`targetQuantity:${product.id}`} value={campaignQuantity(product.id)} />
                      )}
                      <div className="rounded-2xl bg-clinic-mist px-4 py-3 text-xs font-bold uppercase tracking-[0.12em] text-clinic-navy">
                        {goalMode === "PRODUCT_BUNDLE"
                          ? `${money(marginCents * Math.max(Number(campaignQuantity(product.id) || 1), 1))} margin`
                          : "Counts toward total"}
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="rounded-[1.75rem] border border-border bg-white p-5 shadow-[0_20px_60px_rgba(7,55,99,0.08)]">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-clinic-red">Campaign projection</p>
                <h4 className="mt-1 text-2xl font-semibold text-clinic-ink">Reward economics</h4>
                <p className="mt-1 text-sm leading-6 text-slate-500">
                  Calculated from the selected products, target units, margin, and reward value.
                </p>
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-bold ${isProjectedLoss ? "bg-red-50 text-clinic-red" : "bg-emerald-50 text-emerald-800"}`}>
                {isProjectedLoss ? "Projected loss" : "Projected gain"}
              </span>
            </div>
            <div className="mt-5 grid gap-3 md:grid-cols-4">
              <div className="rounded-2xl bg-clinic-mist p-4">
                <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">Target units</p>
                <p className="mt-1 text-2xl font-semibold text-clinic-navy">{projection.units}</p>
              </div>
              <div className="rounded-2xl bg-clinic-mist p-4">
                <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">Sales revenue</p>
                <p className="mt-1 text-2xl font-semibold text-clinic-navy">{money(projection.revenueCents)}</p>
              </div>
              <div className="rounded-2xl bg-emerald-50 p-4">
                <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-emerald-700">Gross margin</p>
                <p className="mt-1 text-2xl font-semibold text-emerald-800">{money(projection.marginCents)}</p>
              </div>
              <div className={`rounded-2xl p-4 ${isProjectedLoss ? "bg-red-50" : "bg-white shadow-line"}`}>
                <p className={`text-[11px] font-bold uppercase tracking-[0.12em] ${isProjectedLoss ? "text-clinic-red" : "text-slate-500"}`}>
                  Net after reward
                </p>
                <p className={`mt-1 text-2xl font-semibold ${isProjectedLoss ? "text-clinic-red" : "text-clinic-navy"}`}>
                  {money(projectedNetCents)}
                </p>
              </div>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div className="rounded-2xl bg-white p-4 shadow-line">
                <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">Possible wins modeled</p>
                <p className="mt-1 text-xl font-semibold text-clinic-navy">{possibleWins}</p>
              </div>
              <div className="rounded-2xl bg-white p-4 shadow-line">
                <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">Reward exposure</p>
                <p className="mt-1 text-xl font-semibold text-clinic-navy">{money(projectedRewardExposureCents)}</p>
              </div>
              <div className={`rounded-2xl p-4 ${projectedNetExposureCents < 0 ? "bg-red-50" : "bg-emerald-50"}`}>
                <p className={`text-[11px] font-bold uppercase tracking-[0.12em] ${projectedNetExposureCents < 0 ? "text-clinic-red" : "text-emerald-700"}`}>
                  Net exposure
                </p>
                <p className={`mt-1 text-xl font-semibold ${projectedNetExposureCents < 0 ? "text-clinic-red" : "text-emerald-800"}`}>
                  {money(projectedNetExposureCents)}
                </p>
              </div>
            </div>
          </div>

          <div className={`rounded-[1.75rem] border p-5 ${overlapSummary.overlapping.length ? "border-amber-200 bg-amber-50" : "border-border bg-white shadow-line"}`}>
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div className="flex items-start gap-3">
                <AlertTriangle className={`mt-1 h-5 w-5 ${overlapSummary.overlapping.length ? "text-amber-700" : "text-clinic-navy"}`} />
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Campaign overlap advisory</p>
                  <h4 className="mt-1 text-xl font-semibold text-clinic-ink">
                    {overlapSummary.overlapping.length ? `${overlapSummary.overlapping.length} campaign overlap detected` : "No campaign overlap detected"}
                  </h4>
                  <p className="mt-1 text-sm leading-6 text-slate-600">
                    This estimates company net if agents qualify for this reward and the overlapping campaigns in the same period.
                  </p>
                </div>
              </div>
              {overlapSummary.overlapping.length ? (
                <div className="flex flex-wrap gap-2">
                  {overlapSummary.overlapping.slice(0, 3).map((item) => (
                    <span key={item.id} className="rounded-full bg-white px-3 py-1 text-xs font-bold text-clinic-navy shadow-line">
                      {item.title}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div className="rounded-2xl bg-white p-4 shadow-line">
                <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">Margin exposure</p>
                <p className="mt-1 text-xl font-semibold text-clinic-navy">{money(overlapSummary.marginExposureCents)}</p>
              </div>
              <div className="rounded-2xl bg-white p-4 shadow-line">
                <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">Reward exposure</p>
                <p className="mt-1 text-xl font-semibold text-clinic-navy">{money(overlapSummary.rewardExposureCents)}</p>
              </div>
              <div className={`rounded-2xl p-4 ${overlapSummary.netExposureCents < 0 ? "bg-red-50" : "bg-emerald-50"}`}>
                <p className={`text-[11px] font-bold uppercase tracking-[0.12em] ${overlapSummary.netExposureCents < 0 ? "text-clinic-red" : "text-emerald-700"}`}>
                  Net after rewards
                </p>
                <p className={`mt-1 text-xl font-semibold ${overlapSummary.netExposureCents < 0 ? "text-clinic-red" : "text-emerald-800"}`}>
                  {money(overlapSummary.netExposureCents)}
                </p>
              </div>
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
              <span className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Reward value / company cost</span>
              <Input
                name="rewardValueDollars"
                type="number"
                min={0}
                step="0.01"
                value={rewardValueDollars}
                onChange={(event) => setRewardValueDollars(event.target.value)}
              />
            </label>
            <label className="space-y-2">
              <span className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Wins per agent</span>
              <Input
                name="maxWinsPerParticipant"
                type="number"
                min={1}
                max={999}
                value={maxWinsPerParticipant}
                onChange={(event) => setMaxWinsPerParticipant(event.target.value)}
              />
            </label>
            <label className="space-y-2">
              <span className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Total campaign cap</span>
              <Input
                name="maxTotalClaims"
                type="number"
                min={1}
                max={9999}
                value={maxTotalClaims}
                onChange={(event) => setMaxTotalClaims(event.target.value)}
                placeholder="Optional"
              />
            </label>
            <label className="space-y-2">
              <span className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Image URL</span>
              <Input name="rewardImageUrl" defaultValue={campaign?.rewardImageUrl ?? ""} placeholder="Optional image URL" />
            </label>
            <div className="rounded-[1.5rem] border border-border bg-clinic-mist p-4 md:col-span-2">
              <p className="text-sm font-semibold text-clinic-ink">Limit behavior</p>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                Participants can win this campaign up to the agent limit. If the total campaign cap is reached, the campaign stops issuing new rewards while keeping all history visible.
              </p>
            </div>
            <label className="space-y-2 md:col-span-2">
              <span className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Reward details</span>
              <textarea name="rewardDescription" defaultValue={campaign?.rewardDescription ?? ""} className="min-h-20 w-full rounded-2xl border border-input bg-white px-4 py-3 text-sm text-clinic-ink shadow-line outline-none focus:ring-2 focus:ring-ring" />
            </label>
          </div>

          <div className="flex flex-col-reverse gap-3 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between">
            {campaign ? (
              <Button
                type="submit"
                variant="outline"
                formAction={deleteRewardCampaign}
                onClick={confirmDeleteCampaign}
                className="border-red-200 text-clinic-red hover:bg-red-50"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete campaign
              </Button>
            ) : (
              <span />
            )}
            <CampaignSaveButton isSaved={campaignActionState.ok && !hasUnsavedChanges} isEditing={Boolean(campaign)} />
          </div>
        </form>
      </div>
    </div>
  );
}

function RewardClaimQueue({ claims }: { claims: RewardClaim[] }) {
  return (
    <Card className="overflow-hidden rounded-[2rem] border-white/80 bg-white shadow-[0_22px_70px_rgba(7,55,99,0.08)]">
      <div className="flex flex-col gap-4 border-b border-border p-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <DollarSign className="h-5 w-5 text-clinic-red" />
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Reward operations</p>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight text-clinic-ink">Reward payout and redemption</h2>
            <p className="mt-1 text-sm leading-6 text-slate-500">
              Cash rewards are funded through the partner payout. Non-cash rewards move through redemption and fulfillment.
            </p>
          </div>
        </div>
        <span className="rounded-full bg-clinic-mist px-4 py-2 text-sm font-bold text-clinic-navy">{claims.length} pending</span>
      </div>

      <div className="grid gap-3 p-5">
        {claims.length ? (
          claims.map((claim) => {
            const name = personName(claim.user);
            const statusLabel = claim.status.replaceAll("_", " ").toLowerCase();
            return (
              <div key={claim.id} className="flex flex-col gap-4 rounded-[1.5rem] border border-border bg-white p-4 shadow-line lg:flex-row lg:items-center">
                <div className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-2xl bg-clinic-navy text-sm font-bold text-white">
                  {claim.user.avatarUrl ? <img src={claim.user.avatarUrl} alt={name} className="h-full w-full object-cover" /> : initialsFor(name)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-lg font-semibold text-clinic-ink">{name}</p>
                    <span className="rounded-full bg-clinic-mist px-3 py-1 text-xs font-bold text-clinic-navy">{claim.participantRole.replaceAll("_", " ")}</span>
                    <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold capitalize text-emerald-800">{statusLabel}</span>
                  </div>
                  <p className="mt-1 truncate text-sm text-slate-500">{claim.campaign.title} · {claim.campaign.rewardTitle}</p>
                </div>
                <div className="rounded-2xl bg-clinic-mist px-4 py-3 text-left lg:w-40">
                  <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">Reward value</p>
                  <p className="mt-1 text-lg font-semibold text-clinic-navy">{money(claim.rewardValueCents)}</p>
                </div>
                {claim.rewardValueType === "CASH" && claim.status === "PAYOUT_PENDING" ? (
                  <form action={markRewardPayoutApplied}>
                    <input type="hidden" name="claimId" value={claim.id} />
                    <Button type="submit" className="w-full lg:w-auto">
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      Mark funded to partner
                    </Button>
                  </form>
                ) : null}
                {claim.rewardValueType === "NON_CASH" && claim.status === "REDEEM_REQUESTED" ? (
                  <form action={fulfillRewardClaim}>
                    <input type="hidden" name="claimId" value={claim.id} />
                    <Button type="submit" variant="accent" className="w-full lg:w-auto">
                      <Send className="mr-2 h-4 w-4" />
                      Mark fulfilled
                    </Button>
                  </form>
                ) : null}
              </div>
            );
          })
        ) : (
          <div className="rounded-3xl border border-dashed border-border bg-clinic-mist p-6 text-sm font-medium text-slate-500">
            No reward payout or redemption items are waiting right now.
          </div>
        )}
      </div>
    </Card>
  );
}

export function AdminRewardsEditor({
  levels,
  products,
  campaigns,
  claims
}: {
  levels: RewardLevel[];
  products: RewardProduct[];
  campaigns: RewardCampaign[];
  claims: RewardClaim[];
}) {
  const [editingLevel, setEditingLevel] = useState<RewardLevel | null>(null);
  const [editingCampaign, setEditingCampaign] = useState<RewardCampaign | null | "new">(null);
  const totals = useMemo(
    () => ({
      levelMargin: levels.reduce((sum, level) => sum + level.projectedMarginCents, 0),
      campaignMargin: campaigns.reduce((sum, campaign) => sum + campaign.projectedMarginCents, 0),
      campaignRewardCost: campaigns.reduce((sum, campaign) => sum + campaign.rewardValueCents, 0),
      campaignNet: campaigns.reduce((sum, campaign) => sum + campaign.projectedMarginCents - campaign.rewardValueCents, 0),
      activeCampaigns: campaigns.filter((campaign) => campaign.status === "ACTIVE").length
    }),
    [levels, campaigns]
  );

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden rounded-[2rem] border-white/80 bg-white shadow-[0_22px_70px_rgba(7,55,99,0.08)]">
        <div className="grid gap-4 p-6 md:grid-cols-4">
          <div className="rounded-3xl bg-clinic-mist p-5">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Active campaigns</p>
            <p className="mt-2 text-3xl font-semibold text-clinic-navy">{totals.activeCampaigns}</p>
          </div>
          <div className="rounded-3xl bg-emerald-50 p-5">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-700">Projected campaign margin</p>
            <p className="mt-2 text-3xl font-semibold text-emerald-800">{money(totals.campaignMargin)}</p>
          </div>
          <div className="rounded-3xl bg-white p-5 shadow-line">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Reward cost</p>
            <p className="mt-2 text-3xl font-semibold text-clinic-navy">{money(totals.campaignRewardCost)}</p>
          </div>
          <div className="rounded-3xl bg-white p-5 shadow-line">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Net after rewards</p>
            <p className={`mt-2 text-3xl font-semibold ${totals.campaignNet < 0 ? "text-clinic-red" : "text-clinic-navy"}`}>
              {money(totals.campaignNet)}
            </p>
          </div>
        </div>
      </Card>

      <RewardClaimQueue claims={claims} />

      <Card className="overflow-hidden rounded-[2rem]">
        <div className="flex flex-col gap-4 border-b border-border p-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <Settings2 className="h-5 w-5 text-clinic-red" />
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Go Virtual Health configuration</p>
              <h2 className="mt-1 text-2xl font-semibold tracking-tight text-clinic-ink">Reward levels</h2>
              <p className="mt-1 text-sm leading-6 text-slate-500">Each level estimates company revenue and gross margin using active product pricing and cost.</p>
            </div>
          </div>
        </div>

        <div className="grid gap-4 p-6 xl:grid-cols-3">
          {levels.length ? levels.map((level) => {
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
          }) : (
            <div className="rounded-3xl border border-dashed border-border bg-clinic-mist p-6 text-sm font-medium text-slate-500 xl:col-span-3">
              No reward levels are configured. Default Go Virtual Health-created rewards are disabled, so this area stays empty until levels are intentionally added through a future workflow.
            </div>
          )}
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
            campaigns.map((campaign) => {
              const netCents = campaign.projectedMarginCents - campaign.rewardValueCents;
              return (
                <div
                  key={campaign.id}
                  className="rounded-[1.75rem] border border-border bg-white p-5 shadow-line transition hover:-translate-y-0.5 hover:shadow-[0_20px_50px_rgba(7,55,99,0.10)]"
                >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">{campaign.status}</p>
                    <h3 className="mt-1 truncate text-xl font-semibold text-clinic-ink">{campaign.title}</h3>
                    <p className="mt-1 line-clamp-2 text-sm text-slate-500">{campaignTargetLabel(campaign)}</p>
                    <p className="mt-2 text-sm font-semibold text-clinic-navy">
                      {campaignTimingLabel(campaign)}
                    </p>
                  </div>
                  <span className="rounded-full bg-clinic-mist px-3 py-1 text-xs font-bold text-clinic-navy">
                    {campaign.rewardValueType === "CASH" ? "Cash" : "Reward"}
                  </span>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-4">
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
                  <div className={`rounded-2xl p-4 ${netCents < 0 ? "bg-red-50" : "bg-white shadow-line"}`}>
                    <p className={`text-[11px] font-bold uppercase tracking-[0.12em] ${netCents < 0 ? "text-clinic-red" : "text-slate-500"}`}>Net</p>
                    <p className={`mt-1 font-semibold ${netCents < 0 ? "text-clinic-red" : "text-clinic-navy"}`}>{money(netCents)}</p>
                  </div>
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl bg-clinic-mist p-4">
                    <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">Wins per agent</p>
                    <p className="mt-1 font-semibold text-clinic-navy">{campaign.maxWinsPerParticipant}</p>
                  </div>
                  <div className="rounded-2xl bg-clinic-mist p-4">
                    <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">Claims issued</p>
                    <p className="mt-1 font-semibold text-clinic-navy">{campaign.claimCount}</p>
                  </div>
                  <div className="rounded-2xl bg-clinic-mist p-4">
                    <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">Campaign cap</p>
                    <p className="mt-1 font-semibold text-clinic-navy">
                      {campaign.maxTotalClaims ? `${campaign.remainingClaimInventory ?? 0} left` : "No global cap"}
                    </p>
                  </div>
                </div>
                <div className="mt-4 flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 items-center gap-2 text-sm font-semibold text-clinic-navy">
                    <Gift className="h-4 w-4 shrink-0 text-clinic-red" />
                    <span className="truncate">{campaign.rewardTitle}</span>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setEditingCampaign(campaign)}
                      className="h-11 rounded-2xl"
                    >
                      <Pencil className="mr-2 h-4 w-4" />
                      Edit
                    </Button>
                    <form action={deleteRewardCampaign}>
                      <input type="hidden" name="campaignId" value={campaign.id} />
                      <Button
                        type="submit"
                        variant="outline"
                        onClick={confirmDeleteCampaign}
                        className="h-11 rounded-2xl border-red-200 text-clinic-red hover:bg-red-50"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </Button>
                    </form>
                  </div>
                </div>
              </div>
              );
            })
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
          campaigns={campaigns}
          onClose={() => setEditingCampaign(null)}
        />
      ) : null}
    </div>
  );
}
