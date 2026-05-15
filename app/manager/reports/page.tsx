import { ModulePage } from "@/components/dashboard/module-page";
import { SidebarShell } from "@/components/layout/sidebar-shell";
import { adminNav } from "@/lib/constants/navigation";

export default function ManagerReportsPage() {
  return <SidebarShell nav={adminNav.slice(0, 4)} eyebrow="Manager" title="Reports"><ModulePage title="Team reports" description="Review team revenue, product performance, conversion rates, and consultant activity inside assigned scope." items={["Team revenue", "Product mix", "Conversion rates", "Lead outcomes", "Goal progress", "Commission visibility"]} /></SidebarShell>;
}
