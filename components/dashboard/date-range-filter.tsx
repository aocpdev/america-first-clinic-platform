import type { DashboardDateRange } from "@/lib/dashboard/date-range";
import { DashboardDateRangeMenu } from "@/components/dashboard/date-range-menu";

type DashboardDateRangeFilterProps = {
  range: DashboardDateRange;
  resetHref: string;
  hiddenParams?: Record<string, string | undefined>;
};

export function DashboardDateRangeFilter({ range, resetHref, hiddenParams = {} }: DashboardDateRangeFilterProps) {
  return (
    <div className="mb-6 flex justify-end">
      <div className="rounded-[2rem] bg-white/80 p-3 shadow-[0_18px_60px_rgba(7,55,99,0.07)] ring-1 ring-white/80 backdrop-blur">
        <DashboardDateRangeMenu range={range} resetHref={resetHref} hiddenParams={hiddenParams} />
      </div>
    </div>
  );
}
