import { SidebarShell } from "@/components/layout/sidebar-shell";
import { ProfileSettings } from "@/components/profile/profile-settings";
import { partnerNav } from "@/lib/constants/navigation";
import { requireUser } from "@/lib/auth/current-user";

export default async function PartnerProfilePage({
  searchParams
}: {
  searchParams: Promise<{ error?: string; updated?: string }>;
}) {
  const user = await requireUser();
  const params = await searchParams;

  return (
    <SidebarShell nav={partnerNav} eyebrow="Partner" title="Profile">
      <ProfileSettings
        user={user}
        title="Partner profile"
        description="Manage the partner identity used for assigned seller visibility, commission reporting, and internal activity."
        error={params.error}
        updated={params.updated}
      />
    </SidebarShell>
  );
}
