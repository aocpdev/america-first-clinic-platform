import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Role } from "@/lib/auth/roles";
import { hasRoleAtLeast } from "@/lib/auth/roles";

export async function getCurrentUser() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user?.id) {
    return null;
  }

  return prisma.user.findUnique({
    where: { authUserId: user.id },
    include: { consultantProfile: true, partnerProfile: true, groupLeaderProfile: true, company: true }
  });
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
