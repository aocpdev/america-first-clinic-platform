import { ModulePage } from "@/components/dashboard/module-page";
import { SidebarShell } from "@/components/layout/sidebar-shell";
import { adminNav } from "@/lib/constants/navigation";

export default function AdminReportsPage() {
  return <SidebarShell nav={adminNav} eyebrow="Admin" title="Reports"><ModulePage title="Reporting center" description="Analyze data by consultant, date, product, category, revenue, commissions, provider, subscriptions, and conversion rates." items={["Consultant reports", "Revenue reports", "Provider reports", "Subscription reports", "Conversion rates", "CSV exports"]} /></SidebarShell>;
}
