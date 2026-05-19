import { ModulePage } from "@/components/dashboard/module-page";
import { SidebarShell } from "@/components/layout/sidebar-shell";
import { requirePartner } from "@/lib/auth/current-user";
import { groupLeaderNav, partnerNav } from "@/lib/constants/navigation";

export default async function PartnerReportsPage() {
  const user = await requirePartner();
  const isGroupLeader = user.role === "GROUP_LEADER";
  return <SidebarShell nav={isGroupLeader ? groupLeaderNav : partnerNav} eyebrow={isGroupLeader ? "Group leader" : "Partner"} title="Reports"><ModulePage title={isGroupLeader ? "Leader reports" : "Partner reports"} description={isGroupLeader ? "Review sales, profit, and consultant activity for your assigned team." : "Review sales, gross margin, partner profit, and consultant payout totals across assigned sellers."} items={isGroupLeader ? ["Team revenue", "Leader profit", "Assigned consultants", "Sales by product", "Conversion activity", "Pipeline status"] : ["Gross margin", "Partner profit", "Consultant payouts", "Assigned consultants", "Sales by product", "Payout status"]} /></SidebarShell>;
}
