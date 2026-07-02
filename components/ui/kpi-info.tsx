import { Info } from "lucide-react";

export function KpiInfo({ label, description }: { label: string; description: string }) {
  return (
    <details className="group relative inline-flex shrink-0">
      <summary
        aria-label={`Explain ${label}`}
        className="flex h-8 w-8 cursor-pointer list-none items-center justify-center rounded-full border border-border bg-white/90 text-slate-500 shadow-sm outline-none transition hover:border-clinic-blue/40 hover:bg-clinic-mist hover:text-clinic-navy focus-visible:ring-4 focus-visible:ring-blue-100 [&::-webkit-details-marker]:hidden"
      >
        <Info className="h-4 w-4" />
      </summary>
      <div className="absolute right-0 top-10 z-50 w-72 rounded-2xl border border-white/80 bg-white/95 p-4 text-left shadow-[0_18px_50px_rgba(15,35,58,0.16)] ring-1 ring-slate-900/5 backdrop-blur-xl">
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">What this means</p>
        <p className="mt-2 text-sm font-semibold leading-5 text-clinic-ink">{label}</p>
        <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
      </div>
    </details>
  );
}
