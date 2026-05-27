import { CommissionLedger } from "@/components/commissions/commission-ledger";
import type { RecordFiltersState } from "@/components/filters/record-filters";
import { SidebarShell } from "@/components/layout/sidebar-shell";
import { requireRole } from "@/lib/auth/current-user";
import { getAdminCommissionLedger } from "@/lib/commissions/queries";
import { adminNav } from "@/lib/constants/navigation";

export default async function AdminCommissionsPage({ searchParams }: { searchParams: Promise<RecordFiltersState> }) {
  const filters = await searchParams;
  const user = await requireRole("COMPANY_ADMIN");
  const entries = await getAdminCommissionLedger(user.companyId);

  return (
    <SidebarShell nav={adminNav} eyebrow="Admin" title="Commissions">
      <CommissionLedger
        entries={entries}
        scope="admin"
        title="Company commission control"
        description="Review every commission split across partners, managers, leaders, and sellers with full margin visibility."
        filters={filters}
      />
    </SidebarShell>
  );
}
