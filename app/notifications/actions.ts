"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { UserRole, UserStatus, type Prisma } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db/prisma";

type NotificationMetadata = Record<string, unknown>;

export async function markNotificationsRead() {
  const user = await getCurrentUser();
  if (!user) return;

  await prisma.notification.updateMany({
    where: { userId: user.id, readAt: null },
    data: { readAt: new Date() }
  });

  revalidatePath("/admin/dashboard");
  revalidatePath("/partner/dashboard");
  revalidatePath("/consultant/dashboard");
  revalidatePath("/admin/orders");
  revalidatePath("/partner/orders");
  revalidatePath("/consultant/orders");
}

export async function openNotification(formData: FormData) {
  const notificationId = String(formData.get("notificationId") ?? "");
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  if (!notificationId) {
    redirect(fallbackPathForRole(user.role));
  }

  const notification = await prisma.notification.findFirst({
    where: { id: notificationId, userId: user.id },
    select: { id: true, metadata: true, readAt: true }
  });

  if (!notification) {
    redirect(fallbackPathForRole(user.role));
  }

  const destination = notificationPathForRole(user.role, notification.metadata);
  const resolved = await isResolvedNotification(notification.metadata);

  if (resolved) {
    await prisma.notification.delete({ where: { id: notification.id } });
  } else if (!notification.readAt) {
    await prisma.notification.update({
      where: { id: notification.id },
      data: { readAt: new Date() }
    });
  }

  revalidateNotificationSurfaces();
  redirect(destination);
}

function notificationPathForRole(role: UserRole, metadata: Prisma.JsonValue | null) {
  const meta = metadataRecord(metadata);
  const type = stringValue(meta.type);
  const partnerProfileId = stringValue(meta.partnerProfileId);

  if (type === "registration") {
    if (role === UserRole.PARTNER) return "/partner/consultants?section=approval";
    if (role === UserRole.SUPER_ADMIN || role === UserRole.COMPANY_ADMIN) {
      const params = new URLSearchParams({ section: "approval" });
      if (partnerProfileId) params.set("partnerId", partnerProfileId);
      return `/admin/consultants?${params.toString()}`;
    }
  }

  if (type === "approval") {
    if (role === UserRole.PARTNER) return "/partner/consultants?section=seller-network";
    if (role === UserRole.GROUP_LEADER) return "/partner/dashboard";
    if (role === UserRole.MANAGER) return "/manager/dashboard";
    if (role === UserRole.CONSULTANT) return "/consultant/dashboard";
    return partnerProfileId
      ? `/admin/consultants?partnerId=${partnerProfileId}&section=seller-network`
      : "/admin/consultants";
  }

  if (type === "reward_redeem") {
    if (role === UserRole.SUPER_ADMIN || role === UserRole.COMPANY_ADMIN) return "/admin/rewards";
    return fallbackPathForRole(role);
  }

  if (type?.includes("order") || type?.includes("payment") || type?.includes("commission") || type?.includes("subscription")) {
    if (role === UserRole.PARTNER) return "/partner/orders";
    if (role === UserRole.CONSULTANT) return "/consultant/orders";
    if (role === UserRole.GROUP_LEADER) return "/partner/orders";
    if (role === UserRole.MANAGER) return "/manager/dashboard";
    return "/admin/orders";
  }

  return fallbackPathForRole(role);
}

async function isResolvedNotification(metadata: Prisma.JsonValue | null) {
  const meta = metadataRecord(metadata);

  if (meta.type === "reward_redeem") {
    const claimId = stringValue(meta.claimId);
    if (!claimId) return true;

    const claim = await prisma.rewardCampaignClaim.findUnique({
      where: { id: claimId },
      select: { status: true }
    });

    return !claim || claim.status === "FULFILLED";
  }

  if (meta.type !== "registration") return false;

  const userId = stringValue(meta.userId);
  if (!userId) return true;

  const applicant = await prisma.user.findUnique({
    where: { id: userId },
    select: { status: true }
  });

  return !applicant || applicant.status !== UserStatus.PENDING_APPROVAL;
}

function fallbackPathForRole(role: UserRole) {
  if (role === UserRole.PARTNER) return "/partner/dashboard";
  if (role === UserRole.CONSULTANT) return "/consultant/dashboard";
  if (role === UserRole.GROUP_LEADER) return "/partner/dashboard";
  if (role === UserRole.MANAGER) return "/manager/dashboard";
  return "/admin/dashboard";
}

function metadataRecord(metadata: Prisma.JsonValue | null): NotificationMetadata {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return {};
  return metadata as NotificationMetadata;
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.length ? value : null;
}

function revalidateNotificationSurfaces() {
  revalidatePath("/admin/dashboard");
  revalidatePath("/admin/consultants");
  revalidatePath("/admin/orders");
  revalidatePath("/partner/dashboard");
  revalidatePath("/partner/consultants");
  revalidatePath("/partner/orders");
  revalidatePath("/manager/dashboard");
  revalidatePath("/consultant/dashboard");
  revalidatePath("/consultant/orders");
}
