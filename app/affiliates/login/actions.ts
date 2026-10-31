"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAffiliateSession, requireAffiliatePortalEnabled } from "@/lib/referrals/affiliate-session";

export type AffiliateLoginState = { error?: string };

export async function signInAffiliate(_previous: AffiliateLoginState, form: FormData): Promise<AffiliateLoginState> {
  requireAffiliatePortalEnabled();
  const parsed = z.object({ email: z.string().trim().toLowerCase().email().max(254),
    password: z.string().min(1).max(256) }).safeParse({ email: form.get("email"), password: form.get("password") });
  if (!parsed.success) return { error: "Enter your email and password." };
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { error: "Unable to sign in. Check your credentials and approved affiliate access." };
  if (!await getAffiliateSession()) {
    await supabase.auth.signOut({ scope: "local" });
    return { error: "Unable to sign in. Check your credentials and approved affiliate access." };
  }
  redirect("/affiliates");
}

export async function signOutAffiliate() {
  requireAffiliatePortalEnabled();
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut({ scope: "local" });
  redirect("/affiliates/login");
}
