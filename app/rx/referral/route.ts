import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireRxCompany } from "@/lib/products/rx-catalog";
import { readCatalog } from "@/lib/products/catalog-reader";
import { RX_HOST } from "@/lib/products/rx-routing";
import { approvedBrowsingAffiliate, referralLandingInput, RX_REFERRAL_COOKIE } from "@/lib/referrals/rx-browsing-referral";

export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  const noCache = { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow" };
  if (process.env.RX_REFERRALS_ENABLED !== "true") return new NextResponse("Referral links are not available yet.", { status: 404, headers: noCache });
  const company = await requireRxCompany();
  const input = referralLandingInput(request.nextUrl.searchParams);
  const affiliate = input && await approvedBrowsingAffiliate(prisma, company.id, input.code);
  if (!input || !affiliate) return new NextResponse("This referral link is unavailable. Please request an updated link.", { status: 404, headers: noCache });
  if (input.product) {
    const product = await readCatalog(company.id, (db, companyId) => db.product.findFirst({ where: { companyId, slug: input.product!, active: true }, select: { id: true } }));
    if (!product) return new NextResponse("This product is no longer available.", { status: 404, headers: noCache });
  }
  // Fixed trusted origins: no redirect destination or company comes from user input.
  const host = request.headers.get("host") || "";
  const isLocal = process.env.NODE_ENV !== "production" && ["127.0.0.1:3008", "localhost:3008"].includes(host);
  const base = isLocal ? `http://${host}/rx` : `https://${RX_HOST}`;
  const destination = input.product ? `${base}/products/${encodeURIComponent(input.product)}` : `${base}/`;
  const response = NextResponse.redirect(destination, 303);
  Object.entries(noCache).forEach(([key, value]) => response.headers.set(key, value));
  response.cookies.set(RX_REFERRAL_COOKIE, input.code, { httpOnly: true, secure: !isLocal, sameSite: "lax", path: isLocal ? "/rx" : "/", maxAge: 60 * 60 * 24 * 30 });
  return response;
}
