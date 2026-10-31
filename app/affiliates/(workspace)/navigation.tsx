"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [{ href: "/affiliates", label: "Overview" }, { href: "/affiliates/products", label: "Products" }, { href: "/affiliates/activity", label: "Activity" }, { href: "/affiliates/payouts", label: "Payouts" }, { href: "/affiliates/account", label: "Account" }];

export function AffiliateNavigation() {
  const pathname = usePathname();
  return <nav aria-label="Affiliate navigation" className="sticky top-0 z-10 border-b bg-white/95 backdrop-blur">
    <div className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4 py-2">{items.map(item => {
      const active = pathname === item.href;
      return <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined}
        className={`flex min-h-11 shrink-0 items-center justify-center rounded-lg px-3 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${active ? "bg-blue-50 text-clinic-navy" : "text-slate-500 hover:bg-slate-50"}`}>{item.label}</Link>;
    })}</div>
  </nav>;
}
