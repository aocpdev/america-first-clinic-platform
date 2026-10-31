"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { requireAffiliateAdmin } from "@/lib/referrals/affiliate-admin";
import { affiliateSchema, percentageToBps } from "@/lib/referrals/affiliate-admin-policy";
import { persistAffiliate, persistAffiliateDefault, persistAffiliateLogin } from "@/lib/referrals/affiliate-admin-service";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { z } from "zod";

export type AffiliateActionState = { error?: string; success?: string };

function friendlyError(error: unknown): AffiliateActionState {
  if (error instanceof Error && error.message === "LINKED_EMAIL_LOCKED") {
    return { error: "The email is connected to a verified login and cannot be changed here." };
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    return { error: "An affiliate with this email already exists." };
  }
  if (error instanceof Error && error.message === "STALE_RECORD") {
    return { error: "This record changed. Refresh the page before saving again." };
  }
  if (error instanceof Error && /percentage|Percentage/.test(error.message)) return { error: error.message };
  return { error: "Unable to save. Check the fields and try again." };
}

export async function connectAffiliateLogin(_previous: AffiliateActionState, form: FormData): Promise<AffiliateActionState> {
  const actor = await requireAffiliateAdmin();
  try {
    const { id, revision } = z.object({ id: z.string().uuid(),
      revision: z.number().int().positive() }).parse({ id: form.get("id"), revision: Number(form.get("revision")) });
    const profile = await prisma.affiliateProfile.findFirst({ where: { id, companyId: actor.companyId, status: "APPROVED", authUserId: null, revision } });
    if (!profile) return { error: "Approve an unconnected affiliate and refresh before connecting a login." };
    const existingUser = await prisma.user.findFirst({ where: { email: profile.email, companyId: actor.companyId,
      isActive: true, status: "ACTIVE" }, select: { authUserId: true } });
    if (!existingUser) return { error: "No active account exists for this email. New-account invitations are not available yet." };
    const authUserId = existingUser.authUserId;
    const { data, error } = await createSupabaseAdminClient().auth.admin.getUserById(authUserId);
    if (error || !data.user?.email_confirmed_at || data.user.email?.trim().toLowerCase() !== profile.email) {
      return { error: "The login must have the same verified email as this affiliate." };
    }
    await persistAffiliateLogin(prisma, actor, id, revision, data.user);
  } catch { return { error: "Unable to connect this login. Refresh and check that it is not already connected." }; }
  revalidatePath("/admin/affiliates");
  return { success: "Verified login connected. No internal CRM role was granted." };
}

export async function saveAffiliate(_previous: AffiliateActionState, form: FormData): Promise<AffiliateActionState> {
  const actor = await requireAffiliateAdmin();
  try {
    const parsed = affiliateSchema.parse({
      displayName: form.get("displayName"), email: form.get("email"),
      category: form.get("category"), status: form.get("status"),
      commissionBps: percentageToBps(form.get("commissionPercent"), true)
    });
    const id = String(form.get("id") ?? "");
    const revision = Number(form.get("revision"));
    await persistAffiliate(prisma, actor, parsed, id, revision);
  } catch (error) { return friendlyError(error); }
  revalidatePath("/admin/affiliates");
  return { success: "Affiliate saved. No login invitation or payout was sent." };
}

export async function saveAffiliateDefault(_previous: AffiliateActionState, form: FormData): Promise<AffiliateActionState> {
  const actor = await requireAffiliateAdmin();
  try {
    const commissionBps = percentageToBps(form.get("commissionPercent"))!;
    const revision = Number(form.get("revision"));
    await persistAffiliateDefault(prisma, actor, commissionBps, revision);
  } catch (error) { return friendlyError(error); }
  revalidatePath("/admin/affiliates");
  return { success: "Default saved for future purchases. Agent rates remain unchanged." };
}
