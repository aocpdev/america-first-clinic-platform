import { SidebarShell } from "@/components/layout/sidebar-shell";
import { ProfileSettings } from "@/components/profile/profile-settings";
import { managerNav } from "@/lib/constants/navigation";
import { requireUser } from "@/lib/auth/current-user";
import { TaxPayoutSetup } from "@/components/profile/tax-payout-setup";
import { getPayoutSetup } from "@/lib/payments/payout-accounts";

export default async function ManagerProfilePage({
  searchParams
}: {
  searchParams: Promise<{ error?: string; updated?: string }>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const payoutSetup = await getPayoutSetup(user, params.updated === "payout_setup");

  return (
    <SidebarShell nav={managerNav} eyebrow="Manager" title="Profile">
      <ProfileSettings
        user={user}
        title="Manager profile"
        description="Manage the manager profile shown across team dashboards, reports, and internal activity."
        error={params.error}
        updated={params.updated}
      >
        <TaxPayoutSetup setup={payoutSetup} />
      </ProfileSettings>
    </SidebarShell>
  );
}
