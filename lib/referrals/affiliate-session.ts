import { notFound, redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/db/prisma";
import { canAccessAffiliatePortal } from "./affiliate-access-policy";

export function requireAffiliatePortalEnabled() {
  if (process.env.AFFILIATE_PORTAL_ENABLED !== "true") notFound();
}

export async function getAffiliateSession() {
  requireAffiliatePortalEnabled();
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const company = await prisma.company.findUnique({
    where: { slug: process.env.AFFILIATE_COMPANY_SLUG || "america-first-clinic" }, select: { id: true }
  });
  if (!company) return null;
  const affiliate = await prisma.affiliateProfile.findFirst({ where: { companyId: company.id, authUserId: user.id } });
  return canAccessAffiliatePortal(user, affiliate, company.id) ? affiliate : null;
}

export async function requireAffiliateSession() {
  const affiliate = await getAffiliateSession();
  if (!affiliate) redirect("/affiliates/login");
  return affiliate;
}
