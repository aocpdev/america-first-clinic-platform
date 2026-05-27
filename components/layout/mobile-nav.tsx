"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Boxes,
  BriefcaseBusiness,
  CircleDollarSign,
  Columns3,
  ClipboardList,
  CreditCard,
  Gauge,
  Gift,
  HandCoins,
  LineChart,
  Settings,
  ShoppingBag,
  Users
} from "lucide-react";
import { cn } from "@/lib/utils";

type MobileNavItem = {
  href: string;
  label: string;
};

const iconByLabel = {
  Dashboard: Gauge,
  Sales: ShoppingBag,
  Pipeline: Columns3,
  Orders: ClipboardList,
  Products: Boxes,
  Customers: Users,
  Consultants: BriefcaseBusiness,
  Commissions: HandCoins,
  Payouts: CircleDollarSign,
  Rewards: Gift,
  Reports: BarChart3,
  Settings,
  Performance: LineChart,
  Referrals: CreditCard,
  Profile: Settings,
  Team: Users
} as const;

function isActivePath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function MobileNav({ nav }: { nav: MobileNavItem[] }) {
  const pathname = usePathname() ?? "";

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-white/80 bg-white/95 px-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] pt-2 shadow-[0_-18px_60px_rgba(7,55,99,0.14)] backdrop-blur-2xl lg:hidden">
      <div className="flex min-w-0 gap-2 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {nav.map((item) => {
          const Icon = iconByLabel[item.label as keyof typeof iconByLabel] ?? Gauge;
          const active = isActivePath(pathname, item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative flex min-w-[76px] shrink-0 flex-col items-center justify-center gap-1 rounded-2xl px-3 py-2 text-[11px] font-bold text-slate-500 transition",
                active
                  ? "bg-clinic-navy text-white shadow-[0_10px_24px_rgba(7,55,99,0.22)]"
                  : "hover:bg-clinic-mist hover:text-clinic-navy"
              )}
            >
              {active ? <span className="absolute -top-1 h-1 w-8 rounded-full bg-clinic-red" /> : null}
              <Icon className="h-4 w-4" />
              <span className="max-w-[64px] truncate">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
