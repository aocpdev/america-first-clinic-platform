"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { CalendarDays, ChevronDown, SlidersHorizontal, X } from "lucide-react";

import type { DashboardDateRange } from "@/lib/dashboard/date-range";

type DashboardDateRangeMenuProps = {
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

export function DashboardDateRangeMenu({ range, resetHref, hiddenParams = {} }: DashboardDateRangeMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const isCustom = range.preset === "custom";
  const hasCustomDates = Boolean(range.fromInput || range.toInput);
  const isFiltered = range.preset !== "30d" || hasCustomDates;

  useEffect(() => {
    if (!isOpen) return;

    function closeOnOutsidePointer(event: PointerEvent) {
      if (!wrapperRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("pointerdown", closeOnOutsidePointer);
    return () => document.removeEventListener("pointerdown", closeOnOutsidePointer);
  }, [isOpen]);

  return (
    <div
      ref={wrapperRef}
      className="relative inline-flex"
      onBlur={(event) => {
        const nextFocus = event.relatedTarget as Node | null;
        if (!event.currentTarget.contains(nextFocus)) {
          setIsOpen(false);
        }
      }}
    >
      <button
        type="button"
        className="inline-flex h-12 items-center gap-2 rounded-2xl border border-border bg-white px-4 text-sm font-semibold text-clinic-navy shadow-sm transition hover:border-clinic-blue/30 hover:bg-clinic-mist focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-100"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((current) => !current)}
        onFocus={() => setIsOpen(true)}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            setIsOpen(false);
            event.currentTarget.blur();
          }
        }}
      >
        <SlidersHorizontal className="size-4" />
        Filters
        {isFiltered ? <span className="size-2 rounded-full bg-clinic-red" /> : null}
        <ChevronDown className={`size-4 text-slate-400 transition ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen ? (
        <div className="absolute right-0 top-14 z-50 w-[min(92vw,28rem)] rounded-3xl border border-white/80 bg-white/95 p-4 text-left shadow-[0_24px_70px_rgba(15,35,58,0.18)] ring-1 ring-slate-900/5 backdrop-blur-xl">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-clinic-mist text-clinic-navy">
                <CalendarDays className="size-4" />
              </span>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">Dashboard date range</p>
                <p className="mt-1 text-sm font-semibold text-clinic-ink">{range.label}</p>
              </div>
            </div>
            {isFiltered ? (
              <Link
                href={resetHref}
                className="inline-flex items-center gap-1 rounded-xl px-3 py-2 text-xs font-semibold text-clinic-red transition hover:bg-red-50"
                onClick={() => setIsOpen(false)}
              >
                <X className="size-3.5" />
                Reset
              </Link>
            ) : null}
          </div>

          <form className="mt-4 grid gap-3">
            {Object.entries(hiddenParams).map(([key, value]) => (
              value ? <input key={key} type="hidden" name={key} value={value} /> : null
            ))}
            <label>
              <span className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Range</span>
              <select
                name="range"
                defaultValue={range.preset}
                className="mt-2 h-12 w-full rounded-2xl border border-border bg-white px-3 text-sm font-semibold text-clinic-ink outline-none transition focus:border-clinic-blue/40 focus:ring-4 focus:ring-blue-100"
              >
                {presets.map((preset) => (
                  <option key={preset.value} value={preset.value}>
                    {preset.label}
                  </option>
                ))}
              </select>
            </label>

            <div className="grid gap-3 sm:grid-cols-2">
              <label>
                <span className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">From</span>
                <input
                  name="from"
                  type="date"
                  defaultValue={isCustom ? range.fromInput : ""}
                  className="mt-2 h-12 w-full rounded-2xl border border-border bg-white px-3 text-sm font-semibold text-clinic-ink outline-none transition focus:border-clinic-blue/40 focus:ring-4 focus:ring-blue-100"
                />
              </label>
              <label>
                <span className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">To</span>
                <input
                  name="to"
                  type="date"
                  defaultValue={isCustom ? range.toInput : ""}
                  className="mt-2 h-12 w-full rounded-2xl border border-border bg-white px-3 text-sm font-semibold text-clinic-ink outline-none transition focus:border-clinic-blue/40 focus:ring-4 focus:ring-blue-100"
                />
              </label>
            </div>

            <button className="mt-1 h-12 rounded-2xl bg-clinic-navy px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-clinic-blue">
              Apply filters
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
