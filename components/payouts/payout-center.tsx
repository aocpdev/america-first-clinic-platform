import Link from "next/link";
import type { CommissionParticipantRole, CommissionStatus } from "@prisma/client";
import { ArrowUpRight, BadgeCheck, Banknote, CheckCircle2, Clock3, Landmark, LockKeyhole, ShieldCheck, Sparkles, WalletCards } from "lucide-react";

import { markCommissionSplitPaid } from "@/app/payouts/actions";
import type { CommissionLedgerEntry, CommissionLedgerScope } from "@/lib/commissions/queries";
import type { PartnerCashRewardPayoutItem } from "@/lib/rewards/reward-engine";
import { cn, currency } from "@/lib/utils";
import { matchesSearch, matchesSelect, normalizeFilters, RecordFilters, type RecordFiltersState } from "@/components/filters/record-filters";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

type PayoutCenterProps = {
  entries: CommissionLedgerEntry[];
  scope: CommissionLedgerScope;
  filters?: RecordFiltersState;
  rewardPayouts?: PartnerCashRewardPayoutItem[];
};

const statusCopy: Record<CommissionStatus, string> = {
  PENDING: "Pending",
  APPROVED: "Ready",
  REJECTED: "Deferred",
  PAID: "Paid"
};

const statusClassName: Record<CommissionStatus, string> = {
  PENDING: "border-amber-200 bg-amber-50 text-amber-700",
  APPROVED: "border-emerald-200 bg-emerald-50 text-emerald-700",
  REJECTED: "border-red-200 bg-red-50 text-red-700",
  PAID: "border-blue-200 bg-blue-50 text-clinic-navy"
};

const roleCopy: Record<CommissionParticipantRole, string> = {
  PARTNER: "Partner",
  MANAGER: "Manager",
  GROUP_LEADER: "Leader",
  CONSULTANT: "Seller"
};

const rewardRoleCopy = {
  MANAGER: "Manager",
  GROUP_LEADER: "Leader",
  CONSULTANT: "Seller"
} as const;

const rewardStatusCopy = {
  PAYOUT_PENDING: "Waiting company funding",
  PAYOUT_APPLIED: "Funded to partner"
} as const;

const rewardStatusClassName = {
  PAYOUT_PENDING: "border-amber-200 bg-amber-50 text-amber-700",
  PAYOUT_APPLIED: "border-emerald-200 bg-emerald-50 text-emerald-700"
} as const;

function dollars(cents: number) {
  return currency(cents / 100);
}

function sum(entries: CommissionLedgerEntry[], predicate: (entry: CommissionLedgerEntry) => boolean = () => true) {
  return entries.reduce((total, entry) => total + (predicate(entry) ? entry.amountCents : 0), 0);
}

function uniqueOrderSum(entries: CommissionLedgerEntry[], selector: (entry: CommissionLedgerEntry) => number) {
  const seen = new Set<string>();
  return entries.reduce((total, entry) => {
    if (seen.has(entry.orderId)) return total;
    seen.add(entry.orderId);
    return total + selector(entry);
  }, 0);
}

function orderHref(scope: CommissionLedgerScope, orderId: string) {
  if (scope === "admin") return `/admin/orders/${orderId}`;
  if (scope === "manager") return `/manager/orders/${orderId}`;
  if (scope === "consultant") return `/consultant/orders/${orderId}`;
  return `/partner/orders/${orderId}`;
}

function returnPath(scope: CommissionLedgerScope) {
  if (scope === "manager") return "/manager/payouts";
  return scope === "admin" ? "/admin/payouts" : "/partner/payouts";
}

function resetPath(scope: CommissionLedgerScope) {
  if (scope === "admin") return "/admin/payouts";
  if (scope === "manager") return "/manager/payouts";
  if (scope === "consultant") return "/consultant/payouts";
  return "/partner/payouts";
}

function visiblePayoutEntries(scope: CommissionLedgerScope, entries: CommissionLedgerEntry[]) {
  if (scope === "admin") {
    return entries.filter((entry) => entry.payoutResponsibility === "COMPANY" && entry.participantRole === "PARTNER");
  }

  if (scope === "partner") {
    return entries.filter((entry) => entry.payoutResponsibility === "PARTNER" && entry.participantRole !== "PARTNER");
  }

  if (scope === "manager") {
    return entries.filter((entry) => entry.participantRole === "MANAGER");
  }

  if (scope === "group_leader") {
    return entries.filter((entry) => entry.participantRole === "GROUP_LEADER");
  }

  return entries.filter((entry) => entry.participantRole === "CONSULTANT");
}

function applyPayoutFilters(entries: CommissionLedgerEntry[], filters?: RecordFiltersState) {
  const normalized = normalizeFilters(filters);

  return entries.filter((entry) => (
    matchesSearch(normalized.q, [
      entry.orderNumber,
      entry.customerName,
      entry.customerEmail,
      entry.participantName,
      entry.participantEmail,
      roleCopy[entry.participantRole],
      statusCopy[entry.status]
    ]) &&
    matchesSelect(entry.status, normalized.status) &&
    matchesSelect(entry.participantRole, normalized.role)
  ));
}

function personName(person?: { firstName?: string | null; lastName?: string | null; email?: string | null } | null) {
  const name = [person?.firstName, person?.lastName].filter(Boolean).join(" ").trim();
  return name || person?.email || "Unassigned";
}

function rewardParticipantName(claim: PartnerCashRewardPayoutItem) {
  if (claim.participantRole === "MANAGER") {
    return claim.managerProfile?.displayName || personName(claim.user);
  }

  if (claim.participantRole === "GROUP_LEADER") {
    return claim.groupLeaderProfile?.displayName || personName(claim.user);
  }

  return personName(claim.consultantProfile?.user ?? claim.user);
}

function rewardParticipantEmail(claim: PartnerCashRewardPayoutItem) {
  if (claim.participantRole === "MANAGER") return claim.managerProfile?.user.email || claim.user.email;
  if (claim.participantRole === "GROUP_LEADER") return claim.groupLeaderProfile?.user.email || claim.user.email;
  return claim.consultantProfile?.user.email || claim.user.email;
}

function applyRewardPayoutFilters(items: PartnerCashRewardPayoutItem[], filters?: RecordFiltersState) {
  const normalized = normalizeFilters(filters);

  return items.filter((item) => (
    matchesSearch(normalized.q, [
      rewardParticipantName(item),
      rewardParticipantEmail(item),
      rewardRoleCopy[item.participantRole],
      item.campaign.title,
      item.campaign.rewardTitle,
      rewardStatusCopy[item.status as keyof typeof rewardStatusCopy] ?? item.status
    ])
  ));
}

function relatedPartnerObligations(entry: CommissionLedgerEntry, entries: CommissionLedgerEntry[]) {
  return entries.filter((item) => (
    item.orderId === entry.orderId &&
    item.payoutResponsibility === "PARTNER" &&
    item.participantRole !== "PARTNER"
  ));
}

function partnerPacketAmount(entry: CommissionLedgerEntry, entries: CommissionLedgerEntry[]) {
  return entry.amountCents + sum(relatedPartnerObligations(entry, entries));
}

function displayPayoutAmount(entry: CommissionLedgerEntry, scope: CommissionLedgerScope, entries: CommissionLedgerEntry[]) {
  return scope === "admin" && entry.participantRole === "PARTNER" ? partnerPacketAmount(entry, entries) : entry.amountCents;
}

function partnerCompanyPayments(entries: CommissionLedgerEntry[]) {
  return entries.filter((entry) => entry.payoutResponsibility === "COMPANY" && entry.participantRole === "PARTNER");
}

function rewardPayoutSum(items: PartnerCashRewardPayoutItem[]) {
  return items.reduce((total, item) => total + item.rewardValueCents, 0);
}

function participantKey(entry: CommissionLedgerEntry) {
  return [entry.participantRole, entry.participantEmail || entry.participantName].join(":");
}

type PartnerPayeeSummary = {
  key: string;
  role: CommissionParticipantRole;
  name: string;
  email: string;
  totalCents: number;
  pendingCents: number;
  approvedCents: number;
  paidCents: number;
  deferredCents: number;
  entries: CommissionLedgerEntry[];
};

function buildPartnerPayeeSummaries(entries: CommissionLedgerEntry[]): PartnerPayeeSummary[] {
  const summaries = new Map<string, PartnerPayeeSummary>();

  entries.forEach((entry) => {
    const key = participantKey(entry);
    const existing = summaries.get(key) ?? {
      key,
      role: entry.participantRole,
      name: entry.participantName,
      email: entry.participantEmail,
      totalCents: 0,
      pendingCents: 0,
      approvedCents: 0,
      paidCents: 0,
      deferredCents: 0,
      entries: []
    };

    existing.totalCents += entry.amountCents;
    if (entry.status === "PENDING") existing.pendingCents += entry.amountCents;
    if (entry.status === "APPROVED") existing.approvedCents += entry.amountCents;
    if (entry.status === "PAID") existing.paidCents += entry.amountCents;
    if (entry.status === "REJECTED") existing.deferredCents += entry.amountCents;
    existing.entries.push(entry);
    summaries.set(key, existing);
  });

  return Array.from(summaries.values()).sort((a, b) => b.totalCents - a.totalCents || a.name.localeCompare(b.name));
}

function companyPaymentForOrder(entries: CommissionLedgerEntry[], orderId: string) {
  return entries.find((entry) => entry.orderId === orderId && entry.payoutResponsibility === "COMPANY" && entry.participantRole === "PARTNER");
}

function copyForScope(scope: CommissionLedgerScope) {
  if (scope === "admin") {
    return {
      eyebrow: "Company payout control",
      title: "Partner payout center",
      description: "The company pays partners only. Partners then manage payouts for managers, leaders, and sellers from their partner pool.",
      owedLabel: "Partner payouts owed",
      readyLabel: "Ready to pay",
      paidLabel: "Paid to partners",
      empty: "No partner payout obligations are waiting right now.",
      showActions: true
    };
  }

  if (scope === "partner") {
    return {
      eyebrow: "Partner payout desk",
      title: "Team payout center",
      description: "Pay managers, leaders, and sellers from your partner pool. The company only pays your partner payout.",
      owedLabel: "Team payouts owed",
      readyLabel: "Ready to pay",
      paidLabel: "Paid to team",
      empty: "No team payout obligations are waiting right now.",
      showActions: true
    };
  }

  if (scope === "manager") {
    return {
      eyebrow: "Manager payout status",
      title: "Your payout tracker",
      description: "Review personal manager earnings and payout status. Partner-managed team payout details remain internal to the partner.",
      owedLabel: "Pending earnings",
      readyLabel: "Approved earnings",
      paidLabel: "Paid earnings",
      empty: "No manager payout activity yet.",
      showActions: false
    };
  }

  if (scope === "group_leader") {
    return {
      eyebrow: "Leader payout status",
      title: "Your payout tracker",
      description: "Review personal leader earnings and payout status. Seller payout management belongs to the partner.",
      owedLabel: "Pending earnings",
      readyLabel: "Approved earnings",
      paidLabel: "Paid earnings",
      empty: "No leader payout activity yet.",
      showActions: false
    };
  }

  return {
    eyebrow: "Seller payout status",
    title: "Your payout tracker",
    description: "Track your own commissions from pending review to approved and paid. Internal split details are hidden.",
    owedLabel: "Pending commission",
    readyLabel: "Approved commission",
    paidLabel: "Paid commission",
    empty: "No seller payout activity yet.",
    showActions: false
  };
}

function PayoutMetric({
  label,
  value,
  helper,
  tone,
  icon: Icon
}: {
  label: string;
  value: number;
  helper: string;
  tone: "navy" | "green" | "red" | "blue";
  icon: typeof WalletCards;
}) {
  const toneClassName = {
    navy: "bg-clinic-mist text-clinic-navy",
    green: "bg-emerald-50 text-emerald-700",
    red: "bg-red-50 text-clinic-red",
    blue: "bg-blue-50 text-clinic-navy"
  }[tone];

  return (
    <div className="rounded-[28px] border border-border bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-4">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">{label}</p>
        <span className={cn("flex h-11 w-11 items-center justify-center rounded-2xl", toneClassName)}>
          <Icon className="h-5 w-5" />
        </span>
      </div>
      <p className="mt-5 text-3xl font-semibold tracking-tight text-clinic-navy">{dollars(value)}</p>
      <p className="mt-2 text-sm leading-6 text-slate-500">{helper}</p>
    </div>
  );
}

function PayoutRow({
  entry,
  scope,
  canMarkPaid,
  allEntries,
  relatedEntries = [],
  sourceCompanyPayment
}: {
  entry: CommissionLedgerEntry;
  scope: CommissionLedgerScope;
  canMarkPaid: boolean;
  allEntries: CommissionLedgerEntry[];
  relatedEntries?: CommissionLedgerEntry[];
  sourceCompanyPayment?: CommissionLedgerEntry;
}) {
  const displayedAmount = displayPayoutAmount(entry, scope, allEntries);
  const sourcePacketAmount = sourceCompanyPayment ? partnerPacketAmount(sourceCompanyPayment, allEntries) : 0;

  return (
    <div className="grid gap-4 border-t border-border px-5 py-5 lg:grid-cols-[1.15fr_1fr_0.75fr_0.7fr_auto] lg:items-center">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-semibold text-clinic-ink">{entry.participantName}</p>
          <Badge className="border-blue-200 bg-blue-50 text-clinic-navy">{roleCopy[entry.participantRole]}</Badge>
        </div>
        <p className="mt-1 break-all text-sm text-slate-500">{entry.participantEmail || "No email on file"}</p>
      </div>

      <div className="min-w-0 rounded-2xl bg-clinic-mist p-4">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Order / customer</p>
        <Link href={orderHref(scope, entry.orderId)} className="mt-1 inline-flex items-center gap-2 font-semibold text-clinic-navy">
          {entry.orderNumber} <ArrowUpRight className="h-4 w-4" />
        </Link>
        <p className="mt-1 truncate text-sm text-slate-600">{entry.customerName}</p>
      </div>

      <div>
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Amount</p>
        <p className="mt-1 text-2xl font-semibold text-clinic-navy">{dollars(displayedAmount)}</p>
        {scope === "admin" && relatedEntries.length ? (
          <p className="mt-1 text-xs leading-5 text-slate-500">
            Partner keeps {dollars(entry.amountCents)} after downline payouts.
          </p>
        ) : null}
      </div>

      <div>
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Status</p>
        <Badge className={cn("mt-2 px-3 py-1.5", statusClassName[entry.status])}>{statusCopy[entry.status]}</Badge>
      </div>

      <div className="flex flex-wrap gap-2 lg:justify-end">
        <Link href={orderHref(scope, entry.orderId)} className="inline-flex items-center justify-center rounded-2xl border border-border bg-white px-4 py-3 text-sm font-semibold text-clinic-navy shadow-sm">
          Review
        </Link>
        {canMarkPaid && entry.status === "APPROVED" ? (
          <form action={markCommissionSplitPaid}>
            <input type="hidden" name="splitId" value={entry.id} />
            <input type="hidden" name="returnPath" value={returnPath(scope)} />
            <button className="inline-flex items-center justify-center rounded-2xl bg-clinic-navy px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-clinic-blue">
              Mark paid
            </button>
          </form>
        ) : null}
      </div>

      {sourceCompanyPayment ? (
        <div className="rounded-[24px] border border-blue-100 bg-blue-50/70 p-4 lg:col-span-5">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-clinic-navy">Funded by company partner payout</p>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Partner retained split: <span className="font-semibold text-clinic-navy">{dollars(sourceCompanyPayment.amountCents)}</span>{" "}
            ({statusCopy[sourceCompanyPayment.status]}). Total partner packet: <span className="font-semibold text-clinic-navy">{dollars(sourcePacketAmount)}</span>.
            Use this packet to reconcile what the partner received against what the team is owed.
          </p>
        </div>
      ) : null}

      {relatedEntries.length ? (
        <div className="rounded-[24px] border border-emerald-100 bg-emerald-50/70 p-4 lg:col-span-5">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-700">Downline obligations funded by this partner payout</p>
          <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {relatedEntries.map((item) => (
              <div key={item.id} className="rounded-2xl bg-white p-3 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">{roleCopy[item.participantRole]}</p>
                  <Badge className={cn("px-2 py-1 text-[11px]", statusClassName[item.status])}>{statusCopy[item.status]}</Badge>
                </div>
                <p className="mt-2 truncate font-semibold text-clinic-ink">{item.participantName}</p>
                <p className="mt-1 font-semibold text-emerald-700">{dollars(item.amountCents)}</p>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function EmptyPayouts({ message }: { message: string }) {
  return (
    <div className="p-10 text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[28px] bg-clinic-mist text-clinic-navy">
        <WalletCards className="h-7 w-7" />
      </div>
      <h3 className="mt-5 text-2xl font-semibold text-clinic-ink">Payout queue is clear</h3>
      <p className="mx-auto mt-2 max-w-2xl text-slate-600">{message}</p>
    </div>
  );
}

function RewardPayoutRow({ claim }: { claim: PartnerCashRewardPayoutItem }) {
  const name = rewardParticipantName(claim);
  const email = rewardParticipantEmail(claim);
  const status = claim.status as keyof typeof rewardStatusCopy;

  return (
    <div className="grid gap-4 border-t border-border px-5 py-5 lg:grid-cols-[1.1fr_1.2fr_0.65fr_0.75fr] lg:items-center">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-semibold text-clinic-ink">{name}</p>
          <Badge className="border-blue-200 bg-blue-50 text-clinic-navy">{rewardRoleCopy[claim.participantRole]}</Badge>
        </div>
        <p className="mt-1 break-all text-sm text-slate-500">{email || "No email on file"}</p>
      </div>

      <div className="min-w-0 rounded-2xl bg-clinic-mist p-4">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Reward campaign</p>
        <p className="mt-1 truncate font-semibold text-clinic-ink">{claim.campaign.title}</p>
        <p className="mt-1 truncate text-sm text-slate-600">{claim.campaign.rewardTitle}</p>
      </div>

      <div>
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Cash reward</p>
        <p className="mt-1 text-2xl font-semibold text-clinic-navy">{dollars(claim.rewardValueCents)}</p>
      </div>

      <div>
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Funding status</p>
        <Badge className={cn("mt-2 px-3 py-1.5", rewardStatusClassName[status])}>{rewardStatusCopy[status]}</Badge>
      </div>
    </div>
  );
}

function PartnerPayoutOverview({
  teamRows,
  companyPayments,
  entries,
  rewardPayouts
}: {
  teamRows: CommissionLedgerEntry[];
  companyPayments: CommissionLedgerEntry[];
  entries: CommissionLedgerEntry[];
  rewardPayouts: PartnerCashRewardPayoutItem[];
}) {
  const companyPartnerPayout = companyPayments.reduce((total, entry) => total + partnerPacketAmount(entry, entries), 0);
  const teamCommissions = sum(teamRows);
  const cashRewards = rewardPayoutSum(rewardPayouts);
  const totalFundedByCompany = companyPartnerPayout + cashRewards;
  const partnerRetained = Math.max(companyPartnerPayout - teamCommissions, 0);

  return (
    <Card className="overflow-hidden rounded-[32px] border-blue-100 bg-white shadow-sm">
      <div className="border-b border-border p-6 sm:p-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-clinic-red">Partner settlement</p>
            <h3 className="mt-3 text-3xl font-semibold tracking-tight text-clinic-ink">Company money in, team payouts out</h3>
            <p className="mt-3 max-w-4xl text-base leading-7 text-slate-600">
              The partner receives the company-funded partner payout packet. From that packet, the partner pays managers, leaders, and sellers. Cash rewards are tracked as a separate pass-through payout.
            </p>
          </div>
          <div className="rounded-[26px] border border-blue-100 bg-blue-50 px-5 py-4 text-clinic-navy">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Partner keeps from commissions</p>
            <p className="mt-1 text-3xl font-semibold tracking-tight">{dollars(partnerRetained)}</p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-[26px] bg-clinic-mist p-5">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Company funded</p>
          <p className="mt-4 text-3xl font-semibold text-clinic-navy">{dollars(totalFundedByCompany)}</p>
          <p className="mt-2 text-sm leading-6 text-slate-500">Partner payout plus any funded cash rewards.</p>
        </div>
        <div className="rounded-[26px] bg-blue-50 p-5">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Partner commission packet</p>
          <p className="mt-4 text-3xl font-semibold text-clinic-navy">{dollars(companyPartnerPayout)}</p>
          <p className="mt-2 text-sm leading-6 text-slate-500">The full amount the company owes the partner from order margins.</p>
        </div>
        <div className="rounded-[26px] bg-emerald-50 p-5">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-700">Team to distribute</p>
          <p className="mt-4 text-3xl font-semibold text-emerald-700">{dollars(teamCommissions)}</p>
          <p className="mt-2 text-sm leading-6 text-slate-500">Managers, leaders, and sellers paid by the partner.</p>
        </div>
        <div className="rounded-[26px] bg-amber-50 p-5">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-amber-700">Cash rewards</p>
          <p className="mt-4 text-3xl font-semibold text-amber-700">{dollars(cashRewards)}</p>
          <p className="mt-2 text-sm leading-6 text-slate-500">Reward payouts to pass through to earners.</p>
        </div>
      </div>
    </Card>
  );
}

function PartnerPayeeLedger({
  summaries,
  entries,
  scope
}: {
  summaries: PartnerPayeeSummary[];
  entries: CommissionLedgerEntry[];
  scope: CommissionLedgerScope;
}) {
  return (
    <Card className="overflow-hidden rounded-[32px]">
      <div className="border-b border-border p-6 sm:p-8">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-clinic-red">Team distribution ledger</p>
        <h3 className="mt-3 text-3xl font-semibold tracking-tight text-clinic-ink">Who the partner needs to pay</h3>
        <p className="mt-3 max-w-4xl text-base leading-7 text-slate-600">
          This groups every payable commission by person and shows the exact order source behind each amount.
        </p>
      </div>

      {summaries.length ? (
        <div className="grid gap-4 p-4 xl:grid-cols-2">
          {summaries.map((summary) => (
            <div key={summary.key} className="rounded-[28px] border border-border bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-xl font-semibold text-clinic-ink">{summary.name}</p>
                    <Badge className="border-blue-200 bg-blue-50 text-clinic-navy">{roleCopy[summary.role]}</Badge>
                  </div>
                  <p className="mt-1 break-all text-sm text-slate-500">{summary.email || "No email on file"}</p>
                </div>
                <div className="rounded-[22px] bg-emerald-50 px-4 py-3 text-right">
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-emerald-700">Total owed</p>
                  <p className="mt-1 text-2xl font-semibold text-emerald-700">{dollars(summary.totalCents)}</p>
                </div>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-4">
                <div className="rounded-2xl bg-amber-50 p-3">
                  <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-amber-700">Pending</p>
                  <p className="mt-1 font-semibold text-amber-700">{dollars(summary.pendingCents)}</p>
                </div>
                <div className="rounded-2xl bg-emerald-50 p-3">
                  <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-emerald-700">Ready</p>
                  <p className="mt-1 font-semibold text-emerald-700">{dollars(summary.approvedCents)}</p>
                </div>
                <div className="rounded-2xl bg-blue-50 p-3">
                  <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-clinic-navy">Paid</p>
                  <p className="mt-1 font-semibold text-clinic-navy">{dollars(summary.paidCents)}</p>
                </div>
                <div className="rounded-2xl bg-red-50 p-3">
                  <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-clinic-red">Deferred</p>
                  <p className="mt-1 font-semibold text-clinic-red">{dollars(summary.deferredCents)}</p>
                </div>
              </div>

              <div className="mt-4 overflow-hidden rounded-[22px] border border-border">
                {summary.entries.slice(0, 5).map((entry) => {
                  const funding = companyPaymentForOrder(entries, entry.orderId);
                  return (
                    <div key={entry.id} className="grid gap-3 border-t border-border p-4 first:border-t-0 md:grid-cols-[1fr_auto] md:items-center">
                      <div className="min-w-0">
                        <Link href={orderHref(scope, entry.orderId)} className="inline-flex items-center gap-2 font-semibold text-clinic-navy">
                          {entry.orderNumber} <ArrowUpRight className="h-4 w-4" />
                        </Link>
                        <p className="mt-1 truncate text-sm text-slate-600">{entry.customerName}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          Partner packet: <span className="font-semibold text-clinic-navy">{funding ? dollars(funding.amountCents) : "Not funded yet"}</span>
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 md:justify-end">
                        <Badge className={cn("px-3 py-1.5", statusClassName[entry.status])}>{statusCopy[entry.status]}</Badge>
                        <p className="min-w-24 text-right text-lg font-semibold text-clinic-navy">{dollars(entry.amountCents)}</p>
                      </div>
                    </div>
                  );
                })}
                {summary.entries.length > 5 ? (
                  <div className="bg-clinic-mist px-4 py-3 text-sm font-semibold text-slate-600">
                    +{summary.entries.length - 5} more order sources hidden by this compact view.
                  </div>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="p-10 text-center">
          <h3 className="text-xl font-semibold text-clinic-ink">No team payouts match these filters</h3>
          <p className="mt-2 text-slate-600">When managers, leaders, or sellers have payable commissions, their grouped totals will appear here.</p>
        </div>
      )}
    </Card>
  );
}

export function PayoutCenter({ entries, scope, filters, rewardPayouts = [] }: PayoutCenterProps) {
  const visibleRows = visiblePayoutEntries(scope, entries);
  const rows = applyPayoutFilters(visibleRows, filters);
  const visibleRewardPayouts = scope === "partner" ? applyRewardPayoutFilters(rewardPayouts, filters) : [];
  const copy = copyForScope(scope);
  const statusTotal = (status: CommissionStatus) =>
    rows.reduce((total, entry) => total + (entry.status === status ? displayPayoutAmount(entry, scope, entries) : 0), 0);
  const pending = statusTotal("PENDING");
  const approved = statusTotal("APPROVED");
  const paid = statusTotal("PAID");
  const deferred = statusTotal("REJECTED");
  const grossMargin = uniqueOrderSum(entries, (entry) => entry.grossMarginCents);
  const partnerPool = uniqueOrderSum(entries, (entry) => entry.commissionPoolCents);
  const companyNet = Math.max(grossMargin - partnerPool, 0);
  const pendingRows = rows.filter((entry) => entry.status === "PENDING");
  const readyRows = rows.filter((entry) => entry.status === "APPROVED");
  const historyRows = rows.filter((entry) => entry.status === "PAID" || entry.status === "REJECTED").slice(0, 12);
  const companyPayments = scope === "partner" ? applyPayoutFilters(partnerCompanyPayments(entries), filters) : [];
  const partnerPayeeSummaries = scope === "partner" ? buildPartnerPayeeSummaries(rows) : [];
  const pendingRewardPayouts = visibleRewardPayouts.filter((claim) => claim.status === "PAYOUT_PENDING");
  const fundedRewardPayouts = visibleRewardPayouts.filter((claim) => claim.status === "PAYOUT_APPLIED");
  const rewardPayoutTotal = visibleRewardPayouts.reduce((total, claim) => total + claim.rewardValueCents, 0);
  const statusOptions = [
    { label: "All statuses", value: "ALL" },
    { label: "Pending", value: "PENDING" },
    { label: "Ready", value: "APPROVED" },
    { label: "Paid", value: "PAID" },
    { label: "Deferred", value: "REJECTED" }
  ];
  const roleOptions = [
    { label: "All roles", value: "ALL" },
    { label: "Partners", value: "PARTNER" },
    { label: "Managers", value: "MANAGER" },
    { label: "Leaders", value: "GROUP_LEADER" },
    { label: "Sellers", value: "CONSULTANT" }
  ];

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden">
        <div className="border-b border-border p-6 sm:p-8">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-clinic-red">{copy.eyebrow}</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-clinic-ink sm:text-5xl">{copy.title}</h2>
              <p className="mt-4 max-w-4xl text-lg leading-8 text-slate-600">{copy.description}</p>
            </div>
            <div className="rounded-[28px] border border-blue-100 bg-blue-50 p-5 text-clinic-navy">
              <div className="flex items-start gap-3">
                <ShieldCheck className="mt-1 h-5 w-5 shrink-0" />
                <div>
                  <p className="font-semibold">Payment responsibility is role-based</p>
                  <p className="mt-1 text-sm leading-6 text-slate-600">
                    {scope === "admin" ? "Company payout queue only shows partner obligations." : "Partner queue only shows network obligations funded by the partner pool."}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-4">
          <PayoutMetric label={copy.owedLabel} value={pending} helper="Not payable until approval or fulfillment is complete." tone="red" icon={Clock3} />
          <PayoutMetric label={copy.readyLabel} value={approved} helper="Approved and ready to be recorded as paid." tone="green" icon={BadgeCheck} />
          <PayoutMetric label={copy.paidLabel} value={paid} helper="Already closed in the payout ledger." tone="blue" icon={CheckCircle2} />
          <PayoutMetric label="Deferred / lost" value={deferred} helper="Rejected, refunded, or no longer payable." tone="navy" icon={LockKeyhole} />
        </div>
      </Card>

      {scope === "admin" ? (
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="p-6">
            <div className="flex items-center gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-clinic-mist text-clinic-navy">
                <Landmark className="h-5 w-5" />
              </span>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Company gross margin</p>
                <p className="text-2xl font-semibold text-clinic-navy">{dollars(grossMargin)}</p>
              </div>
            </div>
          </Card>
          <Card className="p-6">
            <div className="flex items-center gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-clinic-red">
                <WalletCards className="h-5 w-5" />
              </span>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Partner pool</p>
                <p className="text-2xl font-semibold text-clinic-red">{dollars(partnerPool)}</p>
              </div>
            </div>
          </Card>
          <Card className="p-6">
            <div className="flex items-center gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
                <Sparkles className="h-5 w-5" />
              </span>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Company net before rewards</p>
                <p className="text-2xl font-semibold text-emerald-700">{dollars(companyNet)}</p>
              </div>
            </div>
          </Card>
        </div>
      ) : null}

      {scope === "partner" ? (
        <PartnerPayoutOverview teamRows={rows} companyPayments={companyPayments} entries={entries} rewardPayouts={visibleRewardPayouts} />
      ) : null}

      <RecordFilters
        title="Payout filters"
        description="Search by partner, team member, customer, order, status, or role."
        searchPlaceholder="Search payouts, customers, orders..."
        filters={filters ?? {}}
        resetHref={resetPath(scope)}
        selects={[
          { name: "status", label: "Status", options: statusOptions },
          { name: "role", label: "Role", options: roleOptions }
        ]}
      />

      {scope === "partner" && companyPayments.length ? (
        <Card className="overflow-hidden rounded-[28px] border-blue-100 bg-blue-50/40">
          <div className="border-b border-blue-100 p-6">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-clinic-red">Company payments received</p>
            <h3 className="mt-2 text-2xl font-semibold text-clinic-ink">Partner payout packets</h3>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              These are the partner commissions paid or owed by the company. Each packet maps to the team obligations below so you can identify who to pay and how much.
            </p>
          </div>
          <div className="grid gap-3 p-4 lg:grid-cols-2">
            {companyPayments.map((entry) => {
              const obligations = relatedPartnerObligations(entry, entries);
              const teamOwed = sum(obligations);
              const packetAmount = partnerPacketAmount(entry, entries);
              const partnerKeeps = Math.max(packetAmount - teamOwed, 0);
              return (
                <div key={entry.id} className="rounded-[24px] border border-border bg-white p-4 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <Link href={orderHref(scope, entry.orderId)} className="inline-flex items-center gap-2 font-semibold text-clinic-navy">
                        {entry.orderNumber} <ArrowUpRight className="h-4 w-4" />
                      </Link>
                      <p className="mt-1 text-sm text-slate-600">{entry.customerName}</p>
                    </div>
                    <Badge className={cn("px-3 py-1.5", statusClassName[entry.status])}>{statusCopy[entry.status]}</Badge>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div className="rounded-2xl bg-clinic-mist p-3">
                      <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Received</p>
                      <p className="mt-1 text-xl font-semibold text-clinic-navy">{dollars(packetAmount)}</p>
                    </div>
                    <div className="rounded-2xl bg-emerald-50 p-3">
                      <p className="text-xs font-bold uppercase tracking-[0.14em] text-emerald-700">Team owed</p>
                      <p className="mt-1 text-xl font-semibold text-emerald-700">{dollars(teamOwed)}</p>
                    </div>
                  </div>
                  <div className="mt-3 rounded-2xl border border-blue-100 bg-blue-50 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs font-bold uppercase tracking-[0.14em] text-clinic-navy">Partner keeps</p>
                      <p className="text-lg font-semibold text-clinic-navy">{dollars(partnerKeeps)}</p>
                    </div>
                    {obligations.length ? (
                      <div className="mt-3 grid gap-2">
                        {obligations.map((item) => (
                          <div key={item.id} className="flex items-center justify-between gap-3 rounded-xl bg-white px-3 py-2">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-clinic-ink">{item.participantName}</p>
                              <p className="text-xs text-slate-500">{roleCopy[item.participantRole]}</p>
                            </div>
                            <p className="shrink-0 font-semibold text-emerald-700">{dollars(item.amountCents)}</p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-2 text-sm text-slate-600">No team payout is attached to this order packet.</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      ) : null}

      {scope === "partner" ? (
        <PartnerPayeeLedger summaries={partnerPayeeSummaries} entries={entries} scope={scope} />
      ) : null}

      {scope === "partner" ? (
        <Card className="overflow-hidden rounded-[28px] border-emerald-100 bg-emerald-50/30">
          <div className="border-b border-emerald-100 p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">Cash reward distribution</p>
                <h3 className="mt-2 text-2xl font-semibold text-clinic-ink">Rewards paid through partner payout</h3>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                  Cash rewards are funded to the partner, then the partner pays the manager, leader, or seller who earned the reward. Non-cash rewards stay in the admin fulfillment workflow.
                </p>
              </div>
              <div className="rounded-[24px] bg-white px-5 py-4 shadow-line">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Cash rewards tracked</p>
                <p className="mt-1 text-2xl font-semibold text-emerald-700">{dollars(rewardPayoutTotal)}</p>
              </div>
            </div>
          </div>

          {visibleRewardPayouts.length ? (
            <div>
              {pendingRewardPayouts.length ? (
                <div>
                  <div className="bg-amber-50 px-5 py-3 text-xs font-bold uppercase tracking-[0.16em] text-amber-700">Waiting company funding</div>
                  {pendingRewardPayouts.map((claim) => <RewardPayoutRow key={claim.id} claim={claim} />)}
                </div>
              ) : null}

              {fundedRewardPayouts.length ? (
                <div>
                  <div className="bg-emerald-50 px-5 py-3 text-xs font-bold uppercase tracking-[0.16em] text-emerald-700">Funded to partner</div>
                  {fundedRewardPayouts.map((claim) => <RewardPayoutRow key={claim.id} claim={claim} />)}
                </div>
              ) : null}
            </div>
          ) : (
            <div className="p-8 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-[24px] bg-white text-emerald-700 shadow-line">
                <Sparkles className="h-6 w-6" />
              </div>
              <h3 className="mt-4 text-xl font-semibold text-clinic-ink">No cash reward payouts yet</h3>
              <p className="mx-auto mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                When someone in your network earns a cash reward, it will appear here so you can identify the downstream payment.
              </p>
            </div>
          )}
        </Card>
      ) : null}

      <Card className="overflow-hidden">
        <div className="border-b border-border p-6">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-clinic-red">Payout queue</p>
              <h3 className="mt-2 text-2xl font-semibold text-clinic-ink">Ready and pending items</h3>
            </div>
            <Badge className="w-fit border-blue-200 bg-blue-50 px-4 py-2 text-clinic-navy">{rows.length} payout {rows.length === 1 ? "item" : "items"}</Badge>
          </div>
        </div>

        {rows.length === 0 ? (
          <EmptyPayouts message={copy.empty} />
        ) : (
          <>
            {readyRows.length ? (
              <div>
                <div className="bg-emerald-50 px-5 py-3 text-xs font-bold uppercase tracking-[0.16em] text-emerald-700">Ready to pay</div>
                {readyRows.map((entry) => (
                  <PayoutRow
                    key={entry.id}
                    entry={entry}
                    scope={scope}
                    canMarkPaid={copy.showActions}
                    allEntries={entries}
                    relatedEntries={scope === "admin" ? relatedPartnerObligations(entry, entries) : []}
                    sourceCompanyPayment={scope === "partner" ? partnerCompanyPayments(entries).find((item) => item.orderId === entry.orderId) : undefined}
                  />
                ))}
              </div>
            ) : null}

            {pendingRows.length ? (
              <div>
                <div className="bg-amber-50 px-5 py-3 text-xs font-bold uppercase tracking-[0.16em] text-amber-700">Pending approval</div>
                {pendingRows.map((entry) => (
                  <PayoutRow
                    key={entry.id}
                    entry={entry}
                    scope={scope}
                    canMarkPaid={false}
                    allEntries={entries}
                    relatedEntries={scope === "admin" ? relatedPartnerObligations(entry, entries) : []}
                    sourceCompanyPayment={scope === "partner" ? partnerCompanyPayments(entries).find((item) => item.orderId === entry.orderId) : undefined}
                  />
                ))}
              </div>
            ) : null}

            {historyRows.length ? (
              <div>
                <div className="bg-clinic-mist px-5 py-3 text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Recent history</div>
                {historyRows.map((entry) => (
                  <PayoutRow
                    key={entry.id}
                    entry={entry}
                    scope={scope}
                    canMarkPaid={false}
                    allEntries={entries}
                    relatedEntries={scope === "admin" ? relatedPartnerObligations(entry, entries) : []}
                    sourceCompanyPayment={scope === "partner" ? partnerCompanyPayments(entries).find((item) => item.orderId === entry.orderId) : undefined}
                  />
                ))}
              </div>
            ) : null}
          </>
        )}
      </Card>

      <Card className="overflow-hidden">
        <div className="grid gap-0 lg:grid-cols-3">
          <div className="border-b border-border p-6 lg:border-b-0 lg:border-r">
            <Banknote className="h-6 w-6 text-clinic-red" />
            <h3 className="mt-4 text-xl font-semibold text-clinic-ink">Money path</h3>
            <p className="mt-2 text-slate-600">Gross margin creates the partner pool. The company pays partners, then partners distribute their pool downline.</p>
          </div>
          <div className="border-b border-border p-6 lg:border-b-0 lg:border-r">
            <Clock3 className="h-6 w-6 text-clinic-red" />
            <h3 className="mt-4 text-xl font-semibold text-clinic-ink">Pending rule</h3>
            <p className="mt-2 text-slate-600">Commission stays pending until the order clears approval and fulfillment. Deferred or refunded orders are no longer payable.</p>
          </div>
          <div className="p-6">
            <ShieldCheck className="h-6 w-6 text-clinic-red" />
            <h3 className="mt-4 text-xl font-semibold text-clinic-ink">Role privacy</h3>
            <p className="mt-2 text-slate-600">Sellers only see their own payout. Managers and leaders see their own status. Partners manage the network payout queue.</p>
          </div>
        </div>
      </Card>
    </div>
  );
}
