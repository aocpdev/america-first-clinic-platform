import { SidebarShell } from "@/components/layout/sidebar-shell";
import { ProfileSettings } from "@/components/profile/profile-settings";
import { consultantNav } from "@/lib/constants/navigation";
import { requireUser } from "@/lib/auth/current-user";

export default async function ConsultantProfilePage({
  searchParams
}: {
  searchParams: Promise<{ error?: string; updated?: string }>;
}) {
  const user = await requireUser();
  const params = await searchParams;

  return (
    <SidebarShell nav={consultantNav} eyebrow="Agent" title="Profile">
      <ProfileSettings
        user={user}
        title="Agent profile"
        description="Manage your agent profile, contact details, and profile photo used inside the CRM."
        error={params.error}
        updated={params.updated}
      />
    </SidebarShell>
  );
}
