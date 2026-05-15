import { ModulePage } from "@/components/dashboard/module-page";
import { SidebarShell } from "@/components/layout/sidebar-shell";
import { adminNav } from "@/lib/constants/navigation";

export default function AdminPayoutsPage() {
  return <SidebarShell nav={adminNav} eyebrow="Admin" title="Payouts"><ModulePage title="Payout approvals" description="Review payout batches, provider references, ACH readiness, tax placeholders, and commission approvals." items={["Payout batches", "Approval queue", "ACH destination", "Tax setup placeholder", "Audit events", "Export files"]} /></SidebarShell>;
}
