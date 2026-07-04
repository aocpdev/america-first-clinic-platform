"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { requireUser } from "@/lib/auth/current-user";
import { profilePathForRole } from "@/lib/auth/profile-path";
import { normalizePhoneToE164 } from "@/lib/phone";
import { encryptField, last4 } from "@/lib/security/field-encryption";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { updateConfirmedAuthUser } from "@/lib/supabase/admin-auth";

function textValue(formData: FormData, key: string) {
  return String(formData.get(key) || "").trim();
}

async function revalidateUserProfilePaths(role: Parameters<typeof profilePathForRole>[0]) {
  revalidatePath(profilePathForRole(role));
  revalidatePath("/admin/dashboard");
  revalidatePath("/partner/dashboard");
  revalidatePath("/consultant/dashboard");
}

export async function updateProfile(formData: FormData) {
  const user = await requireUser();
  const firstName = textValue(formData, "firstName");
  const lastName = textValue(formData, "lastName");
  const emailResult = z.string().trim().email().safeParse(textValue(formData, "email"));
  const phone = normalizePhoneToE164(textValue(formData, "phone"));
  const nextEmail = emailResult.success ? emailResult.data.toLowerCase() : null;
  const profilePath = profilePathForRole(user.role);

  if (!nextEmail) {
    redirect(`${profilePath}?error=invalid_email`);
  }

  if (nextEmail !== user.email.toLowerCase()) {
    const existingUser = await prisma.user.findFirst({
      where: {
        email: nextEmail,
        NOT: { id: user.id }
      },
      select: { id: true }
    });

    if (existingUser) {
      redirect(`${profilePath}?error=email_taken`);
    }

    try {
      await updateConfirmedAuthUser(user.authUserId, {
        email: nextEmail,
        user_metadata: {
          first_name: firstName || null,
          last_name: lastName || null,
          phone
        }
      });
    } catch {
      redirect(`${profilePath}?error=email_update_failed`);
    }
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      email: nextEmail,
      firstName: firstName || null,
      lastName: lastName || null,
      phone
    }
  });

  await revalidateUserProfilePaths(user.role);
  redirect(`${profilePath}?updated=profile`);
}

export async function changePassword(formData: FormData) {
  const user = await requireUser();
  const profilePath = profilePathForRole(user.role);
  const password = textValue(formData, "password");
  const confirmPassword = textValue(formData, "confirmPassword");

  if (password.length < 8) {
    redirect(`${profilePath}?error=password_too_short`);
  }

  if (password !== confirmPassword) {
    redirect(`${profilePath}?error=password_mismatch`);
  }

  try {
    await updateConfirmedAuthUser(user.authUserId, {
      password
    });
  } catch {
    redirect(`${profilePath}?error=password_update_failed`);
  }

  await revalidateUserProfilePaths(user.role);
  redirect(`${profilePath}?updated=password`);
}

export async function uploadAvatar(formData: FormData) {
  const user = await requireUser();
  const image = formData.get("avatar");

  if (!(image instanceof File) || image.size === 0) {
    redirect(`${profilePathForRole(user.role)}?error=missing_avatar`);
  }

  if (!image.type.startsWith("image/")) {
    redirect(`${profilePathForRole(user.role)}?error=invalid_avatar`);
  }

  if (image.size > 3 * 1024 * 1024) {
    redirect(`${profilePathForRole(user.role)}?error=avatar_too_large`);
  }

  const supabase = createSupabaseAdminClient();
  const bucket = "user-avatars";
  const { data: buckets } = await supabase.storage.listBuckets();

  if (!buckets?.some((item) => item.name === bucket)) {
    await supabase.storage.createBucket(bucket, {
      public: true,
      fileSizeLimit: 3 * 1024 * 1024,
      allowedMimeTypes: ["image/jpeg", "image/png", "image/webp", "image/gif"]
    });
  }

  const extension = image.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${user.companyId ?? "platform"}/${user.id}/avatar.${extension}`;
  const bytes = await image.arrayBuffer();
  const { error } = await supabase.storage.from(bucket).upload(path, bytes, {
    contentType: image.type,
    upsert: true
  });

  if (error) {
    throw new Error(error.message);
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  const avatarUrl = `${data.publicUrl}?v=${Date.now()}`;

  await prisma.user.update({
    where: { id: user.id },
    data: { avatarUrl }
  });

  await revalidateUserProfilePaths(user.role);
  redirect(`${profilePathForRole(user.role)}?updated=avatar`);
}

export async function updatePartnerCompany(formData: FormData) {
  const user = await requireUser();
  if (user.role !== "PARTNER" && user.role !== "COMPANY_ADMIN" && user.role !== "SUPER_ADMIN") {
    redirect("/login?error=access_denied");
  }

  const companyName = textValue(formData, "companyName");
  if (!companyName) {
    redirect(`${profilePathForRole(user.role)}?error=missing_company_name`);
  }

  await prisma.partnerProfile.update({
    where: { userId: user.id },
    data: { companyName }
  });

  revalidatePath("/register");
  revalidatePath("/partner/profile");
  revalidatePath("/partner/consultants");
  revalidatePath("/admin/consultants");
  redirect(`${profilePathForRole(user.role)}?updated=company`);
}

const partnerBankSchema = z.object({
  accountHolderName: z.string().trim().min(2),
  accountHolderType: z.enum(["individual", "company"]).default("company"),
  bankName: z.string().trim().optional(),
  routingNumber: z.string().trim().regex(/^\d{9}$/),
  accountNumber: z.string().trim().regex(/^\d{4,17}$/),
  confirmAccountNumber: z.string().trim().regex(/^\d{4,17}$/)
}).refine((value) => value.accountNumber === value.confirmAccountNumber, {
  path: ["confirmAccountNumber"],
  message: "Account numbers must match."
});

export async function updatePartnerBankAccount(formData: FormData) {
  const user = await requireUser();
  if (user.role !== "PARTNER") {
    redirect("/login?error=access_denied");
  }

  const profilePath = profilePathForRole(user.role);
  const parsed = partnerBankSchema.safeParse({
    accountHolderName: textValue(formData, "accountHolderName"),
    accountHolderType: textValue(formData, "accountHolderType") || "company",
    bankName: textValue(formData, "bankName"),
    routingNumber: textValue(formData, "routingNumber").replace(/\D/g, ""),
    accountNumber: textValue(formData, "accountNumber").replace(/\D/g, ""),
    confirmAccountNumber: textValue(formData, "confirmAccountNumber").replace(/\D/g, "")
  });

  if (!parsed.success) {
    redirect(`${profilePath}?error=invalid_bank_account`);
  }

  if (!user.companyId || !user.partnerProfile?.id) {
    redirect(`${profilePath}?error=partner_profile_required`);
  }

  let routingNumberEncrypted = "";
  let accountNumberEncrypted = "";
  try {
    routingNumberEncrypted = encryptField(parsed.data.routingNumber);
    accountNumberEncrypted = encryptField(parsed.data.accountNumber);
  } catch {
    redirect(`${profilePath}?error=bank_encryption_missing`);
  }

  await prisma.partnerBankAccount.upsert({
    where: { partnerProfileId: user.partnerProfile.id },
    create: {
      companyId: user.companyId,
      partnerProfileId: user.partnerProfile.id,
      accountHolderName: parsed.data.accountHolderName,
      accountHolderType: parsed.data.accountHolderType,
      bankName: parsed.data.bankName || null,
      routingNumberEncrypted,
      accountNumberEncrypted,
      routingLast4: last4(parsed.data.routingNumber),
      accountLast4: last4(parsed.data.accountNumber),
      status: "READY",
      verifiedAt: new Date(),
      lastValidatedAt: new Date(),
      createdByUserId: user.id,
      updatedByUserId: user.id
    },
    update: {
      accountHolderName: parsed.data.accountHolderName,
      accountHolderType: parsed.data.accountHolderType,
      bankName: parsed.data.bankName || null,
      routingNumberEncrypted,
      accountNumberEncrypted,
      routingLast4: last4(parsed.data.routingNumber),
      accountLast4: last4(parsed.data.accountNumber),
      status: "READY",
      verifiedAt: new Date(),
      lastValidatedAt: new Date(),
      updatedByUserId: user.id
    }
  });

  revalidatePath("/partner/profile");
  revalidatePath("/admin/payouts");
  redirect(`${profilePath}?updated=bank`);
}
