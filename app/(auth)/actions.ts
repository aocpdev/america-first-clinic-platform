"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { UserRole, UserStatus } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { createReferralCode, createReferralSlug } from "@/lib/auth/slug";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";
import { roleSchema } from "@/lib/validations/core";
import { requireRole, requireUser } from "@/lib/auth/current-user";
import { dashboardPathForRole } from "@/lib/auth/redirects";

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
  const requestedRole = roleSchema.extract(["CONSULTANT"]).catch("CONSULTANT").parse("CONSULTANT");
  const requestedPartnerProfileId = formValue(formData, "requestedPartnerProfileId");

  if (!firstName || !lastName || !email || password.length < 8 || !requestedPartnerProfileId) {
    redirect("/register?error=invalid_registration");
  }

  const company = await getAmericaFirstClinic();
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
      role,
      status,
      firstName,
      lastName,
      isActive: false
    },
    create: {
      authUserId: data.user.id,
      companyId: company.id,
      requestedRole,
      requestedPartnerProfileId: selectedPartner.id,
      role,
      status,
      email,
      firstName,
      lastName,
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
  await supabase.auth.signOut();
  redirect("/login");
}

export async function approveConsultant(formData: FormData) {
  const approver = await requireUser();
  const userId = formValue(formData, "userId");
  const requestedFormPartnerProfileId = formValue(formData, "partnerProfileId") || null;
  const requestedGroupLeaderProfileId = formValue(formData, "groupLeaderProfileId") || null;
  const consultantCommissionBps = bpsFromPercentInput(formValue(formData, "consultantCommissionPercent"), 1250);
  const user = await prisma.user.findUnique({ where: { id: userId } });

  if (!user || user.requestedRole !== "CONSULTANT") {
    redirect("/admin/consultants?error=consultant_not_found");
  }

  const company = await getAmericaFirstClinic();
  let partnerProfileId = requestedFormPartnerProfileId || user.requestedPartnerProfileId;
  let groupLeaderProfileId = requestedGroupLeaderProfileId;

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
  const companyName = formValue(formData, "companyName");
  const commissionBps = bpsFromPercentInput(formValue(formData, "commissionPercent"), 1250);

  if (!firstName || !lastName || !email || password.length < 8 || !companyName) {
    redirect("/admin/consultants?error=invalid_partner");
  }

  const company = await getAmericaFirstClinic();
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
  const selectedPartnerProfileId = formValue(formData, "partnerProfileId");
  const commissionBps = bpsFromPercentInput(formValue(formData, "commissionPercent"), 625);

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
        isActive: true
      }
    });

    await tx.groupLeaderProfile.upsert({
      where: { userId: leaderUser.id },
      update: { companyId: company.id, partnerProfileId: partnerProfile.id, displayName, commissionBps },
      create: {
        userId: leaderUser.id,
        companyId: company.id,
        partnerProfileId: partnerProfile.id,
        displayName,
        commissionBps
      }
    });

    await tx.auditLog.create({
      data: {
        companyId: company.id,
        userId: actor.id,
        action: "GROUP_LEADER_CREATED",
        resource: "User",
        resourceId: leaderUser.id,
        metadata: { partnerProfileId: partnerProfile.id, commissionBps }
      }
    });
  });

  revalidatePath("/admin/consultants");
  revalidatePath("/partner/consultants");
  redirect(actor.role === "PARTNER" ? "/partner/consultants?updated=group_leader_created" : "/admin/consultants?updated=group_leader_created");
}
