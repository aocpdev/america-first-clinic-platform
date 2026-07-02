import Link from "next/link";
import { BarChart3, LineChart, Package, TrendingUp, Users } from "lucide-react";
import { DashboardDateRangeMenu } from "@/components/dashboard/date-range-menu";
import { RevenueChart } from "@/components/dashboard/revenue-chart";
import { ReportExportMenu } from "@/components/reports/report-export-menu";
import { Card } from "@/components/ui/card";
import { KpiInfo } from "@/components/ui/kpi-info";
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
  managerRows?: PerformanceRow[];
  leaderRows?: PerformanceRow[];
  sellerRows?: PerformanceRow[];
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

type PerformanceRow = {
  id: string;
  name: string;
  role: string;
  orders: number;
  revenueCents: number;
  earningsCents: number;
  averageOrderCents: number;
  lastSaleAt: Date | null;
};

type ComparisonView = "managers" | "leaders" | "sellers";

type ReportsWorkspaceProps = {
  title: string;
  eyebrow: string;
  range: DashboardDateRange;
  resetHref: string;
  exportBaseHref: string;
  comparisonView?: ComparisonView;
  comparisonBaseHref?: string;
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

function comparisonHref(base: string, view: ComparisonView, range: DashboardDateRange) {
  const params = new URLSearchParams({ compare: view, range: range.preset });
  if (range.preset === "custom") {
    if (range.fromInput) params.set("from", range.fromInput);
    if (range.toInput) params.set("to", range.toInput);
  }
  return `${base}?${params.toString()}`;
}

function lastSaleLabel(date: Date | null) {
  return date ? formatDate(date) : "No sales";
}

export function ReportsWorkspace({
  title,
  eyebrow,
  range,
  resetHref,
  exportBaseHref,
  comparisonView = "managers",
  comparisonBaseHref,
  earningsLabel,
  directLabel,
  data
}: ReportsWorkspaceProps) {
  const exportOptions = [
    { type: "sales", label: "Sales CSV", description: "Orders, customers, sellers, revenue, and earnings." },
    { type: "products", label: "Products CSV", description: "Product mix, quantity sold, SKU, and revenue." },
    { type: "team", label: "Team CSV", description: "Performance by seller and visible team scope." }
  ].map((item) => ({
    href: exportHref(exportBaseHref, item.type, range),
    label: item.label,
    description: item.description
  }));
  const comparisonRows =
    comparisonView === "leaders"
      ? data.leaderRows ?? []
      : comparisonView === "sellers"
        ? data.sellerRows ?? []
        : data.managerRows ?? [];
  const comparisonTabs: Array<{ value: ComparisonView; label: string; count: number }> = [
    { value: "managers", label: "Managers", count: data.managerRows?.length ?? 0 },
    { value: "leaders", label: "Leaders", count: data.leaderRows?.length ?? 0 },
    { value: "sellers", label: "Sellers", count: data.sellerRows?.length ?? 0 }
  ];
  const topComparison = comparisonRows[0] ?? null;

  return (
    <div className="space-y-6">
      <section className="relative z-20 rounded-[2rem] border border-white/80 bg-white/90 p-4 shadow-[0_18px_60px_rgba(7,55,99,0.07)] backdrop-blur">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-clinic-red">{eyebrow}</p>
            <h2 className="mt-1 truncate text-lg font-semibold text-clinic-ink">{title}</h2>
            <p className="mt-1 text-sm text-slate-500">Showing KPIs for {range.label.toLowerCase()}.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <DashboardDateRangeMenu
              range={range}
              resetHref={resetHref}
              hiddenParams={comparisonBaseHref ? { compare: comparisonView } : undefined}
            />
            <ReportExportMenu exports={exportOptions} />
          </div>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="rounded-[1.75rem] p-5">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Collected revenue</p>
            <KpiInfo label="Collected revenue" description="Total money collected from paid orders in this report." />
          </div>
          <p className="mt-3 text-3xl font-semibold text-clinic-navy">{currency(data.totalRevenueCents / 100)}</p>
          <p className="mt-2 text-sm text-slate-500">{data.paidOrderCount} paid orders</p>
        </Card>
        <Card className="rounded-[1.75rem] p-5">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">{earningsLabel}</p>
            <KpiInfo label={earningsLabel} description="Profit or commission earned from paid orders in this report." />
          </div>
          <p className="mt-3 text-3xl font-semibold text-emerald-700">{currency(data.totalEarningsCents / 100)}</p>
          <p className="mt-2 text-sm text-slate-500">Based on captured payments only</p>
        </Card>
        <Card className="rounded-[1.75rem] p-5">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">{directLabel}</p>
            <KpiInfo label={directLabel} description="Money collected from orders personally created by this role." />
          </div>
          <p className="mt-3 text-3xl font-semibold text-clinic-navy">{currency(data.directRevenueCents / 100)}</p>
          <p className="mt-2 text-sm text-slate-500">{currency(data.directEarningsCents / 100)} direct earnings</p>
        </Card>
        <Card className="rounded-[1.75rem] p-5">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Average order</p>
            <KpiInfo label="Average order" description="Average amount collected per paid order." />
          </div>
          <p className="mt-3 text-3xl font-semibold text-clinic-red">{currency(data.averageOrderCents / 100)}</p>
          <p className="mt-2 text-sm text-slate-500">Average captured order value</p>
        </Card>
      </div>

      {comparisonBaseHref ? (
        <Card className="overflow-hidden rounded-[2rem] border-white/80 bg-white shadow-[0_24px_80px_rgba(7,55,99,0.08)]">
          <div className="border-b border-border p-5 sm:p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-clinic-red">Network comparison</p>
                <h3 className="mt-2 text-2xl font-semibold tracking-tight text-clinic-ink">Compare performance by team layer</h3>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
                  Switch between managers, leaders, and sellers to identify who is driving revenue, average order value, and partner earnings.
                </p>
              </div>
              {topComparison ? (
                <div className="rounded-3xl border border-emerald-100 bg-emerald-50 px-5 py-4 lg:min-w-72">
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-700">Top performer</p>
                  <p className="mt-2 text-lg font-semibold text-clinic-ink">{topComparison.name}</p>
                  <p className="mt-1 text-sm text-emerald-800">{currency(topComparison.revenueCents / 100)} revenue</p>
                </div>
              ) : null}
            </div>
            <div className="mt-5 flex gap-2 overflow-x-auto rounded-2xl bg-clinic-mist p-1">
              {comparisonTabs.map((tab) => {
                const active = tab.value === comparisonView;
                return (
                  <Link
                    key={tab.value}
                    href={comparisonHref(comparisonBaseHref, tab.value, range)}
                    className={`flex min-w-fit items-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition ${
                      active ? "bg-white text-clinic-navy shadow-line" : "text-slate-500 hover:bg-white/70 hover:text-clinic-ink"
                    }`}
                  >
                    {tab.label}
                    <span className={`rounded-full px-2 py-0.5 text-xs ${active ? "bg-blue-50 text-clinic-navy" : "bg-white text-slate-500"}`}>{tab.count}</span>
                  </Link>
                );
              })}
            </div>
          </div>

          <div className="grid gap-0 xl:grid-cols-[1fr_320px]">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="bg-clinic-mist text-xs uppercase tracking-[0.14em] text-slate-500">
                  <tr>
                    <th className="px-5 py-3">Name</th>
                    <th className="px-5 py-3">Role</th>
                    <th className="px-5 py-3">Orders</th>
                    <th className="px-5 py-3">Revenue</th>
                    <th className="px-5 py-3">Avg order</th>
                    <th className="px-5 py-3">Partner earnings</th>
                    <th className="px-5 py-3">Last sale</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {comparisonRows.length ? comparisonRows.map((row) => (
                    <tr key={`${row.role}-${row.id}`}>
                      <td className="px-5 py-4 font-semibold text-clinic-ink">{row.name}</td>
                      <td className="px-5 py-4 text-slate-600">{row.role}</td>
                      <td className="px-5 py-4 text-slate-600">{row.orders}</td>
                      <td className="px-5 py-4 font-semibold text-clinic-navy">{currency(row.revenueCents / 100)}</td>
                      <td className="px-5 py-4 text-slate-600">{currency(row.averageOrderCents / 100)}</td>
                      <td className="px-5 py-4 font-semibold text-emerald-700">{currency(row.earningsCents / 100)}</td>
                      <td className="px-5 py-4 text-slate-600">{lastSaleLabel(row.lastSaleAt)}</td>
                    </tr>
                  )) : (
                    <tr>
                      <td className="px-5 py-10 text-center text-slate-500" colSpan={7}>No performance data for this layer in the selected range.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="border-t border-border bg-clinic-mist/45 p-5 xl:border-l xl:border-t-0">
              <div className="rounded-3xl border border-border bg-white p-5">
                <div className="flex items-center gap-3">
                  <span className="grid size-11 place-items-center rounded-2xl bg-blue-50 text-clinic-navy">
                    <TrendingUp className="size-5" />
                  </span>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Quick read</p>
                    <p className="mt-1 text-sm font-semibold text-clinic-ink">{comparisonTabs.find((tab) => tab.value === comparisonView)?.label}</p>
                  </div>
                </div>
                <div className="mt-5 space-y-4 text-sm">
                  <div className="flex justify-between gap-4">
                    <span className="text-slate-500">Active in range</span>
                    <span className="font-semibold text-clinic-ink">{comparisonRows.length}</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-slate-500">Total orders</span>
                    <span className="font-semibold text-clinic-ink">{comparisonRows.reduce((sum, row) => sum + row.orders, 0)}</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-slate-500">Layer revenue</span>
                    <span className="font-semibold text-clinic-navy">{currency(comparisonRows.reduce((sum, row) => sum + row.revenueCents, 0) / 100)}</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-slate-500">Layer earnings</span>
                    <span className="font-semibold text-emerald-700">{currency(comparisonRows.reduce((sum, row) => sum + row.earningsCents, 0) / 100)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Card>
      ) : null}

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
