"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronDown, Download, FileDown } from "lucide-react";

type ReportExport = {
  href: string;
  label: string;
  description: string;
};

export function ReportExportMenu({ exports }: { exports: ReportExport[] }) {
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

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
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            setIsOpen(false);
            event.currentTarget.blur();
          }
        }}
      >
        <Download className="size-4" />
        Export
        <ChevronDown className={`size-4 text-slate-400 transition ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen ? (
        <div className="absolute right-0 top-14 z-50 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-3xl border border-white/80 bg-white/95 p-2 text-left shadow-[0_24px_70px_rgba(15,35,58,0.18)] ring-1 ring-slate-900/5 backdrop-blur-xl">
          <div className="px-3 py-2">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">Download reports</p>
          </div>
          <div className="space-y-1">
            {exports.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-start gap-3 rounded-2xl px-3 py-3 transition hover:bg-clinic-mist"
                onClick={() => setIsOpen(false)}
              >
                <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl bg-blue-50 text-clinic-navy">
                  <FileDown className="size-4" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-clinic-ink">{item.label}</span>
                  <span className="mt-1 block text-xs leading-5 text-slate-500">{item.description}</span>
                </span>
              </Link>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
