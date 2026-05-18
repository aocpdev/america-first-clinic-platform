import { SidebarShell } from "@/components/layout/sidebar-shell";
import { ProfileSettings } from "@/components/profile/profile-settings";
import { adminNav } from "@/lib/constants/navigation";
import { requireUser } from "@/lib/auth/current-user";

export default async function ManagerProfilePage({
  searchParams
}: {
  searchParams: Promise<{ error?: string; updated?: string }>;
}) {
  const user = await requireUser();
  const params = await searchParams;

  return (
    <SidebarShell nav={adminNav.slice(0, 4)} eyebrow="Manager" title="Profile">
      <ProfileSettings
        user={user}
        title="Manager profile"
        description="Manage the manager profile shown across team dashboards, reports, and internal activity."
        error={params.error}
        updated={params.updated}
      />
    </SidebarShell>
  );
}
