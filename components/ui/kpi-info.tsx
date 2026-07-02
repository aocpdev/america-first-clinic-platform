"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Info } from "lucide-react";

export function KpiInfo({ label, description }: { label: string; description: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const tooltipId = useId();

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
      className="relative inline-flex shrink-0"
      onBlur={(event) => {
        const nextFocus = event.relatedTarget as Node | null;
        if (!event.currentTarget.contains(nextFocus)) {
          setIsOpen(false);
        }
      }}
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
    >
      <button
        type="button"
        aria-controls={tooltipId}
        aria-expanded={isOpen}
        aria-label={`Explain ${label}`}
        className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-white/90 text-slate-500 shadow-sm outline-none transition hover:border-clinic-blue/40 hover:bg-clinic-mist hover:text-clinic-navy focus-visible:ring-4 focus-visible:ring-blue-100"
        onClick={() => setIsOpen((current) => !current)}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            setIsOpen(false);
            event.currentTarget.blur();
          }
        }}
      >
        <Info className="h-4 w-4" />
      </button>

      {isOpen ? (
        <div
          id={tooltipId}
          role="tooltip"
          className="absolute right-0 top-10 z-50 w-72 max-w-[calc(100vw-2rem)] rounded-2xl border border-white/80 bg-white/95 p-4 text-left opacity-100 shadow-[0_24px_70px_rgba(15,35,58,0.18)] ring-1 ring-slate-900/5 backdrop-blur-xl"
        >
          <span className="absolute -top-1.5 right-3 h-3 w-3 rotate-45 border-l border-t border-white/80 bg-white/95" />
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">What this means</p>
          <p className="mt-2 text-sm font-semibold leading-5 text-clinic-ink">{label}</p>
          <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
        </div>
      ) : null}
    </div>
  );
}
