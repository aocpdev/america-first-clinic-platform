import { ModulePage } from "@/components/dashboard/module-page";
import { SidebarShell } from "@/components/layout/sidebar-shell";
import { requirePartner } from "@/lib/auth/current-user";
import { groupLeaderNav, partnerNav } from "@/lib/constants/navigation";

export default async function PartnerSettingsPage() {
  const user = await requirePartner();
  const isGroupLeader = user.role === "GROUP_LEADER";
  return <SidebarShell nav={isGroupLeader ? groupLeaderNav : partnerNav} eyebrow={isGroupLeader ? "Group leader" : "Partner"} title="Settings"><ModulePage title={isGroupLeader ? "Leader settings" : "Partner settings"} description={isGroupLeader ? "Manage your leader workspace preferences, notifications, and security settings." : "Manage partner profile details, payout preferences, assigned team visibility, and notification settings."} items={isGroupLeader ? ["Profile", "Notifications", "Reports", "Security"] : ["Profile", "Payout preferences", "Notifications", "Team access", "Reports", "Security"]} /></SidebarShell>;
}
