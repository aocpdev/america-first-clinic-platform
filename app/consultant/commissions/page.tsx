import { ModulePage } from "@/components/dashboard/module-page";
import { SidebarShell } from "@/components/layout/sidebar-shell";
import { consultantNav } from "@/lib/constants/navigation";

export default function ConsultantCommissionsPage() {
  return <SidebarShell nav={consultantNav} eyebrow="Consultant" title="Commissions"><ModulePage title="Commission tracker" description="Track pending, approved, rejected, and paid commissions with transparent order-level attribution." items={["Pending", "Approved", "Rejected", "Paid", "Payout date", "Order source"]} /></SidebarShell>;
}
