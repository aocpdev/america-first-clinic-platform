import { ModulePage } from "@/components/dashboard/module-page";
import { SidebarShell } from "@/components/layout/sidebar-shell";
import { consultantNav } from "@/lib/constants/navigation";

export default function ConsultantPerformancePage() {
  return <SidebarShell nav={consultantNav} eyebrow="Consultant" title="Performance"><ModulePage title="Performance analytics" description="Monitor monthly goals, conversion metrics, rankings, referral performance, and activity trends." items={["Monthly goals", "Conversion rate", "Leaderboard rank", "Referral performance", "Badges", "Achievements"]} /></SidebarShell>;
}
