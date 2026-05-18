import { ModulePage } from "@/components/dashboard/module-page";
import { SidebarShell } from "@/components/layout/sidebar-shell";
import { partnerNav } from "@/lib/constants/navigation";

export default function PartnerSettingsPage() {
  return <SidebarShell nav={partnerNav} eyebrow="Partner" title="Settings"><ModulePage title="Partner settings" description="Manage partner profile details, payout preferences, assigned team visibility, and notification settings." items={["Profile", "Payout preferences", "Notifications", "Team access", "Reports", "Security"]} /></SidebarShell>;
}
