import { ModulePage } from "@/components/dashboard/module-page";
import { SidebarShell } from "@/components/layout/sidebar-shell";
import { consultantNav } from "@/lib/constants/navigation";

export default function ConsultantReferralsPage() {
  return <SidebarShell nav={consultantNav} eyebrow="Agent" title="Referrals"><ModulePage title="Referral tools" description="Generate referral links, track cookies, session metadata, checkout attribution, and recurring customer attribution." items={["/c/john-smith", "Referral code", "Cookie capture", "Session metadata", "Checkout attribution", "Recurring attribution"]} /></SidebarShell>;
}
