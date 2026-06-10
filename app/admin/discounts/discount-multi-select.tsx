"use client";

import { useMemo, useState } from "react";
import { Check, ChevronDown } from "lucide-react";

type Option = {
  value: string;
  label: string;
};

export function DiscountMultiSelect({
  name,
  label,
  allLabel,
  options,
  defaultValue = [],
  value,
  onChange
}: {
  name: string;
  label: string;
  allLabel: string;
  options: Option[];
  defaultValue?: string[];
  value?: string[];
  onChange?: (value: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [internalSelected, setInternalSelected] = useState(defaultValue);
  const selected = value ?? internalSelected;

  function setSelected(next: string[] | ((current: string[]) => string[])) {
    const resolved = typeof next === "function" ? next(selected) : next;
    if (onChange) {
      onChange(resolved);
      return;
    }
    setInternalSelected(resolved);
  }

  const selectedLabels = useMemo(() => {
    if (selected.length === 0) return allLabel;
    const labelMap = new Map(options.map((option) => [option.value, option.label]));
    const labels = selected.map((value) => labelMap.get(value)).filter(Boolean);
    if (labels.length <= 2) return labels.join(", ");
    return `${labels.slice(0, 2).join(", ")} +${labels.length - 2}`;
  }, [allLabel, options, selected]);

  function toggleValue(value: string) {
    setSelected((current) => {
      if (current.includes(value)) return current.filter((item) => item !== value);
      return [...current, value];
    });
  }

  return (
    <div className="relative">
      {selected.map((value) => (
        <input key={value} type="hidden" name={name} value={value} />
      ))}

      <span className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">{label}</span>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="mt-2 flex min-h-11 w-full items-center justify-between gap-3 rounded-lg border border-input bg-white px-3 py-2 text-left text-sm font-semibold text-clinic-ink shadow-line transition hover:bg-clinic-mist focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="line-clamp-2">{selectedLabels}</span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-slate-400 transition ${open ? "rotate-180" : ""}`} />
      </button>

      {open ? (
        <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-40 overflow-hidden rounded-2xl border border-border bg-white shadow-[0_24px_70px_rgba(15,35,58,0.16)]">
          <div className="max-h-72 overflow-y-auto p-2">
            <button
              type="button"
              onClick={() => setSelected([])}
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm font-semibold transition ${
                selected.length === 0 ? "bg-clinic-mist text-clinic-navy" : "text-slate-600 hover:bg-clinic-mist"
              }`}
            >
              <span className={`flex h-5 w-5 items-center justify-center rounded border ${selected.length === 0 ? "border-clinic-navy bg-clinic-navy text-white" : "border-slate-300 bg-white"}`}>
                {selected.length === 0 ? <Check className="h-3.5 w-3.5" /> : null}
              </span>
              {allLabel}
            </button>

            <div className="my-2 h-px bg-border" />

            {options.map((option) => {
              const checked = selected.includes(option.value);

              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => toggleValue(option.value)}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm font-semibold transition ${
                    checked ? "bg-blue-50 text-clinic-navy" : "text-slate-600 hover:bg-clinic-mist"
                  }`}
                >
                  <span className={`flex h-5 w-5 items-center justify-center rounded border ${checked ? "border-clinic-navy bg-clinic-navy text-white" : "border-slate-300 bg-white"}`}>
                    {checked ? <Check className="h-3.5 w-3.5" /> : null}
                  </span>
                  <span className="line-clamp-2">{option.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
