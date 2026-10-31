/** Referral landing validates the seller before remembering a browsing reference. */
export function buildAffiliateRxLink(referralCode: string, productSlug?: string, localBase?: string) {
  if (!/^AF-[A-Z0-9-]{6,64}$/.test(referralCode)) throw new Error("INVALID_REFERRAL_CODE");
  if (productSlug !== undefined && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(productSlug)) throw new Error("INVALID_PRODUCT_SLUG");
  if (localBase && !/^http:\/\/(?:localhost|127\.0\.0\.1):\d{2,5}\/rx$/.test(localBase)) throw new Error("INVALID_PREVIEW_ORIGIN");
  const url = new URL(localBase ? `${localBase}/referral` : "https://rx.govirtualhealth.com/referral");
  url.searchParams.set("ref", referralCode);
  if (productSlug) url.searchParams.set("product", productSlug);
  return url.toString();
}

export function affiliateProductImageSource(value: string | null | undefined) {
  if (!value) return null;
  if (value.startsWith("/") && !value.startsWith("//") && !value.includes("\\")) return value;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}
