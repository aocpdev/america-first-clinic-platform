import { ModulePage } from "@/components/dashboard/module-page";
import { SidebarShell } from "@/components/layout/sidebar-shell";
import { consultantNav } from "@/lib/constants/navigation";

export default function ConsultantProfilePage() {
  return <SidebarShell nav={consultantNav} eyebrow="Consultant" title="Profile"><ModulePage title="Consultant profile" description="Manage personal details, contact data, onboarding status, agreements, referral slug, and payout placeholders." items={["Personal details", "Contact information", "Referral slug", "Agreements", "Payment setup placeholder", "Notification settings"]} /></SidebarShell>;
}
