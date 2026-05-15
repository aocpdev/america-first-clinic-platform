import { ModulePage } from "@/components/dashboard/module-page";
import { SidebarShell } from "@/components/layout/sidebar-shell";
import { consultantNav } from "@/lib/constants/navigation";

export default function ConsultantProductsPage() {
  return <SidebarShell nav={consultantNav} eyebrow="Consultant" title="Products"><ModulePage title="Product selling guide" description="Browse sellable products, commission value, inventory visibility, recurring availability, and referral-ready product links." items={["Referral product links", "Commission value", "Inventory status", "Subscription support", "Category filters", "Sales guidance"]} /></SidebarShell>;
}
