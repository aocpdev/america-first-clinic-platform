import Link from "next/link";
import { CalendarDays, X } from "lucide-react";

import type { DashboardDateRange } from "@/lib/dashboard/date-range";
import { Card } from "@/components/ui/card";

type DashboardDateRangeFilterProps = {
  range: DashboardDateRange;
  resetHref: string;
  hiddenParams?: Record<string, string | undefined>;
};

const presets = [
  { label: "Last 7 days", value: "7d" },
  { label: "Last 30 days", value: "30d" },
  { label: "Last 90 days", value: "90d" },
  { label: "This month", value: "month" },
  { label: "This year", value: "year" },
  { label: "All time", value: "all" },
  { label: "Custom", value: "custom" }
];

export function DashboardDateRangeFilter({ range, resetHref, hiddenParams = {} }: DashboardDateRangeFilterProps) {
  const isCustom = range.preset === "custom";
  const hasCustomDates = Boolean(range.fromInput || range.toInput);

  return (
    <Card className="mb-6 overflow-hidden rounded-[28px] border-border bg-white shadow-sm">
      <div className="flex flex-col gap-5 p-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-clinic-mist text-clinic-navy">
            <CalendarDays className="h-5 w-5" />
          </span>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-clinic-red">Dashboard date range</p>
            <p className="mt-1 text-sm text-slate-500">Showing KPIs for {range.label.toLowerCase()}.</p>
          </div>
        </div>

        {range.preset !== "30d" || hasCustomDates ? (
          <Link
            href={resetHref}
            className="inline-flex w-fit items-center justify-center gap-2 rounded-2xl border border-border bg-white px-4 py-3 text-sm font-semibold text-clinic-navy shadow-sm transition hover:bg-clinic-mist"
          >
            <X className="h-4 w-4" />
            Reset
          </Link>
        ) : null}
      </div>

      <form className="grid gap-3 border-t border-border bg-clinic-mist/45 p-4 md:grid-cols-[minmax(220px,280px)_repeat(2,minmax(170px,220px))_auto]">
        {Object.entries(hiddenParams).map(([key, value]) => (
          value ? <input key={key} type="hidden" name={key} value={value} /> : null
        ))}
        <label className="block">
          <span className="sr-only">Date range</span>
          <select
            name="range"
            defaultValue={range.preset}
            className="h-14 w-full rounded-2xl border border-border bg-white px-4 text-base font-semibold text-clinic-ink shadow-sm outline-none transition focus:border-clinic-blue focus:ring-4 focus:ring-blue-100"
          >
            {presets.map((preset) => (
              <option key={preset.value} value={preset.value}>
                {preset.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="sr-only">From date</span>
          <input
            name="from"
            type="date"
            defaultValue={isCustom ? range.fromInput : ""}
            className="h-14 w-full rounded-2xl border border-border bg-white px-4 text-base font-semibold text-clinic-ink shadow-sm outline-none transition focus:border-clinic-blue focus:ring-4 focus:ring-blue-100"
          />
        </label>

        <label className="block">
          <span className="sr-only">To date</span>
          <input
            name="to"
            type="date"
            defaultValue={isCustom ? range.toInput : ""}
            className="h-14 w-full rounded-2xl border border-border bg-white px-4 text-base font-semibold text-clinic-ink shadow-sm outline-none transition focus:border-clinic-blue focus:ring-4 focus:ring-blue-100"
          />
        </label>

        <button className="h-14 rounded-2xl bg-clinic-navy px-6 text-base font-semibold text-white shadow-sm transition hover:bg-clinic-blue">
          Apply
        </button>
      </form>
    </Card>
  );
}
