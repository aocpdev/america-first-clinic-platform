import { CommissionLedger } from "@/components/commissions/commission-ledger";
import { DashboardDateRangeFilter } from "@/components/dashboard/date-range-filter";
import type { RecordFiltersState } from "@/components/filters/record-filters";
import { SidebarShell } from "@/components/layout/sidebar-shell";
import { requireApprovedConsultant } from "@/lib/auth/current-user";
import { getConsultantCommissionLedger } from "@/lib/commissions/queries";
import { consultantNav } from "@/lib/constants/navigation";
import { parseDashboardDateRange } from "@/lib/dashboard/date-range";

export default async function ConsultantCommissionsPage({ searchParams }: { searchParams: Promise<RecordFiltersState> }) {
  const filters = await searchParams;
  const dateRange = parseDashboardDateRange(filters);
  const user = await requireApprovedConsultant();
  const entries = await getConsultantCommissionLedger(user, dateRange);

  return (
    <SidebarShell nav={consultantNav} eyebrow="Consultant" title="Commissions">
      <DashboardDateRangeFilter range={dateRange} resetHref="/consultant/commissions" hiddenParams={{ q: filters.q ?? "", status: filters.status ?? "ALL", role: filters.role ?? "ALL" }} />
      <CommissionLedger
        entries={entries}
        scope="consultant"
        title="Your commission tracker"
        description="Follow every seller commission from pending review to approved payout without exposing internal network splits."
        filters={filters}
        dateRangeLabel={dateRange.label}
      />
    </SidebarShell>
  );
}
