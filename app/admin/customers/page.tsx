import { ModulePage } from "@/components/dashboard/module-page";
import { SidebarShell } from "@/components/layout/sidebar-shell";
import { adminNav } from "@/lib/constants/navigation";

export default function AdminCustomersPage() {
  return <SidebarShell nav={adminNav} eyebrow="Admin" title="Customers"><ModulePage title="Customer CRM" description="View profiles, order history, subscriptions, consultant assignment, notes, tags, activity, lifetime revenue, and last purchase." items={["Customer profiles", "Assigned consultant", "Notes and tags", "Activity history", "Subscriptions", "Revenue generated"]} /></SidebarShell>;
}
