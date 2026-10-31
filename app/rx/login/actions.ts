"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCustomerSession, requireCustomerPortalEnabled } from "@/lib/customers/customer-session";
import { requireRxCompany, rxBasePath } from "@/lib/products/rx-catalog";

export type CustomerLoginState = { error?: string };
export async function signInCustomer(_previous: CustomerLoginState, form: FormData): Promise<CustomerLoginState> {
  requireCustomerPortalEnabled();
  await requireRxCompany();
  const input = z.object({ email: z.string().trim().toLowerCase().email().max(254), password: z.string().min(1).max(256) })
    .safeParse({ email: form.get("email"), password: form.get("password") });
  if (!input.success) return { error: "Enter your email and password." };
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword(input.data);
  const message = "Unable to sign in. Check your credentials and customer account access.";
  if (error) return { error: message };
  if (!await getCustomerSession()) {
    await supabase.auth.signOut({ scope: "local" });
    return { error: message };
  }
  redirect(`${await rxBasePath()}/account`);
}
export async function signOutCustomer() {
  requireCustomerPortalEnabled();
  await requireRxCompany();
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut({ scope: "local" });
  redirect(`${await rxBasePath()}/login`);
}
