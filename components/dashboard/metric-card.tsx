import { ArrowUpRight } from "lucide-react";
import { Card } from "@/components/ui/card";

export function MetricCard({
  label,
  value,
  change,
  tone = "blue"
}: {
  label: string;
  value: string;
  change: string;
  tone?: "blue" | "red" | "green";
}) {
  const tones = {
    blue: "bg-clinic-mist text-clinic-blue",
    red: "bg-clinic-blush text-clinic-red",
    green: "bg-emerald-50 text-emerald-700"
  };

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-500">{label}</p>
          <p className="mt-3 text-3xl font-semibold tracking-normal text-clinic-ink">{value}</p>
        </div>
        <span className={`rounded-lg p-2 ${tones[tone]}`}>
          <ArrowUpRight className="h-4 w-4" />
        </span>
      </div>
      <p className="mt-4 text-sm font-medium text-emerald-700">{change}</p>
    </Card>
  );
}
