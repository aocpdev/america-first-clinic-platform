import Link from "next/link";
import type { CommissionParticipantRole, CommissionStatus } from "@prisma/client";
import { ArrowUpRight, CheckCircle2, Clock3, DollarSign, FileText, WalletCards } from "lucide-react";

import type { CommissionLedgerEntry, CommissionLedgerScope } from "@/lib/commissions/queries";
import { cn, currency } from "@/lib/utils";
import { matchesSearch, matchesSelect, normalizeFilters, RecordFilters, type RecordFiltersState } from "@/components/filters/record-filters";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

type CommissionLedgerProps = {
  entries: CommissionLedgerEntry[];
  scope: CommissionLedgerScope;
  title: string;
  description: string;
  filters?: RecordFiltersState;
};

const statusCopy: Record<CommissionStatus, string> = {
  PENDING: "Pending",
  APPROVED: "Approved",
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

function orderHref(scope: CommissionLedgerScope, orderId: string) {
  if (scope === "admin") return `/admin/orders/${orderId}`;
  if (scope === "consultant") return `/consultant/orders/${orderId}`;
  return `/partner/orders/${orderId}`;
}

function dollars(cents: number) {
  return currency(cents / 100);
}

function sum(entries: CommissionLedgerEntry[], predicate: (entry: CommissionLedgerEntry) => boolean) {
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

function ownRoleForScope(scope: CommissionLedgerScope): CommissionParticipantRole | null {
  if (scope === "partner") return "PARTNER";
  if (scope === "manager") return "MANAGER";
  if (scope === "group_leader") return "GROUP_LEADER";
  if (scope === "consultant") return "CONSULTANT";
  return null;
}

function metricsFor(scope: CommissionLedgerScope, entries: CommissionLedgerEntry[]) {
  const scopedEntries = visibleEntries(scope, entries);
  const ownRole = ownRoleForScope(scope);
  const ownEntries = ownRole ? scopedEntries.filter((entry) => entry.participantRole === ownRole) : scopedEntries;
  const teamEntries = ownRole ? scopedEntries.filter((entry) => entry.participantRole !== ownRole) : scopedEntries;
  const pending = sum(ownEntries, (entry) => entry.status === "PENDING");
  const approved = sum(ownEntries, (entry) => entry.status === "APPROVED");
  const paid = sum(ownEntries, (entry) => entry.status === "PAID");
  const deferred = sum(ownEntries, (entry) => entry.status === "REJECTED");

  if (scope === "admin") {
    return [
      { label: "Gross margin", value: uniqueOrderSum(scopedEntries, (entry) => entry.grossMarginCents), icon: DollarSign },
      { label: "Commission pool", value: uniqueOrderSum(scopedEntries, (entry) => entry.commissionPoolCents), icon: WalletCards },
      { label: "Pending payouts", value: sum(scopedEntries, (entry) => entry.status === "PENDING"), icon: Clock3 },
      { label: "Approved payouts", value: sum(scopedEntries, (entry) => entry.status === "APPROVED"), icon: CheckCircle2 }
    ];
  }

  if (scope === "partner") {
    return [
      { label: "Partner profit", value: sum(ownEntries, () => true), icon: DollarSign },
      { label: "Team payouts", value: sum(teamEntries, () => true), icon: WalletCards },
      { label: "Pending", value: pending, icon: Clock3 },
      { label: "Approved", value: approved + paid, icon: CheckCircle2 }
    ];
  }

  if (scope === "manager") {
    return [
      { label: "Personal earnings", value: sum(ownEntries, () => true), icon: DollarSign },
      { label: "Group payouts", value: sum(teamEntries, () => true), icon: WalletCards },
      { label: "Pending", value: pending, icon: Clock3 },
      { label: "Approved", value: approved + paid, icon: CheckCircle2 }
    ];
  }

  if (scope === "group_leader") {
    return [
      { label: "Personal earnings", value: sum(ownEntries, () => true), icon: DollarSign },
      { label: "Seller payouts", value: sum(teamEntries, () => true), icon: WalletCards },
      { label: "Pending", value: pending, icon: Clock3 },
      { label: "Approved", value: approved + paid, icon: CheckCircle2 }
    ];
  }

  return [
    { label: "Your commission", value: sum(ownEntries, () => true), icon: DollarSign },
    { label: "Pending", value: pending, icon: Clock3 },
    { label: "Approved", value: approved + paid, icon: CheckCircle2 },
    { label: "Deferred", value: deferred, icon: FileText }
  ];
}

function visibleEntries(scope: CommissionLedgerScope, entries: CommissionLedgerEntry[]) {
  if (scope === "manager") {
    return entries.filter((entry) => entry.participantRole !== "PARTNER");
  }

  if (scope === "group_leader") {
    return entries.filter((entry) => entry.participantRole === "GROUP_LEADER" || entry.participantRole === "CONSULTANT");
  }

  if (scope === "consultant") {
    return entries.filter((entry) => entry.participantRole === "CONSULTANT");
  }

  return entries;
}

function resetPath(scope: CommissionLedgerScope) {
  if (scope === "admin") return "/admin/commissions";
  if (scope === "manager") return "/manager/commissions";
  if (scope === "consultant") return "/consultant/commissions";
  return "/partner/commissions";
}

function applyCommissionFilters(entries: CommissionLedgerEntry[], filters?: RecordFiltersState) {
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

function helperCopy(scope: CommissionLedgerScope) {
  if (scope === "admin") {
    return "Company-wide ledger across partner pools, manager and leader overrides, seller commissions, approvals, deferrals, and paid payouts.";
  }

  if (scope === "partner") {
    return "Your partner profit and the payout obligations generated by your managers, leaders, and sellers.";
  }

  if (scope === "manager") {
    return "Your personal earnings plus the commission activity for the team assigned to your manager profile.";
  }

  if (scope === "group_leader") {
    return "Your personal earnings plus seller commission activity for the sellers assigned to your leader profile.";
  }

  return "Your order-level commission tracker. Internal partner, manager, and leader splits are intentionally hidden from this view.";
}

function EmptyLedger({ scope }: { scope: CommissionLedgerScope }) {
  return (
    <div className="p-10 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-3xl bg-clinic-mist text-clinic-navy">
        <WalletCards className="h-6 w-6" />
      </div>
      <h2 className="mt-5 text-2xl font-semibold text-clinic-ink">No commissions yet</h2>
      <p className="mx-auto mt-2 max-w-xl text-slate-600">
        {scope === "consultant"
          ? "When paid orders move through approval and fulfillment, your commission activity will appear here."
          : "Once orders generate commission splits, this ledger will show the right financial view for your role."}
      </p>
    </div>
  );
}

export function CommissionLedger({ entries, scope, title, description, filters }: CommissionLedgerProps) {
  const scopedRows = visibleEntries(scope, entries);
  const rows = applyCommissionFilters(scopedRows, filters);
  const metrics = metricsFor(scope, rows);
  const showInternalColumns = scope === "admin" || scope === "partner";
  const showTeamColumns = scope !== "consultant";

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden">
        <div className="border-b border-border p-6 sm:p-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-clinic-red">Commission ledger</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-clinic-ink sm:text-4xl">{title}</h2>
              <p className="mt-3 max-w-3xl text-lg leading-8 text-slate-600">{description}</p>
            </div>
            <Badge className="w-fit border-blue-200 bg-blue-50 px-4 py-2 text-clinic-navy">
              {rows.length} ledger {rows.length === 1 ? "entry" : "entries"}
            </Badge>
          </div>
        </div>
        <div className="grid gap-4 p-5 sm:grid-cols-2 xl:grid-cols-4">
          {metrics.map((metric) => {
            const Icon = metric.icon;
            return (
              <div key={metric.label} className="rounded-[28px] border border-border bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between gap-4">
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">{metric.label}</p>
                  <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-clinic-mist text-clinic-navy">
                    <Icon className="h-5 w-5" />
                  </span>
                </div>
                <p className="mt-5 text-3xl font-semibold text-clinic-navy">{dollars(metric.value)}</p>
              </div>
            );
          })}
        </div>
      </Card>

      <RecordFilters
        title="Commission filters"
        description="Filter commission activity by customer, order, participant, status, or role."
        searchPlaceholder="Search commissions, customers, orders..."
        filters={filters ?? {}}
        resetHref={resetPath(scope)}
        selects={[
          {
            name: "status",
            label: "Status",
            options: [
              { label: "All statuses", value: "ALL" },
              { label: "Pending", value: "PENDING" },
              { label: "Approved", value: "APPROVED" },
              { label: "Paid", value: "PAID" },
              { label: "Deferred", value: "REJECTED" }
            ]
          },
          {
            name: "role",
            label: "Role",
            options: [
              { label: "All roles", value: "ALL" },
              { label: "Partners", value: "PARTNER" },
              { label: "Managers", value: "MANAGER" },
              { label: "Leaders", value: "GROUP_LEADER" },
              { label: "Sellers", value: "CONSULTANT" }
            ]
          }
        ]}
      />

      <Card className="overflow-hidden">
        <div className="border-b border-border p-6">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h3 className="text-2xl font-semibold text-clinic-ink">Order-level activity</h3>
              <p className="mt-1 text-slate-600">{helperCopy(scope)}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {(["PENDING", "APPROVED", "PAID", "REJECTED"] as CommissionStatus[]).map((status) => (
                <Badge key={status} className={cn("px-3 py-1.5", statusClassName[status])}>
                  {statusCopy[status]}
                </Badge>
              ))}
            </div>
          </div>
        </div>

        {rows.length === 0 ? (
          <EmptyLedger scope={scope} />
        ) : (
          <>
            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full min-w-[980px] text-left text-sm">
                <thead className="bg-clinic-mist text-xs uppercase tracking-[0.14em] text-slate-500">
                  <tr>
                    <th className="px-5 py-4">Order</th>
                    <th className="px-5 py-4">Customer</th>
                    {showTeamColumns ? <th className="px-5 py-4">Participant</th> : null}
                    <th className="px-5 py-4">Amount</th>
                    {showInternalColumns ? <th className="px-5 py-4">Margin</th> : null}
                    {showInternalColumns ? <th className="px-5 py-4">Pool</th> : null}
                    <th className="px-5 py-4">Status</th>
                    <th className="px-5 py-4">Created</th>
                    <th className="px-5 py-4">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border bg-white">
                  {rows.map((entry) => (
                    <tr key={entry.id} className="align-top">
                      <td className="px-5 py-5">
                        <p className="font-semibold text-clinic-navy">{entry.orderNumber}</p>
                        <p className="mt-1 text-slate-500">{dollars(entry.orderTotalCents)} sale</p>
                      </td>
                      <td className="px-5 py-5">
                        <p className="font-semibold text-clinic-ink">{entry.customerName}</p>
                        <p className="mt-1 break-all text-slate-500">{entry.customerEmail}</p>
                      </td>
                      {showTeamColumns ? (
                        <td className="px-5 py-5">
                          <p className="font-semibold text-clinic-ink">{entry.participantName}</p>
                          <p className="mt-1 text-slate-500">{roleCopy[entry.participantRole]}</p>
                        </td>
                      ) : null}
                      <td className="px-5 py-5 text-lg font-semibold text-emerald-700">{dollars(entry.amountCents)}</td>
                      {showInternalColumns ? <td className="px-5 py-5 font-semibold text-clinic-navy">{dollars(entry.grossMarginCents)}</td> : null}
                      {showInternalColumns ? <td className="px-5 py-5 font-semibold text-clinic-red">{dollars(entry.commissionPoolCents)}</td> : null}
                      <td className="px-5 py-5">
                        <Badge className={cn("px-3 py-1.5", statusClassName[entry.status])}>{statusCopy[entry.status]}</Badge>
                      </td>
                      <td className="px-5 py-5 text-slate-500">{entry.createdAt.toLocaleDateString("en-US")}</td>
                      <td className="px-5 py-5">
                        <Link className="inline-flex items-center gap-2 font-semibold text-clinic-navy" href={orderHref(scope, entry.orderId)}>
                          Open <ArrowUpRight className="h-4 w-4" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="grid gap-4 p-4 lg:hidden">
              {rows.map((entry) => (
                <div key={entry.id} className="rounded-[28px] border border-border bg-white p-5 shadow-sm">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">{entry.orderNumber}</p>
                      <h3 className="mt-2 text-xl font-semibold text-clinic-ink">{entry.customerName}</h3>
                      <p className="mt-1 break-all text-sm text-slate-500">{entry.customerEmail}</p>
                    </div>
                    <Badge className={cn("shrink-0 px-3 py-1.5", statusClassName[entry.status])}>{statusCopy[entry.status]}</Badge>
                  </div>
                  {showTeamColumns ? (
                    <div className="mt-4 rounded-2xl bg-clinic-mist p-4">
                      <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">{roleCopy[entry.participantRole]}</p>
                      <p className="mt-1 font-semibold text-clinic-ink">{entry.participantName}</p>
                    </div>
                  ) : null}
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div className="rounded-2xl bg-emerald-50 p-4">
                      <p className="text-xs font-bold uppercase tracking-[0.14em] text-emerald-700">Amount</p>
                      <p className="mt-2 text-2xl font-semibold text-emerald-700">{dollars(entry.amountCents)}</p>
                    </div>
                    <div className="rounded-2xl bg-clinic-mist p-4">
                      <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Sale</p>
                      <p className="mt-2 text-2xl font-semibold text-clinic-navy">{dollars(entry.orderTotalCents)}</p>
                    </div>
                  </div>
                  <Link className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-clinic-navy px-4 py-3 font-semibold text-white" href={orderHref(scope, entry.orderId)}>
                    Open order <ArrowUpRight className="h-4 w-4" />
                  </Link>
                </div>
              ))}
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
