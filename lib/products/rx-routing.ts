export const RX_HOST = "rx.govirtualhealth.com";

/** No database/auth in middleware; unknown RX paths never fall through to CRM pages. */
export function rxDestination(host: string | undefined, pathname: string, enabled: boolean) {
  if (host?.split(":")[0].toLowerCase() !== RX_HOST) return null;
  if (!enabled) return "/rx/unavailable";
  if (pathname.startsWith("/_next/") || pathname === "/favicon.ico") return pathname;
  if (pathname === "/") return "/rx";
  if (pathname === "/privacy-policy" || pathname === "/terms-of-service") return `/rx${pathname}`;
  if (pathname === "/rx/privacy-policy" || pathname === "/rx/terms-of-service") return pathname;
  if (pathname === "/catalog" || pathname === "/shop" || pathname === "/products") return "/rx/catalog";
  if (pathname === "/rx/catalog") return pathname;
  if (pathname === "/cart" || pathname === "/checkout") return `/rx${pathname}`;
  if (pathname === "/rx/cart" || pathname === "/rx/checkout") return pathname;
  if (pathname === "/login") return "/rx/login";
  if (pathname === "/rx/login") return pathname;
  if (pathname === "/referral") return "/rx/referral";
  if (pathname === "/rx/referral") return pathname;
  if (pathname === "/affiliates") return "/rx/affiliates";
  if (pathname === "/rx/affiliates") return pathname;
  if (pathname === "/weight-loss") return "/rx/weight-loss";
  if (pathname === "/rx/weight-loss") return pathname;
  if (pathname === "/telehealth") return "/rx/telehealth";
  if (pathname === "/rx/telehealth") return pathname;
  if (pathname === "/account") return "/rx/account";
  if (pathname === "/rx/account") return pathname;
  if (/^\/account\/orders\/[^/]+$/.test(pathname)) return `/rx${pathname}`;
  if (/^\/rx\/account\/orders\/[^/]+$/.test(pathname)) return pathname;
  if (/^\/review\/[^/]+$/.test(pathname)) return `/rx${pathname}`;
  if (/^\/rx\/review\/[^/]+$/.test(pathname)) return pathname;
  if (/^\/(?:shop|products)\/[^/]+$/.test(pathname)) return `/rx/products/${pathname.split("/")[2]}`;
  if (pathname === "/rx" || /^\/rx\/products\/[^/]+$/.test(pathname)) return pathname;
  return "/rx/unavailable";
}

export function rxPageNumber(value: unknown, pages: number) {
  const page = typeof value === "string" && /^\d{1,6}$/.test(value) ? Number(value) : 1;
  return Math.min(Math.max(1, page), Math.max(1, pages));
}
