import { PayoutCenter } from "@/components/payouts/payout-center";
import { SidebarShell } from "@/components/layout/sidebar-shell";
import { requireRole } from "@/lib/auth/current-user";
import { getAdminCommissionLedger } from "@/lib/commissions/queries";
import { adminNav } from "@/lib/constants/navigation";

export default async function AdminPayoutsPage() {
  const user = await requireRole("COMPANY_ADMIN");
  const entries = await getAdminCommissionLedger(user.companyId);

  return (
    <SidebarShell nav={adminNav} eyebrow="Admin" title="Payouts">
      <PayoutCenter entries={entries} scope="admin" />
    </SidebarShell>
  );
}
