import { prisma } from "@/lib/db/prisma";
import { affiliatePayoutRecipientMatches } from "./affiliate-workspace-policy";

export async function getAffiliatePayoutRecipient(affiliate: { companyId: string; authUserId: string | null; email: string }) {
  if (!affiliate.authUserId) return null;
  const user = await prisma.user.findUnique({ where: { authUserId: affiliate.authUserId },
    select: { id: true, companyId: true, authUserId: true, email: true, status: true, isActive: true } });
  return affiliatePayoutRecipientMatches(affiliate, user) ? user : null;
}
