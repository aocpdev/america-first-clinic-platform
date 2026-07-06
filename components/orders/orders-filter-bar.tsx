"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronDown, Search, SlidersHorizontal, X } from "lucide-react";

import { Card } from "@/components/ui/card";
import { normalizeFilters, type FilterSelect, type RecordFiltersState } from "@/components/filters/record-filters";

type OrdersFilterBarProps = {
  filters: RecordFiltersState;
  selects: FilterSelect[];
  resetHref: string;
  visibleCount: number;
  totalCount: number;
};

export function OrdersFilterBar({ filters, selects, resetHref, visibleCount, totalCount }: OrdersFilterBarProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const normalized = normalizeFilters(filters);
  const activeFilterCount = [
    normalized.q,
    ...selects.map((select) => normalized[select.name as keyof RecordFiltersState]).filter((value) => value && value !== "ALL"),
    filters.range && filters.range !== "ALL" ? filters.range : "",
    filters.from,
    filters.to
  ].filter(Boolean).length;

  useEffect(() => {
    if (!isOpen) return;

    function closeOnOutsidePointer(event: PointerEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("pointerdown", closeOnOutsidePointer);
    return () => document.removeEventListener("pointerdown", closeOnOutsidePointer);
  }, [isOpen]);

  return (
    <Card className="relative z-20 rounded-[2rem] border border-white/80 bg-white/90 p-4 shadow-[0_18px_60px_rgba(7,55,99,0.07)] backdrop-blur">
      <form className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 flex-1">
          <label className="relative block max-w-2xl">
            <span className="sr-only">Search orders</span>
            <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-slate-400" />
            <input
              name="q"
              defaultValue={normalized.q}
              placeholder="Search orders, customers, products, agents..."
              className="h-12 w-full rounded-2xl border border-border bg-white pl-12 pr-4 text-sm font-semibold text-clinic-ink shadow-sm outline-none transition placeholder:text-slate-400 focus:border-clinic-blue/40 focus:ring-4 focus:ring-blue-100"
            />
          </label>
          <p className="mt-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
            Showing {visibleCount} of {totalCount} orders
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <div
            ref={menuRef}
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
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  setIsOpen(false);
                  event.currentTarget.blur();
                }
              }}
            >
              <SlidersHorizontal className="size-4" />
              Filters
              {activeFilterCount ? <span className="size-2 rounded-full bg-clinic-red" /> : null}
              <ChevronDown className={`size-4 text-slate-400 transition ${isOpen ? "rotate-180" : ""}`} />
            </button>

            <div
              className={`${isOpen ? "block" : "hidden"} absolute right-0 top-14 z-50 w-[min(92vw,28rem)] rounded-3xl border border-white/80 bg-white/95 p-4 text-left shadow-[0_24px_70px_rgba(15,35,58,0.18)] ring-1 ring-slate-900/5 backdrop-blur-xl`}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">Order filters</p>
                  <p className="mt-1 text-sm text-slate-500">Refine by date, payment, pipeline step, or commission status.</p>
                </div>
                {activeFilterCount ? (
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

              <div className="mt-4 grid gap-3">
                <label>
                  <span className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Date range</span>
                  <select
                    name="range"
                    defaultValue={filters.range ?? "ALL"}
                    className="mt-2 h-12 w-full rounded-2xl border border-border bg-white px-3 text-sm font-semibold text-clinic-ink outline-none transition focus:border-clinic-blue/40 focus:ring-4 focus:ring-blue-100"
                  >
                    <option value="ALL">All time</option>
                    <option value="7d">Last 7 days</option>
                    <option value="30d">Last 30 days</option>
                    <option value="90d">Last 90 days</option>
                    <option value="custom">Custom</option>
                  </select>
                </label>

                <div className="grid gap-3 sm:grid-cols-2">
                  <label>
                    <span className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">From</span>
                    <input
                      name="from"
                      type="date"
                      defaultValue={filters.from ?? ""}
                      className="mt-2 h-12 w-full rounded-2xl border border-border bg-white px-3 text-sm font-semibold text-clinic-ink outline-none transition focus:border-clinic-blue/40 focus:ring-4 focus:ring-blue-100"
                    />
                  </label>
                  <label>
                    <span className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">To</span>
                    <input
                      name="to"
                      type="date"
                      defaultValue={filters.to ?? ""}
                      className="mt-2 h-12 w-full rounded-2xl border border-border bg-white px-3 text-sm font-semibold text-clinic-ink outline-none transition focus:border-clinic-blue/40 focus:ring-4 focus:ring-blue-100"
                    />
                  </label>
                </div>

                {selects.map((select) => {
                  const value = normalized[select.name as keyof RecordFiltersState] || select.value || "ALL";
                  return (
                    <label key={select.name}>
                      <span className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">{select.label}</span>
                      <select
                        name={select.name}
                        defaultValue={value}
                        className="mt-2 h-12 w-full rounded-2xl border border-border bg-white px-3 text-sm font-semibold text-clinic-ink outline-none transition focus:border-clinic-blue/40 focus:ring-4 focus:ring-blue-100"
                      >
                        {select.options.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  );
                })}
              </div>
            </div>
          </div>

          <button className="h-12 rounded-2xl bg-clinic-navy px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-clinic-blue">
            Apply
          </button>
        </div>
      </form>
    </Card>
  );
}
