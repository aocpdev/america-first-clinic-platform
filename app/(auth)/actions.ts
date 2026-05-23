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
  const requestedRole = roleSchema.extract(["CONSULTANT"]).catch("CONSULTANT").parse("CONSULTANT");
  const requestedPartnerProfileId = formValue(formData, "requestedPartnerProfileId");
  const requestedGroupLeaderProfileId = formValue(formData, "requestedGroupLeaderProfileId") || null;

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
    select: { id: true }
  });

  if (!selectedPartner) {
    redirect("/register?error=invalid_partner");
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
  const role = UserRole.CONSULTANT;
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
  let consultantCommissionBps = bpsFromPercentInput(formValue(formData, "consultantCommissionPercent"), 5000);
  const user = await prisma.user.findUnique({ where: { id: userId } });

  if (!user || user.requestedRole !== "CONSULTANT") {
    redirect("/admin/consultants?error=consultant_not_found");
  }

  const company = await getAmericaFirstClinic();
  let partnerProfileId = requestedFormPartnerProfileId || user.requestedPartnerProfileId;
  let groupLeaderProfileId = requestedGroupLeaderProfileId || user.requestedGroupLeaderProfileId;

  if (approver.role === "PARTNER") {
    const partnerProfile = await prisma.partnerProfile.findUnique({ where: { userId: approver.id } });
    if (!partnerProfile || user.requestedPartnerProfileId !== partnerProfile.id) {
      redirect("/partner/consultants?error=access_denied");
    }
    partnerProfileId = partnerProfile.id;
  } else if (approver.role === "GROUP_LEADER") {
    const groupLeaderProfile = await prisma.groupLeaderProfile.findUnique({ where: { userId: approver.id } });
    if (!groupLeaderProfile || user.requestedPartnerProfileId !== groupLeaderProfile.partnerProfileId) {
      redirect("/partner/consultants?error=access_denied");
    }
    partnerProfileId = groupLeaderProfile.partnerProfileId;
    groupLeaderProfileId = groupLeaderProfile.id;
    consultantCommissionBps = 5000;
  } else if (approver.role !== "COMPANY_ADMIN" && approver.role !== "SUPER_ADMIN") {
    redirect("/login?error=access_denied");
  }

  if (groupLeaderProfileId) {
    const groupLeader = await prisma.groupLeaderProfile.findFirst({
      where: { id: groupLeaderProfileId, partnerProfileId: partnerProfileId ?? undefined },
      select: { id: true }
    });

    if (!groupLeader) {
      redirect("/admin/consultants?error=invalid_group_leader");
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
        rejectionReason: null
      }
    });

    await tx.consultantProfile.upsert({
      where: { userId: user.id },
      update: { companyId: company.id, partnerProfileId, groupLeaderProfileId, commissionBps: consultantCommissionBps },
      create: {
        userId: user.id,
        companyId: company.id,
        partnerProfileId,
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

  if (!user || user.requestedRole !== "CONSULTANT") {
    redirect("/admin/consultants?error=consultant_not_found");
  }

  if (approver.role === "PARTNER") {
    const partnerProfile = await prisma.partnerProfile.findUnique({ where: { userId: approver.id } });
    if (!partnerProfile || user.requestedPartnerProfileId !== partnerProfile.id) {
      redirect("/partner/consultants?error=access_denied");
    }
  } else if (approver.role === "GROUP_LEADER") {
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
  const commissionBps = bpsFromPercentInput(formValue(formData, "commissionPercent"), 2500);
  const consultantOverrideBps = bpsFromPercentInput(formValue(formData, "consultantOverridePercent"), 0);

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
      update: { companyId: company.id, partnerProfileId: partnerProfile.id, displayName, commissionBps, consultantOverrideBps },
      create: {
        userId: leaderUser.id,
        companyId: company.id,
        partnerProfileId: partnerProfile.id,
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
        metadata: { partnerProfileId: partnerProfile.id, commissionBps, consultantOverrideBps }
      }
    });
  });

  revalidatePath("/admin/consultants");
  revalidatePath("/partner/consultants");
  redirect(actor.role === "PARTNER" ? "/partner/consultants?updated=group_leader_created" : `/admin/consultants?partnerId=${partnerProfile.id}&section=leaders&updated=group_leader_created`);
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
  const commissionBps = bpsFromPercentInput(formValue(formData, "consultantCommissionPercent"), 5000);
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
      select: { id: true }
    });

    if (!groupLeader) {
      redirect(actor.role === "PARTNER" ? "/partner/consultants?error=invalid_group_leader" : `/admin/consultants?partnerId=${partnerProfile.id}&error=invalid_group_leader`);
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
        groupLeaderProfileId: selectedGroupLeaderProfileId,
        commissionBps
      },
      create: {
        userId: consultantUser.id,
        companyId: company.id,
        partnerProfileId: partnerProfile.id,
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

export async function updateGroupLeaderProfile(formData: FormData) {
  const actor = await requireUser();
  const groupLeaderProfileId = formValue(formData, "groupLeaderProfileId");
  const commissionBps = bpsFromPercentInput(formValue(formData, "commissionPercent"), 2500);
  const consultantOverrideBps = bpsFromPercentInput(formValue(formData, "consultantOverridePercent"), 0);

  const leader = await prisma.groupLeaderProfile.findUnique({
    where: { id: groupLeaderProfileId },
    include: { partnerProfile: true }
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

  await prisma.groupLeaderProfile.update({
    where: { id: leader.id },
    data: { commissionBps, consultantOverrideBps }
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
  const commissionBps = bpsFromPercentInput(formValue(formData, "consultantCommissionPercent"), 5000);
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
      select: { id: true }
    });

    if (!leader) {
      redirect("/admin/consultants?error=invalid_group_leader");
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
        groupLeaderProfileId,
        commissionBps
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
  const returnTo = formValue(formData, "returnTo");

  const consultant = await prisma.consultantProfile.findUnique({
    where: { id: consultantProfileId },
    include: { user: true }
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
      select: { id: true }
    });

    if (!leader) {
      redirect(actor.role === "PARTNER" ? "/partner/consultants?error=invalid_group_leader" : `/admin/consultants?partnerId=${authorizedPartnerProfileId}&section=network&error=invalid_group_leader`);
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.consultantProfile.update({
      where: { id: consultant.id },
      data: { groupLeaderProfileId }
    });

    await tx.customer.updateMany({
      where: { consultantProfileId: consultant.id },
      data: { groupLeaderProfileId }
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
          groupLeaderProfileId,
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
