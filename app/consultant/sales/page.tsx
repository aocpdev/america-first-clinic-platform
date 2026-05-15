import { ModulePage } from "@/components/dashboard/module-page";
import { SidebarShell } from "@/components/layout/sidebar-shell";
import { consultantNav } from "@/lib/constants/navigation";

export default function ConsultantSalesPage() {
  return <SidebarShell nav={consultantNav} eyebrow="Consultant" title="Sales"><ModulePage title="Sales workspace" description="Create manual sales, monitor checkout attribution, and review order progress without touching provider-specific payment code." items={["Manual sale", "Recent orders", "Payment status", "Referral source", "Customer attribution", "Renewal attribution"]} /></SidebarShell>;
}
