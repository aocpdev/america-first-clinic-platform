"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { UserRole, UserStatus } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { createReferralCode, createReferralSlug } from "@/lib/auth/slug";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";
import { roleSchema } from "@/lib/validations/core";
import { getAuthenticatedUser, IMPERSONATION_COOKIE, requireRole, requireUser } from "@/lib/auth/current-user";
import { dashboardPathForRole } from "@/lib/auth/redirects";
import {
  clampGroupLeaderPoolShareBps,
  DEFAULT_CONSULTANT_SHARE_BPS,
  DEFAULT_GROUP_LEADER_SHARE_BPS,
  DEFAULT_MANAGER_SHARE_BPS
} from "@/lib/commissions/margin-split";
import { companyAdminUserIds, notifyUsers, personDisplayName } from "@/lib/notifications";
import { normalizePhoneToE164 } from "@/lib/phone";

function formValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function bpsFromPercentInput(value: string, fallbackBps: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallbackBps;
  }
  return Math.max(0, Math.min(10000, Math.round(parsed * 100)));
}

function leaderPoolBpsFromPercentInput(value: string, fallbackBps = DEFAULT_GROUP_LEADER_SHARE_BPS) {
  return clampGroupLeaderPoolShareBps(bpsFromPercentInput(value, fallbackBps));
}

function redirectWithError(path: string, error: string): never {
  const separator = path.includes("?") ? "&" : "?";
  redirect(`${path}${separator}error=${encodeURIComponent(error)}`);
}

async function assertUniqueUserContact({
  email,
  phone,
  redirectPath,
  excludeUserId
}: {
  email: string;
  phone: string | null;
  redirectPath: string;
  excludeUserId?: string;
}) {
  const existingEmail = await prisma.user.findUnique({
    where: { email },
    select: { id: true }
  });

  if (existingEmail && existingEmail.id !== excludeUserId) {
    redirectWithError(redirectPath, "duplicate_email");
  }

  if (phone) {
    const existingPhone = await prisma.user.findFirst({
      where: { phone },
      select: { id: true }
    });

    if (existingPhone && existingPhone.id !== excludeUserId) {
      redirectWithError(redirectPath, "duplicate_phone");
    }
  }
}

async function getAmericaFirstClinic() {
  return prisma.company.upsert({
    where: { slug: "america-first-clinic" },
    update: {},
    create: {
      name: "America First Clinic",
      slug: "america-first-clinic",
      logoUrl: "/america-first-clinic-logo.jpeg"
    }
  });
}

export async function registerUser(formData: FormData) {
  const firstName = formValue(formData, "firstName");
  const lastName = formValue(formData, "lastName");
  const email = formValue(formData, "email").toLowerCase();
  const password = formValue(formData, "password");
  const phone = normalizePhoneToE164(formValue(formData, "phone"));
  const requestedRole = roleSchema.extract(["CONSULTANT", "GROUP_LEADER"]).catch("CONSULTANT").parse(formValue(formData, "requestedRole") || "CONSULTANT");
  const requestedPartnerProfileId = formValue(formData, "requestedPartnerProfileId");
  const requestedManagerProfileId = requestedRole === "GROUP_LEADER" ? formValue(formData, "requestedManagerProfileId") || null : null;
  const requestedGroupLeaderProfileId = requestedRole === "CONSULTANT" ? formValue(formData, "requestedGroupLeaderProfileId") || null : null;

  if (!firstName || !lastName || !email || password.length < 8 || !requestedPartnerProfileId) {
    redirect("/register?error=invalid_registration");
  }

  const company = await getAmericaFirstClinic();
  await assertUniqueUserContact({ email, phone, redirectPath: "/register" });
  const selectedPartner = await prisma.partnerProfile.findFirst({
    where: {
      id: requestedPartnerProfileId,
      companyId: company.id
    },
    select: { id: true, userId: true, companyName: true, displayName: true }
  });

  if (!selectedPartner) {
    redirect("/register?error=invalid_partner");
  }

  if (requestedManagerProfileId) {
    const selectedManager = await prisma.managerProfile.findFirst({
      where: {
        id: requestedManagerProfileId,
        partnerProfileId: selectedPartner.id
      },
      select: { id: true }
    });

    if (!selectedManager) {
      redirect("/register?error=invalid_manager");
    }
  }

  if (requestedGroupLeaderProfileId) {
    const selectedLeader = await prisma.groupLeaderProfile.findFirst({
      where: {
        id: requestedGroupLeaderProfileId,
        partnerProfileId: selectedPartner.id
      },
      select: { id: true }
    });

    if (!selectedLeader) {
      redirect("/register?error=invalid_group_leader");
    }
  }

  const status = UserStatus.PENDING_APPROVAL;
  const role = requestedRole === "GROUP_LEADER" ? UserRole.GROUP_LEADER : UserRole.CONSULTANT;
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`,
      data: {
        first_name: firstName,
        last_name: lastName,
        requested_role: requestedRole,
        requested_partner_profile_id: selectedPartner.id,
        requested_manager_profile_id: requestedManagerProfileId,
        requested_group_leader_profile_id: requestedGroupLeaderProfileId,
        status
      }
    }
  });

  if (error || !data.user?.id) {
    redirect(`/register?error=${encodeURIComponent(error?.message ?? "registration_failed")}`);
  }

  const user = await prisma.user.upsert({
    where: { authUserId: data.user.id },
    update: {
      companyId: company.id,
      requestedRole,
      requestedPartnerProfileId: selectedPartner.id,
      requestedManagerProfileId,
      requestedGroupLeaderProfileId,
      role,
      status,
      firstName,
      lastName,
      phone,
      isActive: false
    },
    create: {
      authUserId: data.user.id,
      companyId: company.id,
      requestedRole,
      requestedPartnerProfileId: selectedPartner.id,
      requestedManagerProfileId,
      requestedGroupLeaderProfileId,
      role,
      status,
      email,
      firstName,
      lastName,
      phone,
      isActive: false
    }
  });

  const adminIds = await companyAdminUserIds(prisma, company.id);
  const applicantName = personDisplayName({ firstName, lastName, email });
  const roleLabel = requestedRole === "GROUP_LEADER" ? "group leader" : "seller";
  await notifyUsers(prisma, [
    ...adminIds.map((adminId) => ({
      userId: adminId,
      title: `New ${roleLabel} registration`,
      body: `${applicantName} applied under ${selectedPartner.companyName || selectedPartner.displayName || "a partner"}.`,
      metadata: {
        type: "registration",
        userId: user.id,
        requestedRole,
        partnerProfileId: selectedPartner.id,
        managerProfileId: requestedManagerProfileId
      }
    })),
    {
      userId: selectedPartner.userId,
      title: `New ${roleLabel} registration`,
      body: `${applicantName} is waiting for approval.`,
      metadata: {
        type: "registration",
        userId: user.id,
        requestedRole,
        partnerProfileId: selectedPartner.id,
        managerProfileId: requestedManagerProfileId
      }
    }
  ]);

  redirect("/pending-approval");
}

export async function loginUser(formData: FormData) {
  const email = formValue(formData, "email").toLowerCase();
  const password = formValue(formData, "password");
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !data.user?.id) {
    redirect("/login?error=invalid_credentials");
  }

  const user = await prisma.user.findUnique({
    where: { authUserId: data.user.id },
    include: { consultantProfile: true }
  });

  if (!user) {
    await supabase.auth.signOut();
    redirect("/login?error=profile_not_found");
  }

  if (!user.isActive || user.status === "SUSPENDED" || user.status === "REJECTED") {
    await supabase.auth.signOut();
    redirect("/login?error=account_not_active");
  }

  if (user.role === "CONSULTANT" && user.status !== "ACTIVE") {
    redirect("/pending-approval");
  }

  redirect(dashboardPathForRole(user.role));
}

export async function logoutUser() {
  const supabase = await createSupabaseServerClient();
  const cookieStore = await cookies();
  cookieStore.delete(IMPERSONATION_COOKIE);
  await supabase.auth.signOut();
  redirect("/login");
}

function displayNameForUser(user: { firstName: string | null; lastName: string | null; email: string }) {
  return [user.firstName, user.lastName].filter(Boolean).join(" ").trim() || user.email;
}

async function ensureCanImpersonateTarget(targetUserId: string) {
  const realUser = await getAuthenticatedUser();

  if (!realUser) {
    redirect("/login");
  }

  const target = await prisma.user.findUnique({
    where: { id: targetUserId },
    include: { consultantProfile: true, groupLeaderProfile: true, partnerProfile: true }
  });

  if (!target || target.status !== "ACTIVE" || !target.isActive) {
    redirect("/login?error=impersonation_unavailable");
  }

  if (realUser.role === "COMPANY_ADMIN" || realUser.role === "SUPER_ADMIN") {
    if (
      target.companyId !== realUser.companyId ||
      !["PARTNER", "GROUP_LEADER", "CONSULTANT"].includes(target.role)
    ) {
      redirect("/login?error=access_denied");
    }

    return { realUser, target };
  }

  if (realUser.role === "PARTNER" && realUser.partnerProfile) {
    const partnerProfileId = realUser.partnerProfile.id;
    const isLeader = target.groupLeaderProfile?.partnerProfileId === partnerProfileId;
    const isConsultant = target.consultantProfile?.partnerProfileId === partnerProfileId;

    if (target.companyId !== realUser.companyId || (!isLeader && !isConsultant)) {
      redirect("/login?error=access_denied");
    }

    if (target.role !== "GROUP_LEADER" && target.role !== "CONSULTANT") {
      redirect("/login?error=access_denied");
    }

    return { realUser, target };
  }

  redirect("/login?error=access_denied");
}

export async function startImpersonation(formData: FormData) {
  const targetUserId = formValue(formData, "targetUserId");

  if (!targetUserId) {
    redirect("/login?error=invalid_impersonation");
  }

  const { realUser, target } = await ensureCanImpersonateTarget(targetUserId);
  const cookieStore = await cookies();
  cookieStore.set(IMPERSONATION_COOKIE, target.id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60
  });

  await prisma.auditLog.create({
    data: {
      companyId: realUser.companyId,
      userId: realUser.id,
      action: "IMPERSONATION_STARTED",
      resource: "User",
      resourceId: target.id,
      metadata: {
        targetEmail: target.email,
        targetName: displayNameForUser(target),
        targetRole: target.role
      }
    }
  });

  redirect(dashboardPathForRole(target.role));
}

export async function stopImpersonation() {
  const realUser = await getAuthenticatedUser();
  const cookieStore = await cookies();
  cookieStore.delete(IMPERSONATION_COOKIE);
  redirect(realUser ? dashboardPathForRole(realUser.role) : "/login");
}

export async function approveConsultant(formData: FormData) {
  const approver = await requireUser();
  const userId = formValue(formData, "userId");
  const requestedFormPartnerProfileId = formValue(formData, "partnerProfileId") || null;
  const requestedGroupLeaderProfileId = formValue(formData, "groupLeaderProfileId") || null;
  const requestedManagerProfileIdFromForm = formValue(formData, "managerProfileId") || null;
  let managerProfileId = requestedManagerProfileIdFromForm || null;
  let consultantCommissionBps = DEFAULT_CONSULTANT_SHARE_BPS;
  let leaderCommissionBps = DEFAULT_GROUP_LEADER_SHARE_BPS;
  let leaderConsultantOverrideBps = 0;
  const user = await prisma.user.findUnique({ where: { id: userId } });

  if (!user || (user.requestedRole !== "CONSULTANT" && user.requestedRole !== "GROUP_LEADER")) {
    redirect("/admin/consultants?error=application_not_found");
  }

  const company = await getAmericaFirstClinic();
  let partnerProfileId = requestedFormPartnerProfileId || user.requestedPartnerProfileId;
  let groupLeaderProfileId = requestedGroupLeaderProfileId || user.requestedGroupLeaderProfileId;
  managerProfileId = managerProfileId || user.requestedManagerProfileId;

  if (approver.role === "PARTNER") {
    const partnerProfile = await prisma.partnerProfile.findUnique({ where: { userId: approver.id } });
    if (!partnerProfile || user.requestedPartnerProfileId !== partnerProfile.id) {
      redirect("/partner/consultants?error=access_denied");
    }
    partnerProfileId = partnerProfile.id;
    consultantCommissionBps = bpsFromPercentInput(formValue(formData, "consultantCommissionPercent"), DEFAULT_CONSULTANT_SHARE_BPS);
    leaderCommissionBps = leaderPoolBpsFromPercentInput(formValue(formData, "leaderCommissionPercent"));
    leaderConsultantOverrideBps = leaderPoolBpsFromPercentInput(formValue(formData, "consultantOverridePercent"), 0);
  } else if (approver.role === "GROUP_LEADER") {
    if (user.requestedRole !== "CONSULTANT") {
      redirect("/partner/consultants?error=access_denied");
    }
    const groupLeaderProfile = await prisma.groupLeaderProfile.findUnique({ where: { userId: approver.id } });
    if (!groupLeaderProfile || user.requestedPartnerProfileId !== groupLeaderProfile.partnerProfileId) {
      redirect("/partner/consultants?error=access_denied");
    }
    partnerProfileId = groupLeaderProfile.partnerProfileId;
    groupLeaderProfileId = groupLeaderProfile.id;
    consultantCommissionBps = DEFAULT_CONSULTANT_SHARE_BPS;
  } else if (approver.role !== "COMPANY_ADMIN" && approver.role !== "SUPER_ADMIN") {
    redirect("/login?error=access_denied");
  }

  if (user.requestedRole === "GROUP_LEADER") {
    if (!partnerProfileId) {
      redirect("/admin/consultants?error=invalid_partner");
    }

    if (managerProfileId) {
      const manager = await prisma.managerProfile.findFirst({
        where: { id: managerProfileId, partnerProfileId },
        select: { id: true }
      });

      if (!manager) {
        redirect("/admin/consultants?error=invalid_manager");
      }
    }

    const displayName = displayNameForUser(user);

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: {
          role: "GROUP_LEADER",
          status: "ACTIVE",
          isActive: true,
          approvedAt: new Date(),
          approvedByUserId: approver.id,
          rejectedAt: null,
          rejectionReason: null,
          requestedGroupLeaderProfileId: null,
          requestedManagerProfileId: managerProfileId
        }
      });

      const leader = await tx.groupLeaderProfile.upsert({
        where: { userId: user.id },
        update: {
          companyId: company.id,
          partnerProfileId,
          managerProfileId,
          displayName,
          commissionBps: leaderCommissionBps,
          consultantOverrideBps: leaderConsultantOverrideBps
        },
        create: {
          userId: user.id,
          companyId: company.id,
          partnerProfileId,
          managerProfileId,
          displayName,
          commissionBps: leaderCommissionBps,
          consultantOverrideBps: leaderConsultantOverrideBps
        }
      });

      await tx.user.update({
        where: { id: user.id },
        data: { requestedGroupLeaderProfileId: leader.id }
      });

      await tx.auditLog.create({
        data: {
          companyId: company.id,
          userId: approver.id,
          action: "GROUP_LEADER_APPROVED",
          resource: "User",
          resourceId: user.id,
          metadata: { partnerProfileId, managerProfileId, groupLeaderProfileId: leader.id, leaderCommissionBps, leaderConsultantOverrideBps }
        }
      });
    });

    const partnerProfile = await prisma.partnerProfile.findUnique({
      where: { id: partnerProfileId },
      select: { userId: true }
    });
    await notifyUsers(prisma, [
      {
        userId: user.id,
        title: "Group leader account approved",
        body: "Your America First Clinic workspace is ready.",
        metadata: { type: "approval", userId: user.id, role: "GROUP_LEADER", partnerProfileId }
      },
      {
        userId: partnerProfile?.userId,
        title: "New group leader approved",
        body: `${displayName} is now active in your network.`,
        metadata: { type: "approval", userId: user.id, role: "GROUP_LEADER", partnerProfileId }
      }
    ]);

    const adminClient = createSupabaseAdminClient();
    await adminClient.auth.admin.updateUserById(user.authUserId, {
      app_metadata: {
        role: "GROUP_LEADER",
        company_id: company.id,
        status: "ACTIVE"
      }
    });

    revalidatePath("/admin/consultants");
    revalidatePath("/partner/consultants");
    if (approver.role === "PARTNER") {
      redirect("/partner/consultants?updated=leader_approved");
    }
    redirect(`/admin/consultants?partnerId=${partnerProfileId}&section=approval&updated=leader_approved`);
  }

  if (groupLeaderProfileId) {
    const groupLeader = await prisma.groupLeaderProfile.findFirst({
      where: { id: groupLeaderProfileId, partnerProfileId: partnerProfileId ?? undefined },
      select: { id: true, managerProfileId: true }
    });

    if (!groupLeader) {
      redirect("/admin/consultants?error=invalid_group_leader");
    }

    managerProfileId = groupLeader.managerProfileId;
  } else if (managerProfileId) {
    const manager = await prisma.managerProfile.findFirst({
      where: { id: managerProfileId, partnerProfileId: partnerProfileId ?? undefined },
      select: { id: true }
    });

    if (!manager) {
      redirect("/admin/consultants?error=invalid_manager");
    }
  }

  const firstName = user.firstName ?? "consultant";
  const lastName = user.lastName ?? "seller";
  let referralSlug = createReferralSlug(firstName, lastName);
  let referralCode = createReferralCode(firstName, lastName);

  const existingSlug = await prisma.consultantProfile.findUnique({ where: { referralSlug } });
  if (existingSlug) {
    referralSlug = `${referralSlug}-${user.id.slice(0, 4)}`;
  }

  const existingCode = await prisma.consultantProfile.findUnique({ where: { referralCode } });
  if (existingCode) {
    referralCode = `${referralCode}${user.id.slice(0, 2).toUpperCase()}`;
  }

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: user.id },
      data: {
        role: "CONSULTANT",
        status: "ACTIVE",
        isActive: true,
        approvedAt: new Date(),
        approvedByUserId: approver.id,
        rejectedAt: null,
        rejectionReason: null,
        requestedManagerProfileId: managerProfileId
      }
    });

    await tx.consultantProfile.upsert({
      where: { userId: user.id },
      update: { companyId: company.id, partnerProfileId, managerProfileId, groupLeaderProfileId, commissionBps: consultantCommissionBps },
      create: {
        userId: user.id,
        companyId: company.id,
        partnerProfileId,
        managerProfileId,
        groupLeaderProfileId,
        commissionBps: consultantCommissionBps,
        referralSlug,
        referralCode,
        onboardingDone: false
      }
    });

    await tx.auditLog.create({
      data: {
        companyId: company.id,
        userId: approver.id,
        action: "CONSULTANT_APPROVED",
        resource: "User",
        resourceId: user.id
      }
    });
  });

  const [leaderProfile, partnerProfile] = await Promise.all([
    groupLeaderProfileId
      ? prisma.groupLeaderProfile.findUnique({
          where: { id: groupLeaderProfileId },
          select: { userId: true, displayName: true }
        })
      : null,
    partnerProfileId
      ? prisma.partnerProfile.findUnique({
          where: { id: partnerProfileId },
          select: { userId: true }
        })
      : null
  ]);
  const consultantName = displayNameForUser(user);
  await notifyUsers(prisma, [
    {
      userId: user.id,
      title: "Seller account approved",
      body: "Your America First Clinic seller workspace is ready.",
      metadata: { type: "approval", userId: user.id, role: "CONSULTANT", partnerProfileId, managerProfileId, groupLeaderProfileId }
    },
    {
      userId: leaderProfile?.userId,
      title: "New seller approved",
      body: `${consultantName} has been added to your seller group.`,
      metadata: { type: "approval", userId: user.id, role: "CONSULTANT", partnerProfileId, managerProfileId, groupLeaderProfileId }
    },
    {
      userId: partnerProfile?.userId,
      title: "New seller approved",
      body: `${consultantName} is now active in your network.`,
      metadata: { type: "approval", userId: user.id, role: "CONSULTANT", partnerProfileId, managerProfileId, groupLeaderProfileId }
    }
  ]);

  const adminClient = createSupabaseAdminClient();
  await adminClient.auth.admin.updateUserById(user.authUserId, {
    app_metadata: {
      role: "CONSULTANT",
      company_id: company.id,
      status: "ACTIVE"
    }
  });

  revalidatePath("/admin/consultants");
  revalidatePath("/partner/consultants");
}

export async function rejectConsultant(formData: FormData) {
  const approver = await requireUser();
  const userId = formValue(formData, "userId");
  const reason = formValue(formData, "reason") || "Application rejected.";
  const user = await prisma.user.findUnique({ where: { id: userId } });

  if (!user || (user.requestedRole !== "CONSULTANT" && user.requestedRole !== "GROUP_LEADER")) {
    redirect("/admin/consultants?error=application_not_found");
  }

  if (approver.role === "PARTNER") {
    const partnerProfile = await prisma.partnerProfile.findUnique({ where: { userId: approver.id } });
    if (!partnerProfile || user.requestedPartnerProfileId !== partnerProfile.id) {
      redirect("/partner/consultants?error=access_denied");
    }
  } else if (approver.role === "GROUP_LEADER") {
    if (user.requestedRole !== "CONSULTANT") {
      redirect("/partner/consultants?error=access_denied");
    }
    const groupLeaderProfile = await prisma.groupLeaderProfile.findUnique({ where: { userId: approver.id } });
    if (
      !groupLeaderProfile ||
      user.requestedPartnerProfileId !== groupLeaderProfile.partnerProfileId ||
      user.requestedGroupLeaderProfileId !== groupLeaderProfile.id
    ) {
      redirect("/partner/consultants?error=access_denied");
    }
  } else if (approver.role !== "COMPANY_ADMIN" && approver.role !== "SUPER_ADMIN") {
    redirect("/login?error=access_denied");
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      status: "REJECTED",
      isActive: false,
      rejectedAt: new Date(),
      rejectionReason: reason
    }
  });

  await prisma.auditLog.create({
    data: {
      companyId: approver.companyId,
      userId: approver.id,
      action: "CONSULTANT_REJECTED",
      resource: "User",
      resourceId: userId,
      metadata: { reason }
    }
  });

  revalidatePath("/admin/consultants");
  revalidatePath("/partner/consultants");
}

export async function createPartnerByAdmin(formData: FormData) {
  const admin = await requireRole("COMPANY_ADMIN");
  const firstName = formValue(formData, "firstName");
  const lastName = formValue(formData, "lastName");
  const email = formValue(formData, "email").toLowerCase();
  const password = formValue(formData, "password");
  const phone = normalizePhoneToE164(formValue(formData, "phone"));
  const companyName = formValue(formData, "companyName");
  const commissionBps = bpsFromPercentInput(formValue(formData, "commissionPercent"), 2500);

  if (!firstName || !lastName || !email || password.length < 8 || !companyName) {
    redirect("/admin/consultants?error=invalid_partner");
  }

  const company = await getAmericaFirstClinic();
  await assertUniqueUserContact({ email, phone, redirectPath: "/admin/consultants" });
  const adminClient = createSupabaseAdminClient();
  const { data, error } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      first_name: firstName,
      last_name: lastName,
      role: "PARTNER"
    },
    app_metadata: {
      role: "PARTNER",
      company_id: company.id,
      status: "ACTIVE"
    }
  });

  if (error || !data.user?.id) {
    redirect(`/admin/consultants?error=${encodeURIComponent(error?.message ?? "partner_create_failed")}`);
  }

  const displayName = [firstName, lastName].filter(Boolean).join(" ");

  await prisma.$transaction(async (tx) => {
    const partnerUser = await tx.user.upsert({
      where: { authUserId: data.user.id },
      update: {
        companyId: company.id,
        role: "PARTNER",
        requestedRole: "PARTNER",
        status: "ACTIVE",
        firstName,
        lastName,
        phone,
        isActive: true
      },
      create: {
        authUserId: data.user.id,
        companyId: company.id,
        role: "PARTNER",
        requestedRole: "PARTNER",
        status: "ACTIVE",
        email,
        firstName,
        lastName,
        phone,
        isActive: true
      }
    });

    await tx.partnerProfile.upsert({
      where: { userId: partnerUser.id },
      update: { companyId: company.id, displayName, companyName, commissionBps },
      create: {
        userId: partnerUser.id,
        companyId: company.id,
        displayName,
        companyName,
        commissionBps
      }
    });

    await tx.auditLog.create({
      data: {
        companyId: company.id,
        userId: admin.id,
        action: "PARTNER_CREATED",
        resource: "User",
        resourceId: partnerUser.id,
        metadata: { companyName }
      }
    });
  });

  revalidatePath("/admin/consultants");
  revalidatePath("/register");
  redirect("/admin/consultants?updated=partner_created");
}

export async function createGroupLeader(formData: FormData) {
  const actor = await requireUser();
  const firstName = formValue(formData, "firstName");
  const lastName = formValue(formData, "lastName");
  const email = formValue(formData, "email").toLowerCase();
  const password = formValue(formData, "password");
  const phone = normalizePhoneToE164(formValue(formData, "phone"));
  const selectedPartnerProfileId = formValue(formData, "partnerProfileId");
  const selectedManagerProfileId = formValue(formData, "managerProfileId") || null;
  let commissionBps = DEFAULT_GROUP_LEADER_SHARE_BPS;
  let consultantOverrideBps = 0;

  if (!firstName || !lastName || !email || password.length < 8) {
    redirect(actor.role === "PARTNER" ? "/partner/consultants?error=invalid_group_leader" : "/admin/consultants?error=invalid_group_leader");
  }

  const company = await getAmericaFirstClinic();
  let partnerProfileId = selectedPartnerProfileId;

  if (actor.role === "PARTNER") {
    const partnerProfile = await prisma.partnerProfile.findUnique({ where: { userId: actor.id } });
    if (!partnerProfile) {
      redirect("/partner/consultants?error=partner_profile_required");
    }
    partnerProfileId = partnerProfile.id;
  } else if (actor.role !== "COMPANY_ADMIN" && actor.role !== "SUPER_ADMIN") {
    redirect("/login?error=access_denied");
  }

  commissionBps = leaderPoolBpsFromPercentInput(formValue(formData, "commissionPercent"));
  consultantOverrideBps = leaderPoolBpsFromPercentInput(formValue(formData, "consultantOverridePercent"), 0);

  const partnerProfile = await prisma.partnerProfile.findFirst({
    where: { id: partnerProfileId, companyId: company.id },
    select: { id: true }
  });

  if (!partnerProfile) {
    redirect(actor.role === "PARTNER" ? "/partner/consultants?error=invalid_partner" : "/admin/consultants?error=invalid_partner");
  }

  if (selectedManagerProfileId) {
    const manager = await prisma.managerProfile.findFirst({
      where: {
        id: selectedManagerProfileId,
        partnerProfileId: partnerProfile.id
      },
      select: { id: true }
    });

    if (!manager) {
      redirect(actor.role === "PARTNER" ? "/partner/consultants?error=invalid_manager" : `/admin/consultants?partnerId=${partnerProfile.id}&section=leaders&error=invalid_manager`);
    }
  }

  await assertUniqueUserContact({
    email,
    phone,
    redirectPath: actor.role === "PARTNER" ? "/partner/consultants" : `/admin/consultants?partnerId=${partnerProfile.id}&section=leaders`
  });

  const adminClient = createSupabaseAdminClient();
  const { data, error } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      first_name: firstName,
      last_name: lastName,
      role: "GROUP_LEADER"
    },
    app_metadata: {
      role: "GROUP_LEADER",
      company_id: company.id,
      status: "ACTIVE"
    }
  });

  if (error || !data.user?.id) {
    const target = actor.role === "PARTNER" ? "/partner/consultants" : "/admin/consultants";
    redirect(`${target}?error=${encodeURIComponent(error?.message ?? "group_leader_create_failed")}`);
  }

  const displayName = [firstName, lastName].filter(Boolean).join(" ");

  await prisma.$transaction(async (tx) => {
    const leaderUser = await tx.user.upsert({
      where: { authUserId: data.user.id },
      update: {
        companyId: company.id,
        role: "GROUP_LEADER",
        requestedRole: "GROUP_LEADER",
        requestedPartnerProfileId: partnerProfile.id,
        requestedManagerProfileId: selectedManagerProfileId,
        status: "ACTIVE",
        firstName,
        lastName,
        phone,
        isActive: true
      },
      create: {
        authUserId: data.user.id,
        companyId: company.id,
        role: "GROUP_LEADER",
        requestedRole: "GROUP_LEADER",
        requestedPartnerProfileId: partnerProfile.id,
        requestedManagerProfileId: selectedManagerProfileId,
        status: "ACTIVE",
        email,
        firstName,
        lastName,
        phone,
        isActive: true
      }
    });

    await tx.groupLeaderProfile.upsert({
      where: { userId: leaderUser.id },
      update: { companyId: company.id, partnerProfileId: partnerProfile.id, managerProfileId: selectedManagerProfileId, displayName, commissionBps, consultantOverrideBps },
      create: {
        userId: leaderUser.id,
        companyId: company.id,
        partnerProfileId: partnerProfile.id,
        managerProfileId: selectedManagerProfileId,
        displayName,
        commissionBps,
        consultantOverrideBps
      }
    });

    await tx.auditLog.create({
      data: {
        companyId: company.id,
        userId: actor.id,
        action: "GROUP_LEADER_CREATED",
        resource: "User",
        resourceId: leaderUser.id,
        metadata: { partnerProfileId: partnerProfile.id, managerProfileId: selectedManagerProfileId, commissionBps, consultantOverrideBps }
      }
    });
  });

  revalidatePath("/admin/consultants");
  revalidatePath("/partner/consultants");
  redirect(actor.role === "PARTNER" ? "/partner/consultants?updated=group_leader_created" : `/admin/consultants?partnerId=${partnerProfile.id}&section=leaders&updated=group_leader_created`);
}

export async function createManager(formData: FormData) {
  const actor = await requireUser();
  const firstName = formValue(formData, "firstName");
  const lastName = formValue(formData, "lastName");
  const email = formValue(formData, "email").toLowerCase();
  const password = formValue(formData, "password");
  const phone = normalizePhoneToE164(formValue(formData, "phone"));
  const selectedPartnerProfileId = formValue(formData, "partnerProfileId");
  let commissionBps = DEFAULT_MANAGER_SHARE_BPS;
  let leaderOverrideBps = 0;

  if (!firstName || !lastName || !email || password.length < 8) {
    redirect(actor.role === "PARTNER" ? "/partner/consultants?error=invalid_manager" : "/admin/consultants?error=invalid_manager");
  }

  const company = await getAmericaFirstClinic();
  let partnerProfileId = selectedPartnerProfileId;

  if (actor.role === "PARTNER") {
    const partnerProfile = await prisma.partnerProfile.findUnique({ where: { userId: actor.id } });
    if (!partnerProfile) {
      redirect("/partner/consultants?error=partner_profile_required");
    }
    partnerProfileId = partnerProfile.id;
  } else if (actor.role !== "COMPANY_ADMIN" && actor.role !== "SUPER_ADMIN") {
    redirect("/login?error=access_denied");
  }

  commissionBps = leaderPoolBpsFromPercentInput(formValue(formData, "commissionPercent"), DEFAULT_MANAGER_SHARE_BPS);
  leaderOverrideBps = leaderPoolBpsFromPercentInput(formValue(formData, "leaderOverridePercent"), 0);

  const partnerProfile = await prisma.partnerProfile.findFirst({
    where: { id: partnerProfileId, companyId: company.id },
    select: { id: true }
  });

  if (!partnerProfile) {
    redirect(actor.role === "PARTNER" ? "/partner/consultants?error=invalid_partner" : "/admin/consultants?error=invalid_partner");
  }

  await assertUniqueUserContact({
    email,
    phone,
    redirectPath: actor.role === "PARTNER" ? "/partner/consultants" : `/admin/consultants?partnerId=${partnerProfile.id}&section=managers`
  });

  const adminClient = createSupabaseAdminClient();
  const { data, error } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      first_name: firstName,
      last_name: lastName,
      role: "MANAGER"
    },
    app_metadata: {
      role: "MANAGER",
      company_id: company.id,
      status: "ACTIVE"
    }
  });

  if (error || !data.user?.id) {
    const target = actor.role === "PARTNER" ? "/partner/consultants" : `/admin/consultants?partnerId=${partnerProfile.id}&section=managers`;
    redirectWithError(target, error?.message ?? "manager_create_failed");
  }

  const displayName = [firstName, lastName].filter(Boolean).join(" ");

  await prisma.$transaction(async (tx) => {
    const managerUser = await tx.user.upsert({
      where: { authUserId: data.user.id },
      update: {
        companyId: company.id,
        role: "MANAGER",
        requestedRole: "MANAGER",
        requestedPartnerProfileId: partnerProfile.id,
        status: "ACTIVE",
        firstName,
        lastName,
        phone,
        isActive: true,
        approvedAt: new Date(),
        approvedByUserId: actor.id
      },
      create: {
        authUserId: data.user.id,
        companyId: company.id,
        role: "MANAGER",
        requestedRole: "MANAGER",
        requestedPartnerProfileId: partnerProfile.id,
        status: "ACTIVE",
        email,
        firstName,
        lastName,
        phone,
        isActive: true,
        approvedAt: new Date(),
        approvedByUserId: actor.id
      }
    });

    await tx.managerProfile.upsert({
      where: { userId: managerUser.id },
      update: { companyId: company.id, partnerProfileId: partnerProfile.id, displayName, commissionBps, leaderOverrideBps },
      create: {
        userId: managerUser.id,
        companyId: company.id,
        partnerProfileId: partnerProfile.id,
        displayName,
        commissionBps,
        leaderOverrideBps
      }
    });

    await tx.auditLog.create({
      data: {
        companyId: company.id,
        userId: actor.id,
        action: "MANAGER_CREATED",
        resource: "User",
        resourceId: managerUser.id,
        metadata: { partnerProfileId: partnerProfile.id, commissionBps, leaderOverrideBps }
      }
    });
  });

  revalidatePath("/admin/consultants");
  revalidatePath("/partner/consultants");
  revalidatePath("/register");
  redirect(actor.role === "PARTNER" ? "/partner/consultants?updated=manager_created" : `/admin/consultants?partnerId=${partnerProfile.id}&section=managers&updated=manager_created`);
}

export async function createConsultantByAdmin(formData: FormData) {
  const actor = await requireUser();
  const firstName = formValue(formData, "firstName");
  const lastName = formValue(formData, "lastName");
  const email = formValue(formData, "email").toLowerCase();
  const password = formValue(formData, "password");
  const phone = normalizePhoneToE164(formValue(formData, "phone"));
  const selectedPartnerProfileId = formValue(formData, "partnerProfileId");
  const selectedGroupLeaderProfileId = formValue(formData, "groupLeaderProfileId") || null;
  let selectedManagerProfileId = formValue(formData, "managerProfileId") || null;
  let commissionBps = DEFAULT_CONSULTANT_SHARE_BPS;
  const returnTo = formValue(formData, "returnTo");

  if (!firstName || !lastName || !email || password.length < 8 || !selectedPartnerProfileId) {
    redirect("/admin/consultants?error=invalid_consultant");
  }

  const company = await getAmericaFirstClinic();
  let partnerProfileId = selectedPartnerProfileId;

  if (actor.role === "PARTNER") {
    const partnerProfile = await prisma.partnerProfile.findUnique({ where: { userId: actor.id } });
    if (!partnerProfile) {
      redirect("/partner/consultants?error=partner_profile_required");
    }
    partnerProfileId = partnerProfile.id;
  } else if (actor.role !== "COMPANY_ADMIN" && actor.role !== "SUPER_ADMIN") {
    redirect("/login?error=access_denied");
  }

  commissionBps = bpsFromPercentInput(formValue(formData, "consultantCommissionPercent"), DEFAULT_CONSULTANT_SHARE_BPS);

  const partnerProfile = await prisma.partnerProfile.findFirst({
    where: { id: partnerProfileId, companyId: company.id },
    select: { id: true }
  });

  if (!partnerProfile) {
    redirect(actor.role === "PARTNER" ? "/partner/consultants?error=invalid_partner" : "/admin/consultants?error=invalid_partner");
  }

  const defaultAdminPath = `/admin/consultants?partnerId=${partnerProfile.id}&section=network`;
  const safeReturnTo =
    returnTo.startsWith("/admin/consultants") || returnTo.startsWith("/partner/consultants")
      ? returnTo
      : "";
  const successPath = actor.role === "PARTNER" ? "/partner/consultants?updated=consultant_created" : safeReturnTo || `${defaultAdminPath}&updated=consultant_created`;
  const errorPath = actor.role === "PARTNER" ? "/partner/consultants" : safeReturnTo || defaultAdminPath;

  await assertUniqueUserContact({
    email,
    phone,
    redirectPath: errorPath
  });

  if (selectedGroupLeaderProfileId) {
    const groupLeader = await prisma.groupLeaderProfile.findFirst({
      where: {
        id: selectedGroupLeaderProfileId,
        partnerProfileId: partnerProfile.id
      },
      select: { id: true, managerProfileId: true }
    });

    if (!groupLeader) {
      redirect(actor.role === "PARTNER" ? "/partner/consultants?error=invalid_group_leader" : `/admin/consultants?partnerId=${partnerProfile.id}&error=invalid_group_leader`);
    }

    selectedManagerProfileId = groupLeader.managerProfileId;
  } else if (selectedManagerProfileId) {
    const manager = await prisma.managerProfile.findFirst({
      where: {
        id: selectedManagerProfileId,
        partnerProfileId: partnerProfile.id
      },
      select: { id: true }
    });

    if (!manager) {
      redirect(actor.role === "PARTNER" ? "/partner/consultants?error=invalid_manager" : `/admin/consultants?partnerId=${partnerProfile.id}&error=invalid_manager`);
    }
  }

  const adminClient = createSupabaseAdminClient();
  const { data, error } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      first_name: firstName,
      last_name: lastName,
      role: "CONSULTANT"
    },
    app_metadata: {
      role: "CONSULTANT",
      company_id: company.id,
      status: "ACTIVE"
    }
  });

  if (error || !data.user?.id) {
    const target = actor.role === "PARTNER" ? "/partner/consultants" : `/admin/consultants?partnerId=${partnerProfile.id}`;
    const separator = target.includes("?") ? "&" : "?";
    redirect(`${target}${separator}error=${encodeURIComponent(error?.message ?? "consultant_create_failed")}`);
  }

  let referralSlug = createReferralSlug(firstName, lastName);
  let referralCode = createReferralCode(firstName, lastName);

  const existingSlug = await prisma.consultantProfile.findUnique({ where: { referralSlug } });
  if (existingSlug) {
    referralSlug = `${referralSlug}-${data.user.id.slice(0, 4)}`;
  }

  const existingCode = await prisma.consultantProfile.findUnique({ where: { referralCode } });
  if (existingCode) {
    referralCode = `${referralCode}${data.user.id.slice(0, 2).toUpperCase()}`;
  }

  await prisma.$transaction(async (tx) => {
    const consultantUser = await tx.user.upsert({
      where: { authUserId: data.user.id },
      update: {
        companyId: company.id,
        role: "CONSULTANT",
        requestedRole: "CONSULTANT",
        requestedPartnerProfileId: partnerProfile.id,
        requestedManagerProfileId: selectedManagerProfileId,
        requestedGroupLeaderProfileId: selectedGroupLeaderProfileId,
        status: "ACTIVE",
        firstName,
        lastName,
        phone,
        isActive: true,
        approvedAt: new Date(),
        approvedByUserId: actor.id
      },
      create: {
        authUserId: data.user.id,
        companyId: company.id,
        role: "CONSULTANT",
        requestedRole: "CONSULTANT",
        requestedPartnerProfileId: partnerProfile.id,
        requestedManagerProfileId: selectedManagerProfileId,
        requestedGroupLeaderProfileId: selectedGroupLeaderProfileId,
        status: "ACTIVE",
        email,
        firstName,
        lastName,
        phone,
        isActive: true,
        approvedAt: new Date(),
        approvedByUserId: actor.id
      }
    });

    await tx.consultantProfile.upsert({
      where: { userId: consultantUser.id },
      update: {
        companyId: company.id,
        partnerProfileId: partnerProfile.id,
        managerProfileId: selectedManagerProfileId,
        groupLeaderProfileId: selectedGroupLeaderProfileId,
        commissionBps
      },
      create: {
        userId: consultantUser.id,
        companyId: company.id,
        partnerProfileId: partnerProfile.id,
        managerProfileId: selectedManagerProfileId,
        groupLeaderProfileId: selectedGroupLeaderProfileId,
        commissionBps,
        referralSlug,
        referralCode,
        onboardingDone: false
      }
    });

    await tx.auditLog.create({
      data: {
        companyId: company.id,
        userId: actor.id,
        action: "CONSULTANT_CREATED",
        resource: "User",
        resourceId: consultantUser.id,
        metadata: {
          partnerProfileId: partnerProfile.id,
          managerProfileId: selectedManagerProfileId,
          groupLeaderProfileId: selectedGroupLeaderProfileId,
          commissionBps
        }
      }
    });
  });

  revalidatePath("/admin/consultants");
  revalidatePath("/partner/consultants");
  redirect(successPath);
}

export async function updatePartnerProfileByAdmin(formData: FormData) {
  const admin = await requireRole("COMPANY_ADMIN");
  const partnerProfileId = formValue(formData, "partnerProfileId");
  const firstName = formValue(formData, "firstName") || null;
  const lastName = formValue(formData, "lastName") || null;
  const displayName = formValue(formData, "displayName");
  const companyName = formValue(formData, "companyName");
  const phone = normalizePhoneToE164(formValue(formData, "phone"));
  const commissionBps = bpsFromPercentInput(formValue(formData, "commissionPercent"), 2500);

  if (!partnerProfileId || !displayName || !companyName) {
    redirect("/admin/consultants?error=invalid_partner");
  }

  const partnerProfile = await prisma.partnerProfile.findUnique({
    where: { id: partnerProfileId },
    select: { id: true, userId: true }
  });

  if (!partnerProfile) {
    redirect("/admin/consultants?error=invalid_partner");
  }

  await prisma.$transaction([
    prisma.partnerProfile.update({
      where: { id: partnerProfile.id },
      data: { displayName, companyName, commissionBps }
    }),
    prisma.user.update({
      where: { id: partnerProfile.userId },
      data: { firstName, lastName, phone }
    })
  ]);

  await prisma.auditLog.create({
    data: {
      companyId: admin.companyId,
      userId: admin.id,
      action: "PARTNER_UPDATED",
      resource: "PartnerProfile",
      resourceId: partnerProfileId,
      metadata: { firstName, lastName, displayName, companyName, phone, commissionBps }
    }
  });

  revalidatePath("/admin/consultants");
  revalidatePath("/partner/consultants");
  redirect(`/admin/consultants?partnerId=${partnerProfileId}&section=workspace&updated=partner_updated`);
}

export async function updateManagerProfile(formData: FormData) {
  const actor = await requireUser();
  const managerProfileId = formValue(formData, "managerProfileId");
  const requestedCommissionBps = leaderPoolBpsFromPercentInput(formValue(formData, "commissionPercent"), DEFAULT_MANAGER_SHARE_BPS);
  const requestedLeaderOverrideBps = leaderPoolBpsFromPercentInput(formValue(formData, "leaderOverridePercent"), 0);
  const hasProfileFields = formData.has("firstName") || formData.has("lastName") || formData.has("email") || formData.has("phone") || formData.has("displayName");
  const firstName = formValue(formData, "firstName");
  const lastName = formValue(formData, "lastName");
  const email = formValue(formData, "email").toLowerCase();
  const displayNameInput = formValue(formData, "displayName");

  const manager = await prisma.managerProfile.findUnique({
    where: { id: managerProfileId },
    include: { partnerProfile: true, user: true }
  });

  if (!manager) {
    redirect(actor.role === "PARTNER" ? "/partner/consultants?error=invalid_manager" : "/admin/consultants?error=invalid_manager");
  }

  if (actor.role === "PARTNER") {
    const partnerProfile = await prisma.partnerProfile.findUnique({ where: { userId: actor.id } });
    if (!partnerProfile || partnerProfile.id !== manager.partnerProfileId) {
      redirect("/partner/consultants?error=access_denied");
    }
  } else if (actor.role !== "COMPANY_ADMIN" && actor.role !== "SUPER_ADMIN") {
    redirect("/login?error=access_denied");
  }

  const nextEmail = email || manager.user.email;
  const phone = formData.has("phone") ? normalizePhoneToE164(formValue(formData, "phone")) : manager.user.phone;
  const nextDisplayName = displayNameInput || [firstName, lastName].filter(Boolean).join(" ").trim() || manager.displayName;
  const errorPath = actor.role === "PARTNER" ? "/partner/consultants" : `/admin/consultants?partnerId=${manager.partnerProfileId}&section=managers`;

  if (hasProfileFields && (nextEmail !== manager.user.email || phone !== manager.user.phone)) {
    await assertUniqueUserContact({
      email: nextEmail,
      phone,
      redirectPath: errorPath,
      excludeUserId: manager.userId
    });
  }

  if (hasProfileFields && nextEmail !== manager.user.email && manager.user.authUserId) {
    const adminClient = createSupabaseAdminClient();
    const { error } = await adminClient.auth.admin.updateUserById(manager.user.authUserId, {
      email: nextEmail,
      email_confirm: true
    });

    if (error) {
      redirectWithError(errorPath, error.message || "manager_email_update_failed");
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.managerProfile.update({
      where: { id: manager.id },
      data: {
        displayName: nextDisplayName,
        commissionBps: requestedCommissionBps,
        leaderOverrideBps: requestedLeaderOverrideBps
      }
    });

    if (hasProfileFields) {
      await tx.user.update({
        where: { id: manager.userId },
        data: {
          ...(formData.has("firstName") ? { firstName: firstName || null } : {}),
          ...(formData.has("lastName") ? { lastName: lastName || null } : {}),
          ...(formData.has("email") ? { email: nextEmail } : {}),
          ...(formData.has("phone") ? { phone } : {})
        }
      });
    }
  });

  revalidatePath("/admin/consultants");
  revalidatePath("/partner/consultants");
  redirect(actor.role === "PARTNER" ? "/partner/consultants?updated=manager_updated" : `/admin/consultants?partnerId=${manager.partnerProfileId}&section=managers&updated=manager_updated`);
}

export async function updateGroupLeaderProfile(formData: FormData) {
  const actor = await requireUser();
  const groupLeaderProfileId = formValue(formData, "groupLeaderProfileId");
  const requestedCommissionBps = leaderPoolBpsFromPercentInput(formValue(formData, "commissionPercent"));
  const requestedConsultantOverrideBps = leaderPoolBpsFromPercentInput(formValue(formData, "consultantOverridePercent"), 0);
  const hasProfileFields = formData.has("firstName") || formData.has("lastName") || formData.has("email") || formData.has("phone") || formData.has("displayName");
  const firstName = formValue(formData, "firstName");
  const lastName = formValue(formData, "lastName");
  const email = formValue(formData, "email").toLowerCase();
  const displayNameInput = formValue(formData, "displayName");
  const managerProfileId = formValue(formData, "managerProfileId") || null;

  const leader = await prisma.groupLeaderProfile.findUnique({
    where: { id: groupLeaderProfileId },
    include: { partnerProfile: true, user: true }
  });

  if (!leader) {
    redirect(actor.role === "PARTNER" ? "/partner/consultants?error=invalid_group_leader" : "/admin/consultants?error=invalid_group_leader");
  }

  if (actor.role === "PARTNER") {
    const partnerProfile = await prisma.partnerProfile.findUnique({ where: { userId: actor.id } });
    if (!partnerProfile || partnerProfile.id !== leader.partnerProfileId) {
      redirect("/partner/consultants?error=access_denied");
    }
  } else if (actor.role !== "COMPANY_ADMIN" && actor.role !== "SUPER_ADMIN") {
    redirect("/login?error=access_denied");
  }

  const nextEmail = email || leader.user.email;
  const phone = formData.has("phone") ? normalizePhoneToE164(formValue(formData, "phone")) : leader.user.phone;
  const nextDisplayName = displayNameInput || [firstName, lastName].filter(Boolean).join(" ").trim() || leader.displayName;
  const errorPath = actor.role === "PARTNER" ? "/partner/consultants" : `/admin/consultants?partnerId=${leader.partnerProfileId}&section=leaders`;

  if (managerProfileId) {
    const manager = await prisma.managerProfile.findFirst({
      where: {
        id: managerProfileId,
        partnerProfileId: leader.partnerProfileId
      },
      select: { id: true }
    });

    if (!manager) {
      redirectWithError(errorPath, "invalid_manager");
    }
  }

  if (hasProfileFields && (nextEmail !== leader.user.email || phone !== leader.user.phone)) {
    await assertUniqueUserContact({
      email: nextEmail,
      phone,
      redirectPath: errorPath,
      excludeUserId: leader.userId
    });
  }

  if (hasProfileFields && nextEmail !== leader.user.email && leader.user.authUserId) {
    const adminClient = createSupabaseAdminClient();
    const { error } = await adminClient.auth.admin.updateUserById(leader.user.authUserId, {
      email: nextEmail,
      email_confirm: true
    });

    if (error) {
      redirectWithError(errorPath, error.message || "leader_email_update_failed");
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.groupLeaderProfile.update({
      where: { id: leader.id },
      data: {
        displayName: nextDisplayName,
        managerProfileId,
        commissionBps: requestedCommissionBps,
        consultantOverrideBps: requestedConsultantOverrideBps
      }
    });

    if (hasProfileFields) {
      await tx.user.update({
        where: { id: leader.userId },
        data: {
          ...(formData.has("firstName") ? { firstName: firstName || null } : {}),
          ...(formData.has("lastName") ? { lastName: lastName || null } : {}),
          ...(formData.has("email") ? { email: nextEmail } : {}),
          ...(formData.has("phone") ? { phone } : {})
        }
      });
    }
  });

  revalidatePath("/admin/consultants");
  revalidatePath("/partner/consultants");
  redirect(actor.role === "PARTNER" ? "/partner/consultants?updated=leader_updated" : `/admin/consultants?partnerId=${leader.partnerProfileId}&section=leaders&updated=leader_updated`);
}

export async function updateConsultantCommercials(formData: FormData) {
  const actor = await requireUser();
  const consultantProfileId = formValue(formData, "consultantProfileId");
  const partnerProfileId = formValue(formData, "partnerProfileId") || null;
  const groupLeaderProfileId = formValue(formData, "groupLeaderProfileId") || null;
  let managerProfileId = formValue(formData, "managerProfileId") || null;
  const requestedCommissionBps = bpsFromPercentInput(formValue(formData, "consultantCommissionPercent"), DEFAULT_CONSULTANT_SHARE_BPS);
  const hasProfileFields = formData.has("firstName") || formData.has("lastName") || formData.has("email") || formData.has("phone");
  const firstName = formValue(formData, "firstName");
  const lastName = formValue(formData, "lastName");
  const email = formValue(formData, "email").toLowerCase();
  const returnTo = formValue(formData, "returnTo");

  const consultant = await prisma.consultantProfile.findUnique({
    where: { id: consultantProfileId },
    include: { partnerProfile: true, user: true }
  });

  if (!consultant) {
    redirect("/admin/consultants?error=consultant_not_found");
  }

  let authorizedPartnerProfileId = partnerProfileId || consultant.partnerProfileId;

  if (actor.role === "PARTNER") {
    const partnerProfile = await prisma.partnerProfile.findUnique({ where: { userId: actor.id } });
    if (!partnerProfile || partnerProfile.id !== consultant.partnerProfileId) {
      redirect("/partner/consultants?error=access_denied");
    }
    authorizedPartnerProfileId = partnerProfile.id;
  } else if (actor.role !== "COMPANY_ADMIN" && actor.role !== "SUPER_ADMIN") {
    redirect("/login?error=access_denied");
  }

  if (groupLeaderProfileId) {
    const leader = await prisma.groupLeaderProfile.findFirst({
      where: { id: groupLeaderProfileId, partnerProfileId: authorizedPartnerProfileId ?? undefined },
      select: { id: true, managerProfileId: true }
    });

    if (!leader) {
      redirect("/admin/consultants?error=invalid_group_leader");
    }

    managerProfileId = leader.managerProfileId;
  } else if (managerProfileId) {
    const manager = await prisma.managerProfile.findFirst({
      where: { id: managerProfileId, partnerProfileId: authorizedPartnerProfileId ?? undefined },
      select: { id: true }
    });

    if (!manager) {
      redirect("/admin/consultants?error=invalid_manager");
    }
  }

  const destination = actor.role === "PARTNER"
    ? "/partner/consultants?updated=consultant_updated"
    : returnTo.startsWith("/admin/consultants")
      ? returnTo
      : `/admin/consultants?partnerId=${authorizedPartnerProfileId ?? ""}&section=network&updated=consultant_updated`;
  const errorPath = actor.role === "PARTNER" ? "/partner/consultants" : `/admin/consultants?partnerId=${authorizedPartnerProfileId ?? ""}&section=network`;
  const nextEmail = email || consultant.user.email;
  const phone = formData.has("phone") ? normalizePhoneToE164(formValue(formData, "phone")) : consultant.user.phone;
  const userUpdateData = hasProfileFields
    ? {
        ...(formData.has("firstName") ? { firstName: firstName || null } : {}),
        ...(formData.has("lastName") ? { lastName: lastName || null } : {}),
        ...(formData.has("email") ? { email: nextEmail } : {}),
        ...(formData.has("phone") ? { phone } : {})
      }
    : null;

  if (hasProfileFields && (nextEmail !== consultant.user.email || phone !== consultant.user.phone)) {
    await assertUniqueUserContact({
      email: nextEmail,
      phone,
      redirectPath: errorPath,
      excludeUserId: consultant.userId
    });
  }

  if (hasProfileFields && nextEmail !== consultant.user.email && consultant.user.authUserId) {
    const adminClient = createSupabaseAdminClient();
    const { error } = await adminClient.auth.admin.updateUserById(consultant.user.authUserId, {
      email: nextEmail,
      email_confirm: true
    });

    if (error) {
      redirectWithError(errorPath, error.message || "consultant_email_update_failed");
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.consultantProfile.update({
      where: { id: consultant.id },
      data: {
        ...(authorizedPartnerProfileId ? { partnerProfileId: authorizedPartnerProfileId } : {}),
        managerProfileId,
        groupLeaderProfileId,
        commissionBps: requestedCommissionBps
      }
    });

    if (userUpdateData) {
      await tx.user.update({
        where: { id: consultant.userId },
        data: userUpdateData
      });
    }
  });

  revalidatePath("/admin/consultants");
  revalidatePath("/partner/consultants");
  redirect(destination);
}

export async function assignConsultantToLeader(formData: FormData) {
  const actor = await requireUser();
  const consultantProfileId = formValue(formData, "consultantProfileId");
  const selectedPartnerProfileId = formValue(formData, "partnerProfileId") || null;
  const groupLeaderProfileId = formValue(formData, "groupLeaderProfileId") || null;
  let managerProfileId = formValue(formData, "managerProfileId") || null;
  const movePendingLeaderCommissions = formValue(formData, "pendingLeaderCommissionMode") === "move";
  const returnTo = formValue(formData, "returnTo");

  const consultant = await prisma.consultantProfile.findUnique({
    where: { id: consultantProfileId },
    include: { user: true, groupLeaderProfile: true }
  });

  if (!consultant) {
    redirect(actor.role === "PARTNER" ? "/partner/consultants?error=consultant_not_found" : "/admin/consultants?error=consultant_not_found");
  }

  let authorizedPartnerProfileId = selectedPartnerProfileId || consultant.partnerProfileId;

  if (actor.role === "PARTNER") {
    const partnerProfile = await prisma.partnerProfile.findUnique({ where: { userId: actor.id } });
    if (!partnerProfile || partnerProfile.id !== consultant.partnerProfileId) {
      redirect("/partner/consultants?error=access_denied");
    }
    authorizedPartnerProfileId = partnerProfile.id;
  } else if (actor.role !== "COMPANY_ADMIN" && actor.role !== "SUPER_ADMIN") {
    redirect("/login?error=access_denied");
  }

  if (!authorizedPartnerProfileId || consultant.partnerProfileId !== authorizedPartnerProfileId) {
    redirect(actor.role === "PARTNER" ? "/partner/consultants?error=access_denied" : "/admin/consultants?error=access_denied");
  }

  if (groupLeaderProfileId) {
    const leader = await prisma.groupLeaderProfile.findFirst({
      where: {
        id: groupLeaderProfileId,
        partnerProfileId: authorizedPartnerProfileId
      },
      select: { id: true, managerProfileId: true }
    });

    if (!leader) {
      redirect(actor.role === "PARTNER" ? "/partner/consultants?error=invalid_group_leader" : `/admin/consultants?partnerId=${authorizedPartnerProfileId}&section=network&error=invalid_group_leader`);
    }

    managerProfileId = leader.managerProfileId;
  } else if (managerProfileId) {
    const manager = await prisma.managerProfile.findFirst({
      where: {
        id: managerProfileId,
        partnerProfileId: authorizedPartnerProfileId
      },
      select: { id: true }
    });

    if (!manager) {
      redirect(actor.role === "PARTNER" ? "/partner/consultants?error=invalid_manager" : `/admin/consultants?partnerId=${authorizedPartnerProfileId}&section=network&error=invalid_manager`);
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.consultantProfile.update({
      where: { id: consultant.id },
      data: { managerProfileId, groupLeaderProfileId }
    });

    if (movePendingLeaderCommissions && groupLeaderProfileId) {
      const pendingOrderIds = await tx.order.findMany({
        where: {
          consultantProfileId: consultant.id,
          commissionStatus: "PENDING",
          commissionSplits: {
            some: {
              participantRole: "GROUP_LEADER",
              status: "PENDING"
            }
          }
        },
        select: { id: true }
      });
      const orderIds = pendingOrderIds.map((order) => order.id);

      if (orderIds.length > 0) {
        await tx.order.updateMany({
          where: { id: { in: orderIds } },
          data: { managerProfileId, groupLeaderProfileId }
        });

        await tx.commissionSplit.updateMany({
          where: {
            orderId: { in: orderIds },
            participantRole: "GROUP_LEADER",
            status: "PENDING"
          },
          data: { groupLeaderProfileId }
        });
      }
    }

    await tx.customer.updateMany({
      where: { consultantProfileId: consultant.id },
      data: { managerProfileId, groupLeaderProfileId }
    });

    await tx.auditLog.create({
      data: {
        companyId: consultant.companyId,
        userId: actor.id,
        action: "CONSULTANT_LEADER_ASSIGNED",
        resource: "ConsultantProfile",
        resourceId: consultant.id,
        metadata: {
          partnerProfileId: authorizedPartnerProfileId,
          previousManagerProfileId: consultant.managerProfileId,
          managerProfileId,
          previousGroupLeaderProfileId: consultant.groupLeaderProfileId,
          groupLeaderProfileId,
          pendingLeaderCommissionMode: movePendingLeaderCommissions ? "move" : "keep_existing",
          consultantUserId: consultant.userId
        }
      }
    });
  });

  revalidatePath("/admin/consultants");
  revalidatePath("/partner/consultants");

  if (actor.role === "PARTNER") {
    redirect(returnTo.startsWith("/partner/consultants") ? returnTo : "/partner/consultants?updated=assignment_updated");
  }

  redirect(
    returnTo.startsWith("/admin/consultants")
      ? returnTo
      : `/admin/consultants?partnerId=${authorizedPartnerProfileId}&section=network&updated=assignment_updated`
  );
}

export async function promoteConsultantToLeader(formData: FormData) {
  const actor = await requireUser();
  const consultantProfileId = formValue(formData, "consultantProfileId");
  let commissionBps = DEFAULT_GROUP_LEADER_SHARE_BPS;
  let consultantOverrideBps = 0;
  const returnTo = formValue(formData, "returnTo");

  const consultant = await prisma.consultantProfile.findUnique({
    where: { id: consultantProfileId },
    include: { user: true, partnerProfile: true }
  });

  if (!consultant?.partnerProfileId) {
    redirect(actor.role === "PARTNER" ? "/partner/consultants?error=consultant_not_found" : "/admin/consultants?error=consultant_not_found");
  }

  let authorizedPartnerProfileId = consultant.partnerProfileId;

  if (actor.role === "PARTNER") {
    const partnerProfile = await prisma.partnerProfile.findUnique({ where: { userId: actor.id } });
    if (!partnerProfile || partnerProfile.id !== consultant.partnerProfileId) {
      redirect("/partner/consultants?error=access_denied");
    }
    authorizedPartnerProfileId = partnerProfile.id;
    commissionBps = leaderPoolBpsFromPercentInput(formValue(formData, "leaderCommissionPercent"));
    consultantOverrideBps = leaderPoolBpsFromPercentInput(formValue(formData, "consultantOverridePercent"), 0);
  } else if (actor.role !== "COMPANY_ADMIN" && actor.role !== "SUPER_ADMIN") {
    redirect("/login?error=access_denied");
  }

  const adminClient = createSupabaseAdminClient();
  const { error } = await adminClient.auth.admin.updateUserById(consultant.user.authUserId, {
    app_metadata: {
      role: "GROUP_LEADER",
      company_id: consultant.companyId,
      status: "ACTIVE"
    }
  });

  if (error) {
    redirectWithError(actor.role === "PARTNER" ? "/partner/consultants" : `/admin/consultants?partnerId=${authorizedPartnerProfileId}&section=network`, error.message || "leader_promotion_failed");
  }

  const displayName = [consultant.user.firstName, consultant.user.lastName].filter(Boolean).join(" ").trim() || consultant.user.email;

  await prisma.$transaction(async (tx) => {
    const leader = await tx.groupLeaderProfile.upsert({
      where: { userId: consultant.userId },
      update: {
        companyId: consultant.companyId,
        partnerProfileId: authorizedPartnerProfileId,
        managerProfileId: consultant.managerProfileId,
        displayName,
        commissionBps,
        consultantOverrideBps
      },
      create: {
        userId: consultant.userId,
        companyId: consultant.companyId,
        partnerProfileId: authorizedPartnerProfileId,
        managerProfileId: consultant.managerProfileId,
        displayName,
        commissionBps,
        consultantOverrideBps
      }
    });

    await tx.user.update({
      where: { id: consultant.userId },
      data: {
        role: "GROUP_LEADER",
        requestedRole: "GROUP_LEADER",
        requestedPartnerProfileId: authorizedPartnerProfileId,
        requestedManagerProfileId: consultant.managerProfileId,
        requestedGroupLeaderProfileId: leader.id
      }
    });

    await tx.auditLog.create({
      data: {
        companyId: consultant.companyId,
        userId: actor.id,
        action: "CONSULTANT_PROMOTED_TO_LEADER",
        resource: "User",
        resourceId: consultant.userId,
        metadata: {
          partnerProfileId: authorizedPartnerProfileId,
          managerProfileId: consultant.managerProfileId,
          consultantProfileId: consultant.id,
          groupLeaderProfileId: leader.id,
          commissionBps,
          consultantOverrideBps
        }
      }
    });
  });

  revalidatePath("/admin/consultants");
  revalidatePath("/partner/consultants");

  if (actor.role === "PARTNER") {
    redirect(returnTo.startsWith("/partner/consultants") ? returnTo : "/partner/consultants?updated=consultant_promoted");
  }

  redirect(returnTo.startsWith("/admin/consultants") ? returnTo : `/admin/consultants?partnerId=${authorizedPartnerProfileId}&section=leaders&updated=consultant_promoted`);
}

export async function convertLeaderToConsultant(formData: FormData) {
  const actor = await requireUser();
  const groupLeaderProfileId = formValue(formData, "groupLeaderProfileId");
  let commissionBps = DEFAULT_CONSULTANT_SHARE_BPS;
  const returnTo = formValue(formData, "returnTo");

  const leader = await prisma.groupLeaderProfile.findUnique({
    where: { id: groupLeaderProfileId },
    include: { user: true, consultants: { select: { id: true } } }
  });

  if (!leader) {
    redirect(actor.role === "PARTNER" ? "/partner/consultants?error=leader_not_found" : "/admin/consultants?error=leader_not_found");
  }

  let authorizedPartnerProfileId = leader.partnerProfileId;

  if (actor.role === "PARTNER") {
    const partnerProfile = await prisma.partnerProfile.findUnique({ where: { userId: actor.id } });
    if (!partnerProfile || partnerProfile.id !== leader.partnerProfileId) {
      redirect("/partner/consultants?error=access_denied");
    }
    authorizedPartnerProfileId = partnerProfile.id;
    commissionBps = bpsFromPercentInput(formValue(formData, "consultantCommissionPercent"), DEFAULT_CONSULTANT_SHARE_BPS);
  } else if (actor.role !== "COMPANY_ADMIN" && actor.role !== "SUPER_ADMIN") {
    redirect("/login?error=access_denied");
  }

  const adminClient = createSupabaseAdminClient();
  const { error } = await adminClient.auth.admin.updateUserById(leader.user.authUserId, {
    app_metadata: {
      role: "CONSULTANT",
      company_id: leader.companyId,
      status: "ACTIVE"
    }
  });

  if (error) {
    redirectWithError(actor.role === "PARTNER" ? "/partner/consultants" : `/admin/consultants?partnerId=${authorizedPartnerProfileId}&section=leaders`, error.message || "leader_conversion_failed");
  }

  let referralSlug = createReferralSlug(leader.user.firstName ?? leader.displayName, leader.user.lastName ?? "");
  let referralCode = createReferralCode(leader.user.firstName ?? leader.displayName, leader.user.lastName ?? "");

  const existingSlug = await prisma.consultantProfile.findUnique({ where: { referralSlug } });
  if (existingSlug && existingSlug.userId !== leader.userId) {
    referralSlug = `${referralSlug}-${leader.userId.slice(0, 4)}`;
  }

  const existingCode = await prisma.consultantProfile.findUnique({ where: { referralCode } });
  if (existingCode && existingCode.userId !== leader.userId) {
    referralCode = `${referralCode}${leader.userId.slice(0, 2).toUpperCase()}`;
  }

  await prisma.$transaction(async (tx) => {
    const consultant = await tx.consultantProfile.upsert({
      where: { userId: leader.userId },
      update: {
        companyId: leader.companyId,
        partnerProfileId: authorizedPartnerProfileId,
        managerProfileId: leader.managerProfileId,
        groupLeaderProfileId: null,
        commissionBps
      },
      create: {
        userId: leader.userId,
        companyId: leader.companyId,
        partnerProfileId: authorizedPartnerProfileId,
        managerProfileId: leader.managerProfileId,
        groupLeaderProfileId: null,
        commissionBps,
        referralSlug,
        referralCode,
        onboardingDone: false
      }
    });

    await tx.user.update({
      where: { id: leader.userId },
      data: {
        role: "CONSULTANT",
        requestedRole: "CONSULTANT",
        requestedPartnerProfileId: authorizedPartnerProfileId,
        requestedManagerProfileId: leader.managerProfileId,
        requestedGroupLeaderProfileId: null
      }
    });

    await tx.consultantProfile.updateMany({
      where: {
        partnerProfileId: authorizedPartnerProfileId,
        groupLeaderProfileId: leader.id,
        user: { is: { role: "CONSULTANT" } }
      },
      data: { groupLeaderProfileId: null }
    });

    await tx.customer.updateMany({
      where: { groupLeaderProfileId: leader.id },
      data: { groupLeaderProfileId: null }
    });

    await tx.auditLog.create({
      data: {
        companyId: leader.companyId,
        userId: actor.id,
        action: "LEADER_CONVERTED_TO_CONSULTANT",
        resource: "User",
        resourceId: leader.userId,
        metadata: {
          partnerProfileId: authorizedPartnerProfileId,
          groupLeaderProfileId: leader.id,
          consultantProfileId: consultant.id,
          movedConsultantsToDirectPartner: leader.consultants.length,
          commissionBps
        }
      }
    });
  });

  revalidatePath("/admin/consultants");
  revalidatePath("/partner/consultants");

  if (actor.role === "PARTNER") {
    redirect(returnTo.startsWith("/partner/consultants") ? returnTo : "/partner/consultants?updated=leader_converted");
  }

  redirect(returnTo.startsWith("/admin/consultants") ? returnTo : `/admin/consultants?partnerId=${authorizedPartnerProfileId}&section=network&updated=leader_converted`);
}
