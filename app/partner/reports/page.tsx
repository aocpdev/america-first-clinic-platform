import { ModulePage } from "@/components/dashboard/module-page";
import { SidebarShell } from "@/components/layout/sidebar-shell";
import { partnerNav } from "@/lib/constants/navigation";

export default function PartnerReportsPage() {
  return <SidebarShell nav={partnerNav} eyebrow="Partner" title="Reports"><ModulePage title="Partner reports" description="Review sales, gross margin, commission pool, partner commission, and consultant payout totals across assigned sellers." items={["Gross margin", "Partner commission", "Consultant payouts", "Assigned consultants", "Sales by product", "Payout status"]} /></SidebarShell>;
}
