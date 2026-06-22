import Link from "next/link";
import { BarChart3, Download, FileDown, LineChart, Package, Users } from "lucide-react";
import { DashboardDateRangeFilter } from "@/components/dashboard/date-range-filter";
import { RevenueChart } from "@/components/dashboard/revenue-chart";
import { Card } from "@/components/ui/card";
import type { DashboardDateRange } from "@/lib/dashboard/date-range";
import { currency } from "@/lib/utils";

type ReportWorkspaceData = {
  totalRevenueCents: number;
  totalEarningsCents: number;
  directRevenueCents: number;
  directEarningsCents: number;
  paidOrderCount: number;
  averageOrderCents: number;
  chartData: Array<{ month: string; revenue: number; earnings: number }>;
  topProducts: Array<{ title: string; sku: string; quantity: number; revenueCents: number }>;
  teamRows: Array<{ name: string; role: string; orders: number; revenueCents: number; earningsCents: number }>;
  recentOrders: Array<{
    id: string;
    createdAt: Date;
    customerName: string;
    customerEmail: string;
    sellerName: string;
    sellerRole: string;
    totalCents: number;
    earningsCents: number;
    products: string;
  }>;
};

type ReportsWorkspaceProps = {
  title: string;
  eyebrow: string;
  range: DashboardDateRange;
  resetHref: string;
  exportBaseHref: string;
  earningsLabel: string;
  directLabel: string;
  scopeDescription: string;
  data: ReportWorkspaceData;
};

function shortId(id: string) {
  return id.slice(0, 8).toUpperCase();
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(date);
}

function exportHref(base: string, type: string, range: DashboardDateRange) {
  const params = new URLSearchParams({ type, range: range.preset });
  if (range.preset === "custom") {
    if (range.fromInput) params.set("from", range.fromInput);
    if (range.toInput) params.set("to", range.toInput);
  }
  return `${base}?${params.toString()}`;
}

export function ReportsWorkspace({
  title,
  eyebrow,
  range,
  resetHref,
  exportBaseHref,
  earningsLabel,
  directLabel,
  scopeDescription,
  data
}: ReportsWorkspaceProps) {
  const exportCards = [
    { type: "sales", label: "Sales CSV", description: "Order, customer, originator, revenue, and earnings." },
    { type: "products", label: "Products CSV", description: "Product mix, quantity sold, SKU, and revenue." },
    { type: "team", label: "Team CSV", description: "Originator performance across your visible scope." }
  ];

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-[2rem] border border-white/80 bg-white shadow-[0_24px_80px_rgba(7,55,99,0.08)]">
        <div className="grid gap-6 p-5 lg:grid-cols-[1fr_auto] lg:p-7">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-clinic-red">{eyebrow}</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-clinic-ink sm:text-4xl">{title}</h2>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-500">{scopeDescription}</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3 lg:min-w-[520px]">
            {exportCards.map((item) => (
              <Link
                key={item.type}
                href={exportHref(exportBaseHref, item.type, range)}
                className="group rounded-3xl border border-border bg-clinic-mist p-4 transition hover:-translate-y-0.5 hover:bg-white hover:shadow-line"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="grid size-10 place-items-center rounded-2xl bg-white text-clinic-navy shadow-sm group-hover:bg-clinic-navy group-hover:text-white">
                    <Download className="size-4" />
                  </span>
                  <FileDown className="size-4 text-slate-400" />
                </div>
                <p className="mt-4 text-sm font-semibold text-clinic-ink">{item.label}</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">{item.description}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <DashboardDateRangeFilter range={range} resetHref={resetHref} />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="rounded-[1.75rem] p-5">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Collected revenue</p>
          <p className="mt-3 text-3xl font-semibold text-clinic-navy">{currency(data.totalRevenueCents / 100)}</p>
          <p className="mt-2 text-sm text-slate-500">{data.paidOrderCount} paid orders</p>
        </Card>
        <Card className="rounded-[1.75rem] p-5">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">{earningsLabel}</p>
          <p className="mt-3 text-3xl font-semibold text-emerald-700">{currency(data.totalEarningsCents / 100)}</p>
          <p className="mt-2 text-sm text-slate-500">Based on captured payments only</p>
        </Card>
        <Card className="rounded-[1.75rem] p-5">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">{directLabel}</p>
          <p className="mt-3 text-3xl font-semibold text-clinic-navy">{currency(data.directRevenueCents / 100)}</p>
          <p className="mt-2 text-sm text-slate-500">{currency(data.directEarningsCents / 100)} direct earnings</p>
        </Card>
        <Card className="rounded-[1.75rem] p-5">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Average order</p>
          <p className="mt-3 text-3xl font-semibold text-clinic-red">{currency(data.averageOrderCents / 100)}</p>
          <p className="mt-2 text-sm text-slate-500">Average captured order value</p>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.35fr_.65fr]">
        <Card className="overflow-hidden rounded-[2rem]">
          <div className="flex flex-col gap-3 border-b border-border p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Trend</p>
              <h3 className="mt-1 text-xl font-semibold text-clinic-ink">Revenue and earnings</h3>
            </div>
            <LineChart className="size-5 text-clinic-red" />
          </div>
          <div className="p-4 sm:p-5">
            <RevenueChart data={data.chartData} earningsLabel={earningsLabel} />
          </div>
        </Card>

        <Card className="overflow-hidden rounded-[2rem]">
          <div className="flex items-center justify-between border-b border-border p-5">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Product mix</p>
              <h3 className="mt-1 text-xl font-semibold text-clinic-ink">Top products</h3>
            </div>
            <Package className="size-5 text-clinic-navy" />
          </div>
          <div className="space-y-3 p-4 sm:p-5">
            {data.topProducts.length ? data.topProducts.map((product) => (
              <div key={`${product.sku}-${product.title}`} className="rounded-2xl border border-border bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-clinic-ink">{product.title}</p>
                    <p className="mt-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">{product.sku || "No SKU"} · {product.quantity} sold</p>
                  </div>
                  <p className="shrink-0 text-sm font-semibold text-clinic-red">{currency(product.revenueCents / 100)}</p>
                </div>
              </div>
            )) : (
              <div className="rounded-2xl border border-dashed border-border bg-clinic-mist p-5 text-sm text-slate-500">No paid product sales in this range.</div>
            )}
          </div>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="overflow-hidden rounded-[2rem]">
          <div className="flex items-center justify-between border-b border-border p-5">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Originators</p>
              <h3 className="mt-1 text-xl font-semibold text-clinic-ink">Team performance</h3>
            </div>
            <Users className="size-5 text-clinic-navy" />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] text-left text-sm">
              <thead className="bg-clinic-mist text-xs uppercase tracking-[0.14em] text-slate-500">
                <tr>
                  <th className="px-5 py-3">Name</th>
                  <th className="px-5 py-3">Role</th>
                  <th className="px-5 py-3">Orders</th>
                  <th className="px-5 py-3">Revenue</th>
                  <th className="px-5 py-3">Earnings</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.teamRows.length ? data.teamRows.map((row) => (
                  <tr key={`${row.role}-${row.name}`}>
                    <td className="px-5 py-4 font-semibold text-clinic-ink">{row.name}</td>
                    <td className="px-5 py-4 text-slate-600">{row.role}</td>
                    <td className="px-5 py-4 text-slate-600">{row.orders}</td>
                    <td className="px-5 py-4 font-semibold text-clinic-navy">{currency(row.revenueCents / 100)}</td>
                    <td className="px-5 py-4 font-semibold text-emerald-700">{currency(row.earningsCents / 100)}</td>
                  </tr>
                )) : (
                  <tr><td className="px-5 py-10 text-center text-slate-500" colSpan={5}>No team sales in this range.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>

        <Card className="overflow-hidden rounded-[2rem]">
          <div className="flex items-center justify-between border-b border-border p-5">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Orders</p>
              <h3 className="mt-1 text-xl font-semibold text-clinic-ink">Recent captured sales</h3>
            </div>
            <BarChart3 className="size-5 text-clinic-red" />
          </div>
          <div className="divide-y divide-border">
            {data.recentOrders.length ? data.recentOrders.map((order) => (
              <div key={order.id} className="p-4 sm:p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="font-semibold text-clinic-ink">#{shortId(order.id)} · {order.customerName}</p>
                    <p className="mt-1 truncate text-sm text-slate-500">{order.customerEmail}</p>
                    <p className="mt-2 line-clamp-2 text-sm text-slate-600">{order.products || "No products listed"}</p>
                  </div>
                  <div className="shrink-0 text-left sm:text-right">
                    <p className="font-semibold text-clinic-navy">{currency(order.totalCents / 100)}</p>
                    <p className="mt-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">{formatDate(order.createdAt)}</p>
                  </div>
                </div>
                <p className="mt-3 text-xs font-semibold uppercase tracking-[0.12em] text-clinic-red">{order.sellerRole}: {order.sellerName}</p>
              </div>
            )) : (
              <div className="p-5 text-sm text-slate-500">No captured orders in this range.</div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
