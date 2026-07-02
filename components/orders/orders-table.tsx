import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { AdminDeleteTestOrderButton } from "@/components/orders/admin-delete-test-order-button";
import { OrdersFilterBar } from "@/components/orders/orders-filter-bar";
import Link from "next/link";
import { matchesSearch, matchesSelect, normalizeFilters, type FilterSelect, type RecordFiltersState } from "@/components/filters/record-filters";
import { carrierLabel, carrierTrackingUrl } from "@/lib/orders/tracking";
import { orderPipelineLabel } from "@/lib/sales/pipeline";
import { currency } from "@/lib/utils";

export type OrdersTableMode = "admin" | "partner" | "manager" | "group_leader" | "consultant";

export type OrderRow = {
  id: string;
  customerName: string;
  customerEmail: string;
  customerDateOfBirth: Date | null;
  consultantName: string | null;
  leaderName: string | null;
  partnerName: string | null;
  products: string;
  totalCents: number;
  grossMarginCents: number;
  commissionPoolCents: number;
  partnerProfitCents: number;
  managerProfitCents: number;
  leaderProfitCents: number;
  consultantCommissionCents: number;
  paymentStatus: string;
  orderStatus: string;
  orderPipelineStage: string;
  commissionStatus: string;
  shippingCarrier: string | null;
  shippingTrackingCode: string | null;
  createdAt: string;
  customerId: string;
};

function money(cents: number) {
  return currency(cents / 100);
}

function shortId(id: string) {
  return id.slice(0, 8).toUpperCase();
}

function birthDateLabel(value: Date | null) {
  if (!value) return "DOB not provided";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(value);
}

function resetPath(mode: OrdersTableMode) {
  if (mode === "admin") return "/admin/orders";
  if (mode === "manager") return "/manager/orders";
  if (mode === "consultant") return "/consultant/orders";
  return "/partner/orders";
}

function uniqueOptions(values: string[], fallback: string) {
  const unique = Array.from(new Set(values.filter(Boolean)));
  return [{ label: fallback, value: "ALL" }, ...unique.map((value) => ({ label: value.replaceAll("_", " "), value }))];
}

function orderCreatedDate(value: string) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function startOfDay(value: string) {
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function endOfDay(value: string) {
  const parsed = new Date(`${value}T23:59:59.999`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function rangeCutoff(range?: string) {
  if (!range || range === "ALL") return null;
  const days = range === "7d" ? 7 : range === "90d" ? 90 : range === "30d" ? 30 : null;
  if (!days) return null;
  const cutoff = new Date();
  cutoff.setHours(0, 0, 0, 0);
  cutoff.setDate(cutoff.getDate() - (days - 1));
  return cutoff;
}

function matchesOrderDate(order: OrderRow, filters: RecordFiltersState) {
  const created = orderCreatedDate(order.createdAt);
  if (!created) return true;

  const from = filters.from ? startOfDay(filters.from) : rangeCutoff(filters.range);
  const to = filters.to ? endOfDay(filters.to) : null;

  if (from && created < from) return false;
  if (to && created > to) return false;
  return true;
}

function applyOrderFilters(orders: OrderRow[], filters?: RecordFiltersState) {
  const normalized = normalizeFilters(filters);

  return orders.filter((order) => (
    matchesSearch(normalized.q, [
      order.id,
      shortId(order.id),
      order.customerName,
      order.customerEmail,
      birthDateLabel(order.customerDateOfBirth),
      order.consultantName,
      order.leaderName,
      order.partnerName,
      order.products,
      order.paymentStatus,
      order.commissionStatus,
      orderPipelineLabel(order.orderPipelineStage),
      order.shippingTrackingCode,
      carrierLabel(order.shippingCarrier)
    ]) &&
    matchesSelect(order.paymentStatus, normalized.payment) &&
    matchesSelect(order.orderPipelineStage, normalized.stage) &&
    matchesSelect(order.commissionStatus, normalized.status) &&
    matchesOrderDate(order, filters ?? {})
  ));
}

export function OrdersTable({
  orders,
  mode,
  filters
}: {
  orders: OrderRow[];
  mode: OrdersTableMode;
  filters?: RecordFiltersState;
}) {
  const rows = applyOrderFilters(orders, filters);
  const showAdminFinancials = mode === "admin";
  const showPartnerFinancials = mode === "partner";
  const showManagerFinancials = mode === "manager";
  const showLeaderFinancials = mode === "group_leader";
  const showConsultantFinancials = mode === "consultant";
  const showAdminActions = mode === "admin";
  const basePath = mode === "admin" ? "/admin" : mode === "manager" ? "/manager" : mode === "consultant" ? "/consultant" : "/partner";
  const orderFilterSelects: FilterSelect[] = [
    { name: "payment", label: "Payment", options: uniqueOptions(orders.map((order) => order.paymentStatus), "All payments") },
    {
      name: "stage",
      label: "Stage",
      options: [
        { label: "All stages", value: "ALL" },
        ...Array.from(new Set(orders.map((order) => order.orderPipelineStage).filter(Boolean))).map((value) => ({
          label: orderPipelineLabel(value),
          value
        }))
      ]
    },
    { name: "status", label: "Commission", options: uniqueOptions(orders.map((order) => order.commissionStatus), "All commissions") }
  ];
  const columnCount =
    2 +
    (mode !== "consultant" ? 1 : 0) +
    (showAdminFinancials || showPartnerFinancials || showManagerFinancials ? 1 : 0) +
    (showAdminFinancials ? 1 : 0) +
    7 +
    (showAdminFinancials ? 2 : 0) +
    (showAdminFinancials || showPartnerFinancials ? 1 : 0) +
    (showAdminFinancials || showPartnerFinancials || showManagerFinancials ? 1 : 0) +
    (showAdminFinancials || showPartnerFinancials || showManagerFinancials || showLeaderFinancials ? 1 : 0) +
    (showAdminFinancials || showPartnerFinancials || showManagerFinancials || showLeaderFinancials || showConsultantFinancials ? 1 : 0) +
    (showAdminActions ? 1 : 0);

  return (
    <div className="space-y-6">
      <OrdersFilterBar
        filters={filters ?? {}}
        selects={orderFilterSelects}
        resetHref={resetPath(mode)}
        visibleCount={rows.length}
        totalCount={orders.length}
      />

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full min-w-[1100px] text-left text-sm">
          <thead className="bg-clinic-mist text-xs uppercase tracking-[0.14em] text-slate-500">
            <tr>
              <th className="px-5 py-3">Order</th>
              <th className="px-5 py-3">Customer</th>
              {mode !== "consultant" ? <th className="px-5 py-3">Consultant</th> : null}
              {showAdminFinancials || showPartnerFinancials || showManagerFinancials ? <th className="px-5 py-3">Leader</th> : null}
              {showAdminFinancials ? <th className="px-5 py-3">Partner</th> : null}
              <th className="px-5 py-3">Products</th>
              <th className="px-5 py-3">Total</th>
              {showAdminFinancials ? <th className="px-5 py-3">Margin</th> : null}
              {showAdminFinancials ? <th className="px-5 py-3">Pool</th> : null}
              {showAdminFinancials || showPartnerFinancials ? <th className="px-5 py-3">Partner profit</th> : null}
              {showAdminFinancials || showPartnerFinancials || showManagerFinancials ? <th className="px-5 py-3">Manager earnings</th> : null}
              {showAdminFinancials || showPartnerFinancials || showManagerFinancials || showLeaderFinancials ? <th className="px-5 py-3">Leader profit</th> : null}
              {(showAdminFinancials || showPartnerFinancials || showManagerFinancials || showLeaderFinancials || showConsultantFinancials) ? <th className="px-5 py-3">Consultant commission</th> : null}
              <th className="px-5 py-3">Payment</th>
              <th className="px-5 py-3">Step</th>
              <th className="px-5 py-3">Tracking</th>
              <th className="px-5 py-3">Commission</th>
              <th className="px-5 py-3">Created</th>
              {showAdminActions ? <th className="px-5 py-3">Actions</th> : null}
            </tr>
          </thead>
          <tbody className="divide-y divide-border bg-white">
            {rows.map((order) => (
              <tr key={order.id}>
                <td className="px-5 py-4">
                  <Link href={`${basePath}/orders/${order.id}`} className="font-semibold text-clinic-navy transition hover:text-clinic-red">
                    #{shortId(order.id)}
                  </Link>
                </td>
                <td className="px-5 py-4">
                  <Link href={`${basePath}/customers/${order.customerId}`} className="font-semibold text-clinic-ink transition hover:text-clinic-red">
                    {order.customerName}
                  </Link>
                  <p className="mt-1 text-xs text-slate-500">{order.customerEmail}</p>
                  <p className="mt-1 text-xs font-semibold text-clinic-ink">{birthDateLabel(order.customerDateOfBirth)}</p>
                </td>
                {mode !== "consultant" ? <td className="px-5 py-4 text-slate-600">{order.consultantName ?? "Direct sale"}</td> : null}
                {showAdminFinancials || showPartnerFinancials || showManagerFinancials ? <td className="px-5 py-4 text-slate-600">{order.leaderName ?? "No leader"}</td> : null}
                {showAdminFinancials ? <td className="px-5 py-4 text-slate-600">{order.partnerName ?? "Company"}</td> : null}
                <td className="px-5 py-4 text-slate-600">
                  <p className="line-clamp-2">{order.products}</p>
                </td>
                <td className="px-5 py-4 font-semibold text-clinic-ink">{money(order.totalCents)}</td>
                {showAdminFinancials ? <td className="px-5 py-4 font-semibold text-clinic-navy">{money(order.grossMarginCents)}</td> : null}
                {showAdminFinancials ? <td className="px-5 py-4 text-slate-600">{money(order.commissionPoolCents)}</td> : null}
                {showAdminFinancials || showPartnerFinancials ? <td className="px-5 py-4 font-semibold text-clinic-navy">{money(order.partnerProfitCents)}</td> : null}
                {showAdminFinancials || showPartnerFinancials || showManagerFinancials ? <td className="px-5 py-4 font-semibold text-clinic-navy">{money(order.managerProfitCents)}</td> : null}
                {showAdminFinancials || showPartnerFinancials || showManagerFinancials || showLeaderFinancials ? <td className="px-5 py-4 font-semibold text-clinic-navy">{money(order.leaderProfitCents)}</td> : null}
                {(showAdminFinancials || showPartnerFinancials || showManagerFinancials || showLeaderFinancials || showConsultantFinancials) ? <td className="px-5 py-4 font-semibold text-clinic-red">{money(order.consultantCommissionCents)}</td> : null}
                <td className="px-5 py-4"><Badge>{order.paymentStatus}</Badge></td>
                <td className="px-5 py-4"><Badge className="border-blue-100 bg-blue-50 text-clinic-navy">{orderPipelineLabel(order.orderPipelineStage)}</Badge></td>
                <td className="px-5 py-4">
                  {order.shippingTrackingCode ? (
                    carrierTrackingUrl(order.shippingCarrier, order.shippingTrackingCode) ? (
                      <a
                        href={carrierTrackingUrl(order.shippingCarrier, order.shippingTrackingCode) ?? undefined}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex max-w-48 flex-col rounded-2xl bg-blue-50 px-3 py-2 text-xs font-semibold text-clinic-navy transition hover:bg-clinic-mist"
                      >
                        <span>{carrierLabel(order.shippingCarrier)}</span>
                        <span className="truncate underline decoration-blue-200 underline-offset-4">{order.shippingTrackingCode}</span>
                      </a>
                    ) : (
                      <div className="max-w-48 rounded-2xl bg-clinic-mist px-3 py-2 text-xs font-semibold text-clinic-ink">
                        <span className="block">{carrierLabel(order.shippingCarrier)}</span>
                        <span className="block truncate">{order.shippingTrackingCode}</span>
                      </div>
                    )
                  ) : (
                    <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Pending</span>
                  )}
                </td>
                <td className="px-5 py-4"><Badge>{order.commissionStatus}</Badge></td>
                <td className="px-5 py-4 text-slate-600">{order.createdAt}</td>
                {showAdminActions ? (
                  <td className="px-5 py-4">
                    {order.paymentStatus === "CAPTURED" ? (
                      <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Captured</span>
                    ) : (
                      <AdminDeleteTestOrderButton orderId={order.id} compact />
                    )}
                  </td>
                ) : null}
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td className="px-5 py-10 text-center text-slate-500" colSpan={columnCount}>No orders found for this workspace yet.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
        </div>
      </Card>
    </div>
  );
}
