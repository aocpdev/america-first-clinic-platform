import { NextResponse, type NextRequest } from "next/server";

const PORTAL_HOST = "portal.govirtualhealth.com";
const PUBLIC_HOST = "govirtualhealth.com";
const WWW_HOST = "www.govirtualhealth.com";

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

  if (host === PUBLIC_HOST || host === WWW_HOST) {
    return NextResponse.redirect(withHost(request, PORTAL_HOST), 308);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico|css|js|map)$).*)"],
};
