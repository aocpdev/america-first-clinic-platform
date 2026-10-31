import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { requireRxCompany, rxBasePath } from "@/lib/products/rx-catalog";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db/prisma";
import { approvedBrowsingAffiliate, RX_REFERRAL_COOKIE } from "@/lib/referrals/rx-browsing-referral";
import { StoreNavigation } from "./store-navigation";
import { readCatalog } from "@/lib/products/catalog-reader";
import { orderRxCategories } from "@/lib/products/rx-category-order";
import { readRxCart } from "@/lib/orders/rx-cart-session";
import { rxShopCategoryWhere } from "@/lib/products/rx-telehealth";
import "./rx-store.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: { default: "RX · Go Virtual Health", template: "%s · Go Virtual Health RX" },
  description: "Explore the Go Virtual Health product catalog.", robots: { index: false, follow: false } };

export default async function RxLayout({ children }: { children: React.ReactNode }) {
  const company = await requireRxCompany();
  const base = await rxBasePath();
  const cart = await readRxCart(company.id);
  const categories = await readCatalog(company.id, (db, companyId) => db.productCategory.findMany({
    where: { companyId, ...rxShopCategoryWhere, products: { some: { companyId, active: true } } },
    select: { id: true, name: true }, orderBy: { name: "asc" }
  }));
  const affiliate = process.env.RX_REFERRALS_ENABLED === "true"
    ? await approvedBrowsingAffiliate(prisma, company.id, (await cookies()).get(RX_REFERRAL_COOKIE)?.value) : null;
  return <div className="rx-store min-h-screen bg-white text-clinic-ink">
    <a href="#rx-main" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-white focus:p-4">Skip to content</a>
    <StoreNavigation base={base} categories={orderRxCategories(categories)} cartCount={cart.items.reduce((sum, item) => sum + item.quantity, 0)} />
    {affiliate && <div className="border-b border-emerald-100 bg-emerald-50 px-4 py-3 text-center text-xs text-emerald-900">Referred by {affiliate.displayName} · Referral saved for this browser. Online ordering is not open yet.</div>}
    <main id="rx-main">{children}</main>
    <footer className="mt-16 border-t border-slate-100 bg-clinic-mist"><div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:grid-cols-2 sm:px-6"><div><p className="text-lg font-semibold text-clinic-navy">Go Virtual Health RX</p><p className="mt-3 max-w-sm text-sm leading-6 text-slate-500">A simpler place to explore your next step in wellness.</p><p className="mt-4 text-xs leading-5 text-slate-400">Product availability and pricing are managed by Go Virtual Health.</p></div><nav aria-label="Store information" className="flex flex-wrap items-start gap-x-6 gap-y-2 text-sm text-clinic-navy sm:justify-end"><Link className="inline-flex min-h-11 items-center" href={`${base}/catalog#catalog`}>Shop all</Link><Link className="inline-flex min-h-11 items-center gap-1" href={`${base}/login`}>Customer account<ArrowUpRight className="h-3 w-3" aria-hidden="true" /></Link><a className="inline-flex min-h-11 items-center" href={`${base}/terms-of-service`}>Terms</a><a className="inline-flex min-h-11 items-center" href={`${base}/privacy-policy`}>Privacy</a></nav></div></footer>
  </div>;
}
