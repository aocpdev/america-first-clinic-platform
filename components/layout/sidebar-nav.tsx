"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export type SidebarNavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
};

function isActivePath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SidebarNav({ nav }: { nav: SidebarNavItem[] }) {
  const pathname = usePathname() ?? "";

  return (
    <nav className="space-y-1 px-4 py-5">
      {nav.map((item) => {
        const Icon = item.icon;
        const active = isActivePath(pathname, item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition",
              active
                ? "bg-clinic-navy text-white shadow-[0_14px_30px_rgba(7,55,99,0.18)] hover:bg-clinic-navy hover:text-white"
                : "text-slate-600 hover:bg-clinic-mist hover:text-clinic-navy"
            )}
          >
            <span
              className={cn(
                "grid h-7 w-7 place-items-center rounded-lg transition",
                active ? "bg-white/12 text-white" : "text-slate-500 group-hover:bg-white group-hover:text-clinic-navy"
              )}
            >
              <Icon className="h-4 w-4" />
            </span>
            <span className="truncate">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
