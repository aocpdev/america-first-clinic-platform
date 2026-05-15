import { ModulePage } from "@/components/dashboard/module-page";
import { SidebarShell } from "@/components/layout/sidebar-shell";
import { adminNav } from "@/lib/constants/navigation";

export default function AdminProductsPage() {
  return <SidebarShell nav={adminNav} eyebrow="Admin" title="Products"><ModulePage title="Product management" description="Maintain healthcare and wellness catalog data with SKU, cost, margin, inventory, subscriptions, metadata, and commission rules." items={["SKU and inventory", "Recurring billing support", "Internal cost and margin", "Product images", "Category rules", "Active status"]} /></SidebarShell>;
}
