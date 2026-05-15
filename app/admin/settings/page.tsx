import { ModulePage } from "@/components/dashboard/module-page";
import { SidebarShell } from "@/components/layout/sidebar-shell";
import { adminNav } from "@/lib/constants/navigation";

export default function AdminSettingsPage() {
  return <SidebarShell nav={adminNav} eyebrow="Admin" title="Settings"><ModulePage title="System settings" description="Configure roles, permissions, payment providers, PostHog, Resend, storage, webhooks, and security controls." items={["Role access", "Payment providers", "Webhook secrets", "Email settings", "Analytics", "Audit retention"]} /></SidebarShell>;
}
