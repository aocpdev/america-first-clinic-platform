/** Keep old home search/filter URLs usable without accepting redirect destinations. */
export function legacyHomeCatalogDestination(params: Record<string, unknown>, base: string) {
  if (!["q", "category", "page"].some(key => typeof params[key] === "string")) return null;
  const query = new URLSearchParams();
  for (const key of ["q", "category", "page", "ref"]) {
    const value = params[key];
    if (typeof value === "string") query.set(key, value);
  }
  return `${base}/catalog?${query}#catalog`;
}
