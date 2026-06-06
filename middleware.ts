import { NextResponse, type NextRequest } from "next/server";

const PORTAL_HOST = "portal.govirtualhealth.com";
const PUBLIC_HOST = "govirtualhealth.com";
const WWW_HOST = "www.govirtualhealth.com";

const INTERNAL_PREFIXES = [
  "/admin",
  "/partner",
  "/manager",
  "/consultant",
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/auth",
  "/pending-approval",
  "/onboarding",
  "/profile",
  "/settings",
];

const PUBLIC_PREFIXES = [
  "/shop",
  "/checkout",
  "/pay",
  "/i",
  "/terms",
  "/privacy",
  "/privacy-policy",
  "/terms-of-service",
  "/refund-policy",
  "/shipping-policy",
  "/medical-disclaimer",
];

const SKIP_PREFIXES = ["/api", "/_next", "/favicon.ico", "/robots.txt", "/sitemap.xml"];

function startsWithAny(pathname: string, prefixes: string[]) {
  return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function withHost(request: NextRequest, host: string) {
  const url = request.nextUrl.clone();
  url.hostname = host;
  url.protocol = "https:";
  return url;
}

export function middleware(request: NextRequest) {
  const host = request.headers.get("host")?.split(":")[0].toLowerCase();
  const pathname = request.nextUrl.pathname;

  if (
    !host ||
    ![PORTAL_HOST, PUBLIC_HOST, WWW_HOST].includes(host) ||
    startsWithAny(pathname, SKIP_PREFIXES)
  ) {
    return NextResponse.next();
  }

  if (host === WWW_HOST) {
    const url = withHost(request, startsWithAny(pathname, INTERNAL_PREFIXES) ? PORTAL_HOST : PUBLIC_HOST);
    return NextResponse.redirect(url, 308);
  }

  if (host === PUBLIC_HOST) {
    if (pathname === "/") {
      const url = request.nextUrl.clone();
      url.pathname = "/shop";
      return NextResponse.redirect(url, 307);
    }

    if (startsWithAny(pathname, INTERNAL_PREFIXES)) {
      return NextResponse.redirect(withHost(request, PORTAL_HOST), 307);
    }
  }

  if (host === PORTAL_HOST && startsWithAny(pathname, PUBLIC_PREFIXES)) {
    return NextResponse.redirect(withHost(request, PUBLIC_HOST), 307);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico|css|js|map)$).*)"],
};
