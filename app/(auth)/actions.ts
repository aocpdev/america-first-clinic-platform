"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { UserRole, UserStatus } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { createReferralCode, createReferralSlug } from "@/lib/auth/slug";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";
import { roleSchema } from "@/lib/validations/core";
import { requireRole } from "@/lib/auth/current-user";
import { dashboardPathForRole } from "@/lib/auth/redirects";

function formValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
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
  const requestedRole = roleSchema.extract(["CUSTOMER", "CONSULTANT"]).catch("CUSTOMER").parse(formValue(formData, "requestedRole"));

  if (!firstName || !lastName || !email || password.length < 8) {
    redirect("/register?error=invalid_registration");
  }

  const company = await getAmericaFirstClinic();
  const status = requestedRole === "CONSULTANT" ? UserStatus.PENDING_APPROVAL : UserStatus.ACTIVE;
  const role = requestedRole === "CONSULTANT" ? UserRole.CONSULTANT : UserRole.CUSTOMER;
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
      role,
      status,
      firstName,
      lastName,
      isActive: status === UserStatus.ACTIVE
    },
    create: {
      authUserId: data.user.id,
      companyId: company.id,
      requestedRole,
      role,
      status,
      email,
      firstName,
      lastName,
      isActive: status === UserStatus.ACTIVE
    }
  });

  if (requestedRole === "CUSTOMER") {
    await prisma.customer.upsert({
      where: { companyId_email: { companyId: company.id, email } },
      update: { userId: user.id, firstName, lastName },
      create: { companyId: company.id, userId: user.id, email, firstName, lastName }
    });
  }

  if (requestedRole === "CONSULTANT") {
    redirect("/pending-approval");
  }

  redirect("/onboarding");
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
  const admin = await requireRole("COMPANY_ADMIN");
  const userId = formValue(formData, "userId");
  const partnerProfileId = formValue(formData, "partnerProfileId") || null;
  const user = await prisma.user.findUnique({ where: { id: userId } });

  if (!user || user.requestedRole !== "CONSULTANT") {
    redirect("/admin/consultants?error=consultant_not_found");
  }

  const company = await getAmericaFirstClinic();
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
        approvedByUserId: admin.id,
        rejectedAt: null,
        rejectionReason: null
      }
    });

    await tx.consultantProfile.upsert({
      where: { userId: user.id },
      update: { companyId: company.id, partnerProfileId },
      create: {
        userId: user.id,
        companyId: company.id,
        partnerProfileId,
        referralSlug,
        referralCode,
        onboardingDone: false
      }
    });

    await tx.auditLog.create({
      data: {
        companyId: company.id,
        userId: admin.id,
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
}

export async function rejectConsultant(formData: FormData) {
  const admin = await requireRole("COMPANY_ADMIN");
  const userId = formValue(formData, "userId");
  const reason = formValue(formData, "reason") || "Application rejected by admin.";

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
      companyId: admin.companyId,
      userId: admin.id,
      action: "CONSULTANT_REJECTED",
      resource: "User",
      resourceId: userId,
      metadata: { reason }
    }
  });

  revalidatePath("/admin/consultants");
}
