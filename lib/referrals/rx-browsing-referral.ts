import type { PrismaClient } from "@prisma/client";

export const RX_REFERRAL_COOKIE = "gvh_rx_referral";
/** Preserve already reserved /?ref= and /shop/product?ref= links; agent codes stay untouched. */
export function legacyAffiliateLanding(ref: unknown, base: string, product?: string) {
  const values = typeof ref === "string" ? [ref] : Array.isArray(ref) && ref.every(v => typeof v === "string") ? ref : [];
  if (!values.some(value => value.startsWith("AF-"))) return null;
  const query = new URLSearchParams();
  values.forEach(value => query.append("ref", value));
  if (product) query.set("product", product);
  return `${base}/referral?${query}`;
}
export function referralLandingInput(params: URLSearchParams) {
  const code = params.get("ref");
  const product = params.get("product");
  if (params.getAll("ref").length !== 1 || !code || !/^AF-[A-Z0-9-]{6,64}$/.test(code) ||
      params.getAll("product").length > 1 || (product !== null && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(product))) return null;
  return { code, product };
}

/** Revalidate on every request. A browser reference never establishes customer ownership. */
export async function approvedBrowsingAffiliate(db: Pick<PrismaClient, "affiliateProfile">, companyId: string, code: unknown) {
  if (typeof code !== "string" || !/^AF-[A-Z0-9-]{6,64}$/.test(code)) return null;
  return db.affiliateProfile.findFirst({ where: { companyId, referralCode: code, status: "APPROVED" },
    select: { id: true, referralCode: true, displayName: true } });
}
