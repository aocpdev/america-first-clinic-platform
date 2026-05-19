import Link from "next/link";
import { Bell, Search } from "lucide-react";
import { stopImpersonation } from "@/app/(auth)/actions";
import { ClinicLogo } from "@/components/layout/logo";
import { UserMenu } from "@/components/layout/user-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getImpersonationContext } from "@/lib/auth/current-user";
import { profilePathForRole } from "@/lib/auth/profile-path";
import { cn } from "@/lib/utils";

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
};

export async function SidebarShell({
  nav,
  title,
  children
}: {
  nav: NavItem[];
  title: string;
  eyebrow: string;
  children: React.ReactNode;
}) {
  const { realUser, activeUser: user, isImpersonating } = await getImpersonationContext();
  const activeName = user ? [user.firstName, user.lastName].filter(Boolean).join(" ").trim() || user.email : "";
  const realName = realUser ? [realUser.firstName, realUser.lastName].filter(Boolean).join(" ").trim() || realUser.email : "";

  return (
    <div className="min-h-screen bg-clinic-mist">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-72 border-r border-border bg-white lg:block">
        <div className="flex h-20 items-center border-b border-border px-6">
          <ClinicLogo />
        </div>
        <nav className="space-y-1 px-4 py-5">
          {nav.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-clinic-mist hover:text-clinic-navy",
                  item.href.endsWith("dashboard") && "bg-clinic-navy text-white hover:bg-clinic-navy hover:text-white"
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>
      <main className="lg:pl-72">
        {isImpersonating && user && realUser ? (
          <div className="sticky top-0 z-40 border-b border-amber-200 bg-amber-50 px-4 py-2 sm:px-6 lg:px-8">
            <div className="flex flex-col gap-2 text-sm font-semibold text-amber-900 sm:flex-row sm:items-center sm:justify-between">
              <p>
                Viewing as {activeName} ({user.role}). Real account: {realName}.
              </p>
              <form action={stopImpersonation}>
                <Button type="submit" size="sm" variant="outline" className="border-amber-300 bg-white text-amber-900 hover:bg-amber-100">
                  Exit view
                </Button>
              </form>
            </div>
          </div>
        ) : null}
        <header className="sticky top-0 z-30 border-b border-border bg-white/88 backdrop-blur-xl">
          <div className="flex min-h-20 flex-col gap-3 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
            <div>
              <h1 className="text-2xl font-semibold text-clinic-ink">{title}</h1>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative hidden min-w-72 md:block">
                <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <Input className="pl-9" placeholder="Search customers, orders, products..." />
              </div>
              <Button size="icon" variant="outline" aria-label="Notifications">
                <Bell className="h-4 w-4" />
              </Button>
              {user ? (
                <UserMenu
                  user={{
                    email: user.email,
                    firstName: user.firstName,
                    lastName: user.lastName,
                    avatarUrl: user.avatarUrl,
                    role: user.role
                  }}
                  profileHref={profilePathForRole(user.role)}
                />
              ) : null}
            </div>
          </div>
        </header>
        <div className="px-4 py-6 sm:px-6 lg:px-8">{children}</div>
      </main>
    </div>
  );
}
