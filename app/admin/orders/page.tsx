import { ModulePage } from "@/components/dashboard/module-page";
import { SidebarShell } from "@/components/layout/sidebar-shell";
import { adminNav } from "@/lib/constants/navigation";

export default function AdminOrdersPage() {
  return <SidebarShell nav={adminNav} eyebrow="Admin" title="Orders"><ModulePage title="Order management" description="Manage customer orders, consultant attribution, statuses, provider-independent payments, and fulfillment workflows." items={["Payment status", "Commission status", "Subscription status", "Referral source", "Exportable order reports", "Inventory-linked items"]} /></SidebarShell>;
}
