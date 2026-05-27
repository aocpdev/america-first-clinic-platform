import Link from "next/link";
import { Search, SlidersHorizontal, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";

export type FilterOption = {
  label: string;
  value: string;
};

export type FilterSelect = {
  name: string;
  label: string;
  value?: string;
  options: FilterOption[];
};

export type RecordFiltersState = {
  q?: string;
  status?: string;
  role?: string;
  payment?: string;
  stage?: string;
};

type RecordFiltersProps = {
  title?: string;
  description?: string;
  searchPlaceholder?: string;
  filters: RecordFiltersState;
  selects?: FilterSelect[];
  resetHref: string;
  className?: string;
};

export function normalizeFilters(filters?: RecordFiltersState | null): RecordFiltersState {
  return {
    q: filters?.q?.trim() || "",
    status: filters?.status?.trim() || "ALL",
    role: filters?.role?.trim() || "ALL",
    payment: filters?.payment?.trim() || "ALL",
    stage: filters?.stage?.trim() || "ALL"
  };
}

export function matchesSearch(query: string | undefined, values: Array<string | null | undefined>) {
  const normalized = query?.trim().toLowerCase();
  if (!normalized) return true;
  return values.some((value) => value?.toLowerCase().includes(normalized));
}

export function matchesSelect(value: string | undefined, selected: string | undefined) {
  return !selected || selected === "ALL" || value === selected;
}

export function RecordFilters({
  title = "Search and filters",
  description = "Find records quickly without losing role-based visibility.",
  searchPlaceholder = "Search by name, email, order, product...",
  filters,
  selects = [],
  resetHref,
  className
}: RecordFiltersProps) {
  const normalized = normalizeFilters(filters);
  const hasActiveFilters =
    Boolean(normalized.q) ||
    selects.some((select) => {
      const value = normalized[select.name as keyof RecordFiltersState];
      return Boolean(value && value !== "ALL");
    });

  return (
    <Card className={cn("overflow-hidden rounded-[28px] border-border bg-white shadow-sm", className)}>
      <div className="flex flex-col gap-5 p-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-2xl">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-clinic-mist text-clinic-navy">
              <SlidersHorizontal className="h-5 w-5" />
            </span>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-clinic-red">{title}</p>
              <p className="mt-1 text-sm text-slate-500">{description}</p>
            </div>
          </div>
        </div>

        {hasActiveFilters ? (
          <Link
            href={resetHref}
            className="inline-flex w-fit items-center justify-center gap-2 rounded-2xl border border-border bg-white px-4 py-3 text-sm font-semibold text-clinic-navy shadow-sm transition hover:bg-clinic-mist"
          >
            <X className="h-4 w-4" />
            Clear filters
          </Link>
        ) : null}
      </div>

      <form className="grid gap-3 border-t border-border bg-clinic-mist/45 p-4 lg:grid-cols-[minmax(280px,1fr)_repeat(auto-fit,minmax(180px,240px))_auto]">
        <label className="relative block">
          <span className="sr-only">Search</span>
          <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
          <input
            name="q"
            defaultValue={normalized.q}
            placeholder={searchPlaceholder}
            className="h-14 w-full rounded-2xl border border-border bg-white pl-12 pr-4 text-base font-semibold text-clinic-ink shadow-sm outline-none transition placeholder:text-slate-400 focus:border-clinic-blue focus:ring-4 focus:ring-blue-100"
          />
        </label>

        {selects.map((select) => {
          const value = normalized[select.name as keyof RecordFiltersState] || select.value || "ALL";
          return (
            <label key={select.name} className="block">
              <span className="sr-only">{select.label}</span>
              <select
                name={select.name}
                defaultValue={value}
                className="h-14 w-full rounded-2xl border border-border bg-white px-4 text-base font-semibold text-clinic-ink shadow-sm outline-none transition focus:border-clinic-blue focus:ring-4 focus:ring-blue-100"
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

        <button className="h-14 rounded-2xl bg-clinic-navy px-6 text-base font-semibold text-white shadow-sm transition hover:bg-clinic-blue">
          Apply
        </button>
      </form>
    </Card>
  );
}
