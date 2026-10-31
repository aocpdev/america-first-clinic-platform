import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { canManageAffiliates } from "./affiliate-admin-policy";

export async function requireAffiliateAdmin() {
  if (process.env.AFFILIATE_ADMIN_ENABLED !== "true") notFound();
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!canManageAffiliates(user)) notFound();
  return { userId: user.id, companyId: user.companyId! };
}
