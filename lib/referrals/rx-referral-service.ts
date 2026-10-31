import type { PrismaClient } from "@prisma/client";
import { z } from "zod";
import type { SellerIdentity } from "./attribution-policy";

export type RxReferralResult =
  | { status: "NONE" }
  | { status: "RESOLVED"; seller: SellerIdentity }
  | { status: "REVIEW_REQUIRED"; reason: "INVALID_REFERRAL" | "AMBIGUOUS_REFERRAL" | "INACTIVE_REFERRAL" };

/** Server-only lookup. A click establishes neither acquisition nor account access. */
export async function resolveRxReferral(
  db: Pick<PrismaClient, "affiliateProfile" | "consultantProfile">,
  companyId: string, code: unknown
): Promise<RxReferralResult> {
  z.string().uuid().parse(companyId);
  if (code === undefined || code === null || code === "") return { status: "NONE" };
  if (typeof code !== "string" || !/^[A-Za-z0-9_-]{3,64}$/.test(code)) {
    return { status: "REVIEW_REQUIRED", reason: "INVALID_REFERRAL" };
  }
  const [affiliate, agent] = await Promise.all([
    db.affiliateProfile.findFirst({ where: { companyId, referralCode: code }, select: { id: true, status: true } }),
    db.consultantProfile.findFirst({ where: { companyId, referralCode: code },
      select: { id: true, user: { select: { companyId: true, status: true, role: true } } } })
  ]);
  if (affiliate && agent) return { status: "REVIEW_REQUIRED", reason: "AMBIGUOUS_REFERRAL" };
  if (affiliate) return affiliate.status === "APPROVED"
    ? { status: "RESOLVED", seller: { companyId, role: "AFFILIATE", profileId: affiliate.id } }
    : { status: "REVIEW_REQUIRED", reason: "INACTIVE_REFERRAL" };
  if (agent) return agent.user.companyId === companyId && agent.user.status === "ACTIVE" && agent.user.role === "CONSULTANT"
    ? { status: "RESOLVED", seller: { companyId, role: "CONSULTANT", profileId: agent.id } }
    : { status: "REVIEW_REQUIRED", reason: "INACTIVE_REFERRAL" };
  return { status: "REVIEW_REQUIRED", reason: "INVALID_REFERRAL" };
}
