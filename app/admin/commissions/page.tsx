import { CommissionLedger } from "@/components/commissions/commission-ledger";
import { DashboardDateRangeFilter } from "@/components/dashboard/date-range-filter";
import type { RecordFiltersState } from "@/components/filters/record-filters";
import { SidebarShell } from "@/components/layout/sidebar-shell";
import { requireRole } from "@/lib/auth/current-user";
import { getAdminCommissionLedger } from "@/lib/commissions/queries";
import { adminNav } from "@/lib/constants/navigation";
import { parseDashboardDateRange } from "@/lib/dashboard/date-range";

export default async function AdminCommissionsPage({ searchParams }: { searchParams: Promise<RecordFiltersState> }) {
  const filters = await searchParams;
  const dateRange = parseDashboardDateRange(filters);
  const user = await requireRole("COMPANY_ADMIN");
  const entries = await getAdminCommissionLedger(user.companyId, dateRange);

  return (
    <SidebarShell nav={adminNav} eyebrow="Admin" title="Commissions">
      <DashboardDateRangeFilter range={dateRange} resetHref="/admin/commissions" hiddenParams={{ q: filters.q ?? "", status: filters.status ?? "ALL", role: filters.role ?? "ALL" }} />
      <CommissionLedger
        entries={entries}
        scope="admin"
        title="Company commission control"
        description="Review every commission split across partners, managers, leaders, and agents with full margin visibility."
        filters={filters}
        dateRangeLabel={dateRange.label}
      />
    </SidebarShell>
  );
}
