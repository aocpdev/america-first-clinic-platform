import Link from "next/link";
import { ArrowRight, BarChart3, LineChart, Package, ReceiptText, Sparkles, Target, TrendingUp, Users } from "lucide-react";
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
  totalAgencyFeeCents: number;
  directRevenueCents: number;
  directEarningsCents: number;
  paidOrderCount: number;
  averageOrderCents: number;
  chartData: Array<{ month: string; revenue: number; earnings: number }>;
  topProducts: Array<{ title: string; sku: string; quantity: number; revenueCents: number }>;
  teamRows: Array<{
    name: string;
    partnerName: string;
    role: string;
    orders: number;
    revenueCents: number;
    agencyFeeCents: number;
    agentCommissionCents: number;
    partnerOverrideCents: number;
    managerOverrideCents: number;
    leaderOverrideCents: number;
    totalPayoutCents: number;
  }>;
  managerRows?: PerformanceRow[];
  leaderRows?: PerformanceRow[];
  agentRows?: PerformanceRow[];
  recentOrders: Array<{
    id: string;
    createdAt: Date;
    customerName: string;
    customerEmail: string;
    agentName: string;
    agentRole: string;
    partnerName: string;
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

type ComparisonView = "managers" | "leaders" | "agents";
export type ReportView = "overview" | "revenue" | "team" | "products" | "orders" | "network" | "opportunities";

type ReportsWorkspaceProps = {
  title: string;
  eyebrow: string;
  range: DashboardDateRange;
  resetHref: string;
  exportBaseHref: string;
  comparisonView?: ComparisonView;
  comparisonBaseHref?: string;
  activeReport?: ReportView;
  reportBaseHref?: string;
  earningsLabel: string;
  directLabel: string;
  partnerPayoutLabel?: string;
  showAgencyFee?: boolean;
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

export function normalizeReportView(value?: string): ReportView {
  const views: ReportView[] = ["overview", "revenue", "team", "products", "orders", "network", "opportunities"];
  return views.includes(value as ReportView) ? value as ReportView : "overview";
}

export function normalizeComparisonView(value?: string): ComparisonView {
  return value === "leaders" || value === "agents" || value === "managers" ? value : "managers";
}

function reportHref(base: string, report: ReportView, range: DashboardDateRange, compare?: ComparisonView) {
  const params = new URLSearchParams({ report, range: range.preset });
  if (compare) params.set("compare", compare);
  if (range.preset === "custom") {
    if (range.fromInput) params.set("from", range.fromInput);
    if (range.toInput) params.set("to", range.toInput);
  }
  return `${base}?${params.toString()}`;
}

function lastSaleLabel(date: Date | null) {
  return date ? formatDate(date) : "No sales";
}

function percent(value: number) {
  if (!Number.isFinite(value)) return "0%";
  return `${Math.round(value)}%`;
}

function deltaPercent(current: number, previous: number) {
  if (!previous) return current ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

function TrendPill({ value }: { value: number }) {
  const positive = value >= 0;
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold ${positive ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-clinic-red"}`}>
      {positive ? "+" : ""}{percent(value)}
    </span>
  );
}

function BarValue({
  label,
  value,
  max,
  tone = "navy"
}: {
  label: string;
  value: number;
  max: number;
  tone?: "navy" | "green" | "red";
}) {
  const width = max > 0 ? Math.max(4, Math.round((value / max) * 100)) : 0;
  const color = tone === "green" ? "bg-emerald-500" : tone === "red" ? "bg-clinic-red" : "bg-clinic-navy";
  return (
    <div className="rounded-2xl border border-border bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="min-w-0 truncate text-sm font-semibold text-clinic-ink">{label}</p>
        <p className="shrink-0 text-sm font-bold text-clinic-navy">{currency(value / 100)}</p>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-clinic-mist">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}

export function ReportsWorkspace({
  title,
  eyebrow,
  range,
  resetHref,
  exportBaseHref,
  comparisonView = "managers",
  comparisonBaseHref,
  activeReport = "overview",
  reportBaseHref,
  earningsLabel,
  directLabel,
  partnerPayoutLabel = "Partner Override",
  showAgencyFee = false,
  data
}: ReportsWorkspaceProps) {
  const exportOptions = [
    { type: "sales", label: "Sales CSV", description: "Orders, customers, agents, revenue, and earnings." },
    { type: "products", label: "Products CSV", description: "Product mix, quantity sold, SKU, and revenue." },
    { type: "team", label: "Team CSV", description: "Performance by agent and visible team scope." }
  ].map((item) => ({
    href: exportHref(exportBaseHref, item.type, range),
    label: item.label,
    description: item.description
  }));
  const comparisonRows =
    comparisonView === "leaders"
      ? data.leaderRows ?? []
      : comparisonView === "agents"
        ? data.agentRows ?? []
        : data.managerRows ?? [];
  const comparisonTabs: Array<{ value: ComparisonView; label: string; count: number }> = [
    { value: "managers", label: "Managers", count: data.managerRows?.length ?? 0 },
    { value: "leaders", label: "Leaders", count: data.leaderRows?.length ?? 0 },
    { value: "agents", label: "Agents", count: data.agentRows?.length ?? 0 }
  ];
  const selectedReport = activeReport === "network" && !comparisonBaseHref ? "overview" : activeReport;
  const topComparison = comparisonRows[0] ?? null;
  const topAgent = data.teamRows[0] ?? null;
  const topProduct = data.topProducts[0] ?? null;
  const totalPayoutCents = data.teamRows.reduce((sum, row) => sum + row.totalPayoutCents, 0);
  const payoutRatio = data.totalRevenueCents ? (totalPayoutCents / data.totalRevenueCents) * 100 : 0;
  const productConcentration = data.totalRevenueCents && topProduct ? (topProduct.revenueCents / data.totalRevenueCents) * 100 : 0;
  const libraryBaseHref = reportBaseHref ?? resetHref;
  const currentChart = data.chartData[data.chartData.length - 1] ?? { revenue: 0, earnings: 0 };
  const previousChart = data.chartData[data.chartData.length - 2] ?? { revenue: 0, earnings: 0 };
  const revenueDelta = deltaPercent(currentChart.revenue, previousChart.revenue);
  const earningsDelta = deltaPercent(currentChart.earnings, previousChart.earnings);
  const maxTeamRevenue = Math.max(...data.teamRows.map((row) => row.revenueCents), 0);
  const maxProductRevenue = Math.max(...data.topProducts.map((row) => row.revenueCents), 0);
  const reportCards = [
    {
      id: "overview" as const,
      label: "Revenue trend",
      description: "Executive scorecard, trend, and immediate signals.",
      icon: Sparkles
    },
    {
      id: "revenue" as const,
      label: "Revenue analytics",
      description: "Revenue, earnings, AOV, and period movement.",
      icon: LineChart
    },
    {
      id: "team" as const,
      label: "Originators",
      description: "Agent production, commissions, and overrides.",
      icon: Users
    },
    {
      id: "products" as const,
      label: "Product mix",
      description: "Top products and revenue concentration.",
      icon: Package
    },
    {
      id: "orders" as const,
      label: "Orders",
      description: "Recent captured sales and agent attribution.",
      icon: ReceiptText
    },
    ...(comparisonBaseHref
      ? [{
        id: "network" as const,
        label: "Network layers",
        description: "Compare managers, leaders, and agents.",
        icon: TrendingUp
      }]
      : []),
    {
      id: "opportunities" as const,
      label: "Opportunities",
      description: "Signals to coach, scale, or rebalance.",
      icon: Target
    }
  ];

  return (
    <div className="space-y-6">
      <section className="relative z-20 rounded-[2rem] border border-white/80 bg-white/90 p-4 shadow-[0_18px_60px_rgba(7,55,99,0.07)] backdrop-blur">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-clinic-red">{eyebrow}</p>
            <h2 className="mt-1 truncate text-lg font-semibold text-clinic-ink">{title}</h2>
            <p className="mt-1 text-sm text-slate-500">Showing KPIs for {range.label.toLowerCase()}.</p>
          </div>
          <div className="flex w-full flex-wrap justify-end gap-2 lg:w-auto">
            <DashboardDateRangeMenu
              range={range}
              resetHref={resetHref}
              hiddenParams={{
                report: selectedReport,
                ...(comparisonBaseHref ? { compare: comparisonView } : {})
              }}
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
        {showAgencyFee ? (
          <Card className="rounded-[1.75rem] p-5">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Agency fee</p>
              <KpiInfo label="Agency fee" description="Value visible only to Go Virtual Health and transferred automatically from the gross margin that remains after discounts." />
            </div>
            <p className="mt-3 text-3xl font-semibold text-clinic-navy">{currency(data.totalAgencyFeeCents / 100)}</p>
            <p className="mt-2 text-sm text-slate-500">Hidden from customers and sales roles</p>
          </Card>
        ) : null}
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

      <section className="rounded-[2rem] border border-white/80 bg-white p-5 shadow-[0_18px_60px_rgba(7,55,99,0.07)]">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-clinic-red">Report suite</p>
            <h3 className="mt-1 text-2xl font-semibold tracking-tight text-clinic-ink">Choose the analytic lens you want to inspect</h3>
          </div>
          <p className="max-w-2xl text-sm leading-6 text-slate-500">
            Each report uses the selected date range, so revenue, commissions, products, and opportunities stay aligned.
          </p>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {reportCards.map((report) => {
            const Icon = report.icon;
            const selected = report.id === selectedReport;
            return (
              <Link
                key={report.id}
                href={reportHref(libraryBaseHref, report.id, range, comparisonBaseHref ? comparisonView : undefined)}
                className={`group flex items-center gap-4 rounded-3xl border p-4 transition hover:-translate-y-0.5 hover:shadow-line ${
                  selected ? "border-clinic-navy bg-clinic-navy text-white shadow-[0_18px_45px_rgba(7,55,99,0.18)]" : "border-border bg-clinic-mist/55 hover:bg-white"
                }`}
              >
                <span className={`grid size-11 shrink-0 place-items-center rounded-2xl shadow-sm transition ${
                  selected ? "bg-white text-clinic-navy" : "bg-white text-clinic-navy group-hover:bg-clinic-navy group-hover:text-white"
                }`}>
                  <Icon className="size-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className={`block text-sm font-semibold ${selected ? "text-white" : "text-clinic-ink"}`}>{report.label}</span>
                  <span className={`mt-1 block text-xs leading-5 ${selected ? "text-white/75" : "text-slate-500"}`}>{report.description}</span>
                </span>
                <ArrowRight className={`size-4 shrink-0 transition group-hover:translate-x-0.5 ${selected ? "text-white" : "text-slate-400 group-hover:text-clinic-red"}`} />
              </Link>
            );
          })}
        </div>
      </section>

      <section className="rounded-[2rem] border border-white/80 bg-white/95 shadow-[0_24px_80px_rgba(7,55,99,0.08)]">
        <div className="flex flex-col gap-3 border-b border-border p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-clinic-red">Analytics suite</p>
            <h3 className="mt-1 text-2xl font-semibold tracking-tight text-clinic-ink">
              {reportCards.find((report) => report.id === selectedReport)?.label ?? "Overview"}
            </h3>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">
              Filtered to {range.label.toLowerCase()}. Use the date range above to compare campaign periods, payroll windows, or monthly performance.
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-2xl bg-clinic-mist px-3 py-2 text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
            {data.paidOrderCount} orders
          </div>
        </div>

        {selectedReport === "overview" ? (
          <div className="grid gap-6 p-5 xl:grid-cols-[1.25fr_.75fr]">
            <Card className="overflow-hidden rounded-[1.75rem]">
              <div className="flex items-center justify-between border-b border-border p-5">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Executive trend</p>
                  <h4 className="mt-1 text-xl font-semibold text-clinic-ink">Revenue and earnings</h4>
                </div>
                <LineChart className="size-5 text-clinic-red" />
              </div>
              <div className="p-4 sm:p-5">
                <RevenueChart data={data.chartData} earningsLabel={earningsLabel} />
              </div>
            </Card>

            <div className="grid gap-4">
              <div className="rounded-3xl border border-border bg-white p-5">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Period movement</p>
                <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                  <div className="rounded-2xl bg-clinic-mist p-4">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-semibold text-slate-600">Revenue trend</span>
                      <TrendPill value={revenueDelta} />
                    </div>
                    <p className="mt-2 text-2xl font-semibold text-clinic-navy">{currency(currentChart.revenue)}</p>
                  </div>
                  <div className="rounded-2xl bg-clinic-mist p-4">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-semibold text-slate-600">{earningsLabel}</span>
                      <TrendPill value={earningsDelta} />
                    </div>
                    <p className="mt-2 text-2xl font-semibold text-emerald-700">{currency(currentChart.earnings)}</p>
                  </div>
                </div>
              </div>
              <div className="rounded-3xl border border-border bg-white p-5">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Quick read</p>
                <div className="mt-4 space-y-3 text-sm">
                  <div className="flex justify-between gap-4"><span className="text-slate-500">Top originator</span><span className="font-semibold text-clinic-ink">{topAgent?.name ?? "No agent data"}</span></div>
                  <div className="flex justify-between gap-4"><span className="text-slate-500">Top product</span><span className="max-w-44 truncate font-semibold text-clinic-ink">{topProduct?.title ?? "No product data"}</span></div>
                  <div className="flex justify-between gap-4"><span className="text-slate-500">Payout ratio</span><span className="font-semibold text-emerald-700">{percent(payoutRatio)}</span></div>
                  <div className="flex justify-between gap-4"><span className="text-slate-500">Product concentration</span><span className="font-semibold text-clinic-navy">{percent(productConcentration)}</span></div>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {selectedReport === "revenue" ? (
          <div className="grid gap-6 p-5 xl:grid-cols-[1.25fr_.75fr]">
            <Card className="overflow-hidden rounded-[1.75rem]">
              <div className="flex items-center justify-between border-b border-border p-5">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Revenue analytics</p>
                  <h4 className="mt-1 text-xl font-semibold text-clinic-ink">Collected sales vs {earningsLabel.toLowerCase()}</h4>
                </div>
                <LineChart className="size-5 text-clinic-red" />
              </div>
              <div className="p-4 sm:p-5">
                <RevenueChart data={data.chartData} earningsLabel={earningsLabel} />
              </div>
            </Card>
            <Card className="overflow-hidden rounded-[1.75rem]">
              <div className="border-b border-border p-5">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Date comparison</p>
                <h4 className="mt-1 text-xl font-semibold text-clinic-ink">Monthly performance</h4>
              </div>
              <div className="divide-y divide-border">
                {data.chartData.map((bucket) => (
                  <div key={bucket.month} className="grid grid-cols-3 gap-3 px-5 py-4 text-sm">
                    <span className="font-semibold text-clinic-ink">{bucket.month}</span>
                    <span className="text-right text-clinic-navy">{currency(bucket.revenue)}</span>
                    <span className="text-right text-emerald-700">{currency(bucket.earnings)}</span>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        ) : null}

        {selectedReport === "team" ? (
          <div className="space-y-5 p-5">
            <div className="grid gap-4 xl:grid-cols-3">
              {data.teamRows.slice(0, 6).map((row) => (
                <BarValue key={`${row.role}-${row.name}`} label={`${row.name} · ${row.role}`} value={row.revenueCents} max={maxTeamRevenue} />
              ))}
              {!data.teamRows.length ? <div className="rounded-2xl border border-dashed border-border bg-clinic-mist p-5 text-sm text-slate-500">No team sales in this range.</div> : null}
            </div>
            <Card className="overflow-hidden rounded-[1.75rem]">
              <div className="flex items-center justify-between border-b border-border p-5">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Originators</p>
                  <h4 className="mt-1 text-xl font-semibold text-clinic-ink">Team performance</h4>
                </div>
                <Users className="size-5 text-clinic-navy" />
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1240px] text-left text-sm">
                  <thead className="bg-clinic-mist text-xs uppercase tracking-[0.14em] text-slate-500">
                    <tr>
                      <th className="px-5 py-3">Agent name</th>
                      <th className="px-5 py-3">Partner</th>
                      <th className="px-5 py-3">Orders</th>
                      <th className="px-5 py-3">Revenue</th>
                      <th className="px-5 py-3">Agent commission</th>
                      <th className="px-5 py-3">{partnerPayoutLabel}</th>
                      <th className="px-5 py-3">Manager override</th>
                      <th className="px-5 py-3">Leader override</th>
                      <th className="px-5 py-3">Total payout</th>
                      {showAgencyFee ? <th className="px-5 py-3">Agency fee</th> : null}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {data.teamRows.length ? data.teamRows.map((row) => (
                      <tr key={`${row.role}-${row.name}`}>
                        <td className="px-5 py-4">
                          <p className="font-semibold text-clinic-ink">{row.name}</p>
                          <p className="mt-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">{row.role}</p>
                        </td>
                        <td className="px-5 py-4 font-semibold text-slate-600">{row.partnerName}</td>
                        <td className="px-5 py-4 text-slate-600">{row.orders}</td>
                        <td className="px-5 py-4 font-semibold text-clinic-navy">{currency(row.revenueCents / 100)}</td>
                        <td className="px-5 py-4 font-semibold text-emerald-700">{currency(row.agentCommissionCents / 100)}</td>
                        <td className="px-5 py-4 font-semibold text-clinic-navy">{currency(row.partnerOverrideCents / 100)}</td>
                        <td className="px-5 py-4 text-slate-600">{currency(row.managerOverrideCents / 100)}</td>
                        <td className="px-5 py-4 text-slate-600">{currency(row.leaderOverrideCents / 100)}</td>
                        <td className="px-5 py-4 font-semibold text-clinic-ink">{currency(row.totalPayoutCents / 100)}</td>
                        {showAgencyFee ? <td className="px-5 py-4 font-semibold text-clinic-navy">{currency(row.agencyFeeCents / 100)}</td> : null}
                      </tr>
                    )) : (
                      <tr><td className="px-5 py-10 text-center text-slate-500" colSpan={showAgencyFee ? 10 : 9}>No team sales in this range.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        ) : null}

        {selectedReport === "products" ? (
          <div className="grid gap-6 p-5 xl:grid-cols-[.85fr_1.15fr]">
            <Card className="overflow-hidden rounded-[1.75rem]">
              <div className="flex items-center justify-between border-b border-border p-5">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Product mix</p>
                  <h4 className="mt-1 text-xl font-semibold text-clinic-ink">Revenue concentration</h4>
                </div>
                <Package className="size-5 text-clinic-navy" />
              </div>
              <div className="space-y-3 p-5">
                {data.topProducts.slice(0, 8).map((product) => (
                  <BarValue key={`${product.sku}-${product.title}`} label={product.title} value={product.revenueCents} max={maxProductRevenue} tone="red" />
                ))}
                {!data.topProducts.length ? <div className="rounded-2xl border border-dashed border-border bg-clinic-mist p-5 text-sm text-slate-500">No paid product sales in this range.</div> : null}
              </div>
            </Card>
            <Card className="overflow-hidden rounded-[1.75rem]">
              <div className="border-b border-border p-5">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Product table</p>
                <h4 className="mt-1 text-xl font-semibold text-clinic-ink">Units and revenue</h4>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[620px] text-left text-sm">
                  <thead className="bg-clinic-mist text-xs uppercase tracking-[0.14em] text-slate-500">
                    <tr>
                      <th className="px-5 py-3">Product</th>
                      <th className="px-5 py-3">SKU</th>
                      <th className="px-5 py-3">Units</th>
                      <th className="px-5 py-3">Revenue</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {data.topProducts.length ? data.topProducts.map((product) => (
                      <tr key={`${product.sku}-${product.title}`}>
                        <td className="px-5 py-4 font-semibold text-clinic-ink">{product.title}</td>
                        <td className="px-5 py-4 text-slate-500">{product.sku || "No SKU"}</td>
                        <td className="px-5 py-4 text-slate-600">{product.quantity}</td>
                        <td className="px-5 py-4 font-semibold text-clinic-navy">{currency(product.revenueCents / 100)}</td>
                      </tr>
                    )) : (
                      <tr><td className="px-5 py-10 text-center text-slate-500" colSpan={4}>No product data in this range.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        ) : null}

        {selectedReport === "orders" ? (
          <div className="p-5">
            <Card className="overflow-hidden rounded-[1.75rem]">
              <div className="flex items-center justify-between border-b border-border p-5">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Orders</p>
                  <h4 className="mt-1 text-xl font-semibold text-clinic-ink">Recent captured sales</h4>
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
                    <p className="mt-3 text-xs font-semibold uppercase tracking-[0.12em] text-clinic-red">{order.agentRole}: {order.agentName}</p>
                  </div>
                )) : (
                  <div className="p-5 text-sm text-slate-500">No captured orders in this range.</div>
                )}
              </div>
            </Card>
          </div>
        ) : null}

        {selectedReport === "network" && comparisonBaseHref ? (
          <div className="p-5">
            <Card className="overflow-hidden rounded-[1.75rem] border-white/80 bg-white shadow-[0_24px_80px_rgba(7,55,99,0.08)]">
          <div className="border-b border-border p-5 sm:p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-clinic-red">Network comparison</p>
                <h3 className="mt-2 text-2xl font-semibold tracking-tight text-clinic-ink">Compare performance by team layer</h3>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
                  Switch between managers, leaders, and agents to identify who is driving revenue, average order value, and partner earnings.
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
                    href={`${comparisonHref(comparisonBaseHref, tab.value, range)}&report=network`}
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
          </div>
        ) : null}

        {selectedReport === "opportunities" ? (
          <div className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-3xl border border-border bg-white p-4">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Top originator</p>
              <p className="mt-3 text-lg font-semibold text-clinic-ink">{topAgent?.name ?? "No agent data"}</p>
              <p className="mt-1 text-sm text-slate-500">
                {topAgent ? `${topAgent.orders} orders · ${currency(topAgent.revenueCents / 100)} revenue` : "No paid sales in range"}
              </p>
            </div>
            <div className="rounded-3xl border border-border bg-white p-4">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Top product</p>
              <p className="mt-3 line-clamp-2 text-lg font-semibold text-clinic-ink">{topProduct?.title ?? "No product data"}</p>
              <p className="mt-1 text-sm text-slate-500">
                {topProduct ? `${topProduct.quantity} sold · ${currency(topProduct.revenueCents / 100)}` : "No paid product sales"}
              </p>
            </div>
            <div className="rounded-3xl border border-border bg-white p-4">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Payout ratio</p>
              <p className="mt-3 text-2xl font-semibold text-emerald-700">{percent(payoutRatio)}</p>
              <p className="mt-1 text-sm text-slate-500">Total payout compared with collected revenue.</p>
            </div>
            <div className="rounded-3xl border border-border bg-white p-4">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Product concentration</p>
              <p className="mt-3 text-2xl font-semibold text-clinic-navy">{percent(productConcentration)}</p>
              <p className="mt-1 text-sm text-slate-500">Revenue share from the top product.</p>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}
