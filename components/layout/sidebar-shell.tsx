import { stopImpersonation } from "@/app/(auth)/actions";
import { ClinicLogo } from "@/components/layout/logo";
import { MobileNav } from "@/components/layout/mobile-nav";
import { NotificationMenu } from "@/components/layout/notification-menu";
import { SidebarNav, type SidebarNavItem } from "@/components/layout/sidebar-nav";
import { UserMenu } from "@/components/layout/user-menu";
import { Button } from "@/components/ui/button";
import { getImpersonationContext } from "@/lib/auth/current-user";
import { profilePathForRole } from "@/lib/auth/profile-path";
import { prisma } from "@/lib/db/prisma";

type ImpersonationTargetRecord = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: string;
  partnerProfile: { companyName: string | null; displayName: string } | null;
  managerProfile: { displayName: string } | null;
  groupLeaderProfile: { displayName: string } | null;
};

export async function SidebarShell({
  nav,
  title,
  children
}: {
  nav: SidebarNavItem[];
  title: string;
  eyebrow: string;
  children: React.ReactNode;
}) {
  const { realUser, activeUser: user, isImpersonating } = await getImpersonationContext();
  const activeName = user ? [user.firstName, user.lastName].filter(Boolean).join(" ").trim() || user.email : "";
  const realName = realUser ? [realUser.firstName, realUser.lastName].filter(Boolean).join(" ").trim() || realUser.email : "";
  const impersonationTargets = realUser
    ? await prismaUserImpersonationTargets(realUser)
    : [];
  const [notifications, unreadCount] = user
    ? await Promise.all([
        prisma.notification.findMany({
          where: { userId: user.id },
          orderBy: { createdAt: "desc" },
          take: 10,
          select: { id: true, title: true, body: true, readAt: true, createdAt: true }
        }),
        prisma.notification.count({ where: { userId: user.id, readAt: null } })
      ])
    : [[], 0];

  return (
    <div className="min-h-screen overflow-x-clip bg-clinic-mist">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-72 border-r border-border bg-white lg:block">
        <div className="flex h-20 items-center border-b border-border px-6">
          <ClinicLogo />
        </div>
        <SidebarNav nav={nav} />
      </aside>
      <main className="min-w-0 lg:pl-72">
        {isImpersonating && user && realUser ? (
          <div className="sticky top-0 z-40 border-b border-amber-200 bg-amber-50 px-4 py-2 sm:px-6 lg:px-8">
            <div className="flex flex-col gap-2 text-sm font-semibold text-amber-900 sm:flex-row sm:items-center sm:justify-between">
              <p>
                Viewing as {activeName} ({user.role}). Real account: {realName}.
              </p>
              <form action={stopImpersonation}>
                <Button type="submit" size="sm" variant="outline" className="border-amber-300 bg-white text-amber-900 hover:bg-amber-100">
                  Switch to my account
                </Button>
              </form>
            </div>
          </div>
        ) : null}
        <header className="sticky top-0 z-30 border-b border-border bg-white/88 backdrop-blur-xl">
          <div className="flex min-h-16 min-w-0 items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:min-h-20 lg:px-8">
            <div className="flex min-w-0 items-center gap-3">
              <h1 className="truncate text-xl font-semibold text-clinic-ink sm:text-2xl">{title}</h1>
            </div>
            <div className="flex shrink-0 items-center gap-2 sm:gap-3">
              <NotificationMenu
                unreadCount={unreadCount}
                notifications={notifications.map((notification) => ({
                  id: notification.id,
                  title: notification.title,
                  body: notification.body,
                  readAt: notification.readAt?.toISOString() ?? null,
                  createdAt: notification.createdAt.toISOString()
                }))}
              />
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
                  impersonationTargets={impersonationTargets}
                />
              ) : null}
            </div>
          </div>
        </header>
        <div className="min-w-0 overflow-x-clip px-3 py-4 pb-28 sm:px-6 sm:py-6 lg:px-8 lg:pb-8">{children}</div>
      </main>
      <MobileNav nav={nav.map(({ href, label }) => ({ href, label }))} />
    </div>
  );
}

async function prismaUserImpersonationTargets(realUser: NonNullable<Awaited<ReturnType<typeof getImpersonationContext>>>["realUser"]) {
  if (!realUser) return [];

  const baseSelect = {
    id: true,
    email: true,
    firstName: true,
    lastName: true,
    role: true,
    partnerProfile: { select: { companyName: true, displayName: true } },
    managerProfile: { select: { displayName: true } },
    groupLeaderProfile: { select: { displayName: true } }
  } as const;

  let users: ImpersonationTargetRecord[] = [];

  if (realUser.role === "COMPANY_ADMIN" || realUser.role === "SUPER_ADMIN") {
    users = await prisma.user.findMany({
      where: {
        id: { not: realUser.id },
        companyId: realUser.companyId,
        role: { in: ["PARTNER", "MANAGER", "GROUP_LEADER", "CONSULTANT"] },
        status: "ACTIVE",
        isActive: true
      },
      select: baseSelect,
      orderBy: [{ role: "asc" }, { firstName: "asc" }, { email: "asc" }]
    });
  } else if (realUser.role === "PARTNER" && realUser.partnerProfile) {
    users = await prisma.user.findMany({
      where: {
        id: { not: realUser.id },
        companyId: realUser.companyId,
        role: { in: ["MANAGER", "GROUP_LEADER", "CONSULTANT"] },
        status: "ACTIVE",
        isActive: true,
        OR: [
          { managerProfile: { partnerProfileId: realUser.partnerProfile.id } },
          { groupLeaderProfile: { partnerProfileId: realUser.partnerProfile.id } },
          { consultantProfile: { partnerProfileId: realUser.partnerProfile.id } }
        ]
      },
      select: baseSelect,
      orderBy: [{ role: "asc" }, { firstName: "asc" }, { email: "asc" }]
    });
  } else if (realUser.role === "MANAGER" && realUser.managerProfile) {
    users = await prisma.user.findMany({
      where: {
        id: { not: realUser.id },
        companyId: realUser.companyId,
        role: { in: ["GROUP_LEADER", "CONSULTANT"] },
        status: "ACTIVE",
        isActive: true,
        OR: [
          { groupLeaderProfile: { managerProfileId: realUser.managerProfile.id } },
          { consultantProfile: { managerProfileId: realUser.managerProfile.id } },
          { consultantProfile: { groupLeaderProfile: { managerProfileId: realUser.managerProfile.id } } }
        ]
      },
      select: baseSelect,
      orderBy: [{ role: "asc" }, { firstName: "asc" }, { email: "asc" }]
    });
  } else if (realUser.role === "GROUP_LEADER" && realUser.groupLeaderProfile) {
    users = await prisma.user.findMany({
      where: {
        id: { not: realUser.id },
        companyId: realUser.companyId,
        role: "CONSULTANT",
        status: "ACTIVE",
        isActive: true,
        consultantProfile: { groupLeaderProfileId: realUser.groupLeaderProfile.id }
      },
      select: baseSelect,
      orderBy: [{ firstName: "asc" }, { email: "asc" }]
    });
  }

  return users.map((target) => {
    const personName = [target.firstName, target.lastName].filter(Boolean).join(" ").trim();
    const label = target.partnerProfile?.companyName || target.partnerProfile?.displayName || target.managerProfile?.displayName || target.groupLeaderProfile?.displayName || personName || target.email;

    return {
      id: target.id,
      label,
      role: target.role,
      email: target.email
    };
  });
}
