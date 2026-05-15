import { ModulePage } from "@/components/dashboard/module-page";
import { SidebarShell } from "@/components/layout/sidebar-shell";
import { adminNav } from "@/lib/constants/navigation";

export default function AdminConsultantsPage() {
  return <SidebarShell nav={adminNav} eyebrow="Admin" title="Consultants"><ModulePage title="Consultant management" description="Invite, onboard, manage teams, review performance, assign leads, and monitor KPI health across the sales organization." items={["Onboarding progress", "Referral slug", "Team assignment", "Leaderboard rank", "Goal progress", "Payout readiness"]} /></SidebarShell>;
}
