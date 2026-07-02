import { Info } from "lucide-react";

export function KpiInfo({ label, description }: { label: string; description: string }) {
  return (
    <span
      title={`${label}: ${description}`}
      aria-label={`${label}: ${description}`}
      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-white/85 text-slate-500 shadow-sm transition hover:border-clinic-blue hover:text-clinic-navy"
    >
      <Info className="h-4 w-4" />
    </span>
  );
}
