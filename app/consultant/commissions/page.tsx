import { CommissionLedger } from "@/components/commissions/commission-ledger";
import { SidebarShell } from "@/components/layout/sidebar-shell";
import { requireApprovedConsultant } from "@/lib/auth/current-user";
import { getConsultantCommissionLedger } from "@/lib/commissions/queries";
import { consultantNav } from "@/lib/constants/navigation";

export default async function ConsultantCommissionsPage() {
  const user = await requireApprovedConsultant();
  const entries = await getConsultantCommissionLedger(user);

  return (
    <SidebarShell nav={consultantNav} eyebrow="Consultant" title="Commissions">
      <CommissionLedger
        entries={entries}
        scope="consultant"
        title="Your commission tracker"
        description="Follow every seller commission from pending review to approved payout without exposing internal network splits."
      />
    </SidebarShell>
  );
}
