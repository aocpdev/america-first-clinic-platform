import { z } from "zod";

export function percentageToBps(value: unknown, optional = false): number | null {
  const text = typeof value === "string" ? value.trim() : "";
  if (optional && !text) return null;
  if (!/^\d{1,3}(?:\.\d{1,2})?$/.test(text)) throw new Error("Enter a percentage between 0 and 100, with up to two decimals.");
  const bps = Math.round(Number(text) * 100);
  if (bps > 10000) throw new Error("Percentage cannot exceed 100%.");
  return bps;
}

export const affiliateSchema = z.object({
  displayName: z.string().trim().min(2).max(100),
  email: z.string().trim().toLowerCase().email().max(254),
  category: z.enum(["INFLUENCER", "GYM", "TRAINER", "ARTIST", "OTHER"]),
  status: z.enum(["PENDING", "APPROVED", "SUSPENDED", "ARCHIVED"]),
  commissionBps: z.number().int().min(0).max(10000).nullable()
});

export function canManageAffiliates(user: { role: string; status: string; isActive: boolean; companyId: string | null }) {
  return Boolean(user.companyId && user.isActive && user.status === "ACTIVE" &&
    (user.role === "COMPANY_ADMIN" || user.role === "SUPER_ADMIN"));
}
