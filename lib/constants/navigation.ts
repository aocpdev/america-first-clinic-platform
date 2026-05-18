import {
  BarChart3,
  Boxes,
  BriefcaseBusiness,
  CircleDollarSign,
  Columns3,
  ClipboardList,
  CreditCard,
  Gauge,
  HandCoins,
  LineChart,
  Settings,
  ShoppingBag,
  Users
} from "lucide-react";

export const adminNav = [
  { href: "/admin/dashboard", label: "Dashboard", icon: Gauge },
  { href: "/admin/orders", label: "Orders", icon: ClipboardList },
  { href: "/admin/products", label: "Products", icon: Boxes },
  { href: "/admin/customers", label: "Customers", icon: Users },
  { href: "/admin/consultants", label: "Consultants", icon: BriefcaseBusiness },
  { href: "/admin/commissions", label: "Commissions", icon: HandCoins },
  { href: "/admin/payouts", label: "Payouts", icon: CircleDollarSign },
  { href: "/admin/reports", label: "Reports", icon: BarChart3 },
  { href: "/admin/settings", label: "Settings", icon: Settings }
];

export const consultantNav = [
  { href: "/consultant/dashboard", label: "Dashboard", icon: Gauge },
  { href: "/consultant/customers", label: "Customers", icon: Users },
  { href: "/consultant/pipeline", label: "Pipeline", icon: Columns3 },
  { href: "/consultant/sales", label: "Sales", icon: ShoppingBag },
  { href: "/consultant/commissions", label: "Commissions", icon: HandCoins },
  { href: "/consultant/products", label: "Products", icon: Boxes },
  { href: "/consultant/performance", label: "Performance", icon: LineChart },
  { href: "/consultant/referrals", label: "Referrals", icon: CreditCard },
  { href: "/consultant/profile", label: "Profile", icon: Settings }
];

export const partnerNav = [
  { href: "/partner/dashboard", label: "Dashboard", icon: Gauge },
  { href: "/partner/sales", label: "Sales", icon: ClipboardList },
  { href: "/partner/pipeline", label: "Pipeline", icon: Columns3 },
  { href: "/partner/consultants", label: "Consultants", icon: Users },
  { href: "/partner/products", label: "Products", icon: Boxes },
  { href: "/partner/commissions", label: "Commissions", icon: HandCoins },
  { href: "/partner/payouts", label: "Payouts", icon: CircleDollarSign },
  { href: "/partner/reports", label: "Reports", icon: BarChart3 },
  { href: "/partner/settings", label: "Settings", icon: Settings }
];
