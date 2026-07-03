import { ModulePage } from "@/components/dashboard/module-page";
import { SidebarShell } from "@/components/layout/sidebar-shell";
import { adminNav } from "@/lib/constants/navigation";

export default function ManagerTeamPage() {
  return <SidebarShell nav={adminNav.slice(0, 4)} eyebrow="Manager" title="Team"><ModulePage title="Assigned team" description="Managers can only view and manage assigned agent team data, leads, KPIs, and performance." items={["Assigned agents", "Lead assignment", "Team KPIs", "Sales activity", "Coaching notes", "Goal tracking"]} /></SidebarShell>;
}
