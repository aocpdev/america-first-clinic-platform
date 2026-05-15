import { ModulePage } from "@/components/dashboard/module-page";
import { SidebarShell } from "@/components/layout/sidebar-shell";
import { adminNav } from "@/lib/constants/navigation";

export default function AdminCommissionsPage() {
  return <SidebarShell nav={adminNav} eyebrow="Admin" title="Commissions"><ModulePage title="Commission engine" description="Configure percentage, fixed, product-specific, category, bonus, and volume-tier commission logic." items={["Pending commissions", "Approved commissions", "Rejected commissions", "Paid commissions", "Volume tiers", "Product rules"]} /></SidebarShell>;
}
