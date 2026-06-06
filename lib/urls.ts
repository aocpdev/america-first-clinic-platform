function normalizeBaseUrl(value?: string | null) {
  return (value || "http://localhost:3000").replace(/\/$/, "");
}

export function portalBaseUrl() {
  return normalizeBaseUrl(
    process.env.NEXT_PUBLIC_PORTAL_URL ||
      process.env.NEXT_PUBLIC_APP_URL ||
      "http://localhost:3000",
  );
}

export function publicSiteBaseUrl() {
  return normalizeBaseUrl(
    process.env.NEXT_PUBLIC_SITE_URL ||
      process.env.NEXT_PUBLIC_PUBLIC_URL ||
      process.env.NEXT_PUBLIC_APP_URL ||
      "http://localhost:3000",
  );
}
