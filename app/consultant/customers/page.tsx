import { ModulePage } from "@/components/dashboard/module-page";
import { SidebarShell } from "@/components/layout/sidebar-shell";
import { consultantNav } from "@/lib/constants/navigation";

export default function ConsultantCustomersPage() {
  return <SidebarShell nav={consultantNav} eyebrow="Consultant" title="Customers"><ModulePage title="My customers" description="Consultants can only access assigned customers, purchase history, subscriptions, tags, notes, and activity." items={["Assigned customers", "Order history", "Subscriptions", "Notes", "Tags", "Lifetime revenue"]} /></SidebarShell>;
}
