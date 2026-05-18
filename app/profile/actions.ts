"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { requireUser } from "@/lib/auth/current-user";
import { profilePathForRole } from "@/lib/auth/profile-path";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

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
  const phone = textValue(formData, "phone");

  await prisma.user.update({
    where: { id: user.id },
    data: {
      firstName: firstName || null,
      lastName: lastName || null,
      phone: phone || null
    }
  });

  await revalidateUserProfilePaths(user.role);
  redirect(`${profilePathForRole(user.role)}?updated=profile`);
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
