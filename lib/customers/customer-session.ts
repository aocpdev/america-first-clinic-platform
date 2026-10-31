import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireRxCompany, rxBasePath } from "@/lib/products/rx-catalog";
import { canAccessCustomerPortal } from "./customer-access-policy";

export function requireCustomerPortalEnabled() {
  if (process.env.CUSTOMER_PORTAL_ENABLED !== "true") notFound();
}

export async function getCustomerSession() {
  requireCustomerPortalEnabled();
  const company = await requireRxCompany();
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const account = await prisma.user.findUnique({ where: { authUserId: user.id }, select: {
    id: true, authUserId: true, email: true, companyId: true, role: true, status: true, isActive: true,
    customer: { select: { id: true, userId: true, companyId: true, email: true, firstName: true } }
  } });
  if (!canAccessCustomerPortal(user, account, account?.customer ?? null, company.id)) return null;
  return account!.customer!;
}

export async function requireCustomerSession() {
  const customer = await getCustomerSession();
  if (!customer) redirect(`${await rxBasePath()}/login`);
  return customer;
}
