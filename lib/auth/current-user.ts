import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db/prisma";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Role } from "@/lib/auth/roles";
import { hasRoleAtLeast } from "@/lib/auth/roles";

const IMPERSONATION_COOKIE = "afc_impersonate_user_id";

const userInclude = {
  consultantProfile: true,
  partnerProfile: true,
  groupLeaderProfile: true,
  company: true
} as const;

export async function getAuthenticatedUser() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user?.id) {
    return null;
  }

  return prisma.user.findUnique({
    where: { authUserId: user.id },
    include: userInclude
  });
}

async function canImpersonate(realUser: NonNullable<Awaited<ReturnType<typeof getAuthenticatedUser>>>, targetUserId: string) {
  if (realUser.id === targetUserId) return false;

  if (realUser.role === "COMPANY_ADMIN" || realUser.role === "SUPER_ADMIN") {
    return Boolean(
      await prisma.user.findFirst({
        where: {
          id: targetUserId,
          companyId: realUser.companyId,
          role: { in: ["PARTNER", "GROUP_LEADER", "CONSULTANT"] },
          status: "ACTIVE",
          isActive: true
        },
        select: { id: true }
      })
    );
  }

  if (realUser.role === "PARTNER" && realUser.partnerProfile) {
    const partnerProfileId = realUser.partnerProfile.id;
    return Boolean(
      await prisma.user.findFirst({
        where: {
          id: targetUserId,
          companyId: realUser.companyId,
          role: { in: ["GROUP_LEADER", "CONSULTANT"] },
          status: "ACTIVE",
          isActive: true,
          OR: [
            { groupLeaderProfile: { partnerProfileId } },
            { consultantProfile: { partnerProfileId } }
          ]
        },
        select: { id: true }
      })
    );
  }

  return false;
}

export async function getImpersonationContext() {
  const realUser = await getAuthenticatedUser();
  if (!realUser) {
    return { realUser: null, activeUser: null, isImpersonating: false };
  }

  const cookieStore = await cookies();
  const impersonatedUserId = cookieStore.get(IMPERSONATION_COOKIE)?.value;

  if (!impersonatedUserId || !(await canImpersonate(realUser, impersonatedUserId))) {
    return { realUser, activeUser: realUser, isImpersonating: false };
  }

  const activeUser = await prisma.user.findUnique({
    where: { id: impersonatedUserId },
    include: userInclude
  });

  if (!activeUser) {
    return { realUser, activeUser: realUser, isImpersonating: false };
  }

  return { realUser, activeUser, isImpersonating: true };
}

export async function getCurrentUser() {
  const context = await getImpersonationContext();
  return context.activeUser;
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  return user;
}

export async function requireRole(requiredRole: Role) {
  const user = await requireUser();
  if (!hasRoleAtLeast(user.role, requiredRole)) {
    redirect("/login?error=access_denied");
  }
  return user;
}

export async function requireApprovedConsultant() {
  const user = await requireUser();
  if (user.role !== "CONSULTANT") {
    redirect("/login?error=access_denied");
  }
  if (user.status !== "ACTIVE") {
    redirect("/pending-approval");
  }
  return user;
}

export async function requirePartner() {
  const user = await requireUser();
  if (user.role !== "PARTNER" && user.role !== "GROUP_LEADER" && user.role !== "COMPANY_ADMIN" && user.role !== "SUPER_ADMIN") {
    redirect("/login?error=access_denied");
  }
  return user;
}

export { IMPERSONATION_COOKIE };
