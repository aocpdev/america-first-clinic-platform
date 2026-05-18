import { SidebarShell } from "@/components/layout/sidebar-shell";
import { ProfileSettings } from "@/components/profile/profile-settings";
import { adminNav } from "@/lib/constants/navigation";
import { requireUser } from "@/lib/auth/current-user";

export default async function AdminProfilePage({
  searchParams
}: {
  searchParams: Promise<{ error?: string; updated?: string }>;
}) {
  const user = await requireUser();
  const params = await searchParams;

  return (
    <SidebarShell nav={adminNav} eyebrow="Admin" title="Profile">
      <ProfileSettings
        user={user}
        title="Admin profile"
        description="Manage the owner or administrator profile shown across the CRM workspace."
        error={params.error}
        updated={params.updated}
      />
    </SidebarShell>
  );
}
