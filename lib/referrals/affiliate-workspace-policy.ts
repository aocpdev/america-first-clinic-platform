export function catalogPage(value: unknown) {
  const page = typeof value === "string" && /^\d{1,6}$/.test(value) ? Number(value) : 1;
  return Math.max(1, page);
}

export function affiliatePayoutReturnBase(value: string | undefined, live: boolean) {
  const url = new URL(value || "https://affiliates.govirtualhealth.com");
  if (url.username || url.password || url.search || url.hash || url.pathname !== "/" ||
    (live ? url.protocol !== "https:" : !["https:", "http:"].includes(url.protocol)) ||
    (url.protocol === "http:" && !["localhost", "127.0.0.1"].includes(url.hostname))) {
    throw new Error("INVALID_RETURN_URL");
  }
  return url.origin;
}

export function affiliatePayoutRecipientMatches(affiliate: { companyId: string; authUserId: string | null; email: string },
  user: { companyId: string | null; authUserId: string; email: string; status: string; isActive: boolean } | null) {
  return Boolean(user && user.companyId === affiliate.companyId && user.authUserId === affiliate.authUserId &&
    user.email.trim().toLowerCase() === affiliate.email && user.isActive && user.status === "ACTIVE");
}
