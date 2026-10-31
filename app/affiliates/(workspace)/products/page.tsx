import { Card } from "@/components/ui/card";
import { prisma } from "@/lib/db/prisma";
import { requireAffiliateSession } from "@/lib/referrals/affiliate-session";
import { formatCurrency } from "@/lib/products/catalog";
import Link from "next/link";
import { catalogPage } from "@/lib/referrals/affiliate-workspace-policy";
import { snapshotAffiliateTerms } from "@/lib/referrals/affiliate-terms";
import { estimateAffiliateProductEarnings } from "@/lib/referrals/affiliate-product-earnings";
import { buildAffiliateRxLink, affiliateProductImageSource } from "@/lib/referrals/affiliate-links";
import { AffiliateProductImage } from "./product-image";
import { readCatalog } from "@/lib/products/catalog-reader";
import { AffiliateShareLink } from "./share-link";
import { affiliateLinkBase } from "@/lib/referrals/affiliate-link-base";

export const metadata = { title: "Product catalog · Affiliate workspace", description: "Browse your product collection and personalized earnings estimates.", robots: { index: false, follow: false } };

export default async function AffiliateProductsPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string; category?: string }> }) {
  const affiliate = await requireAffiliateSession();
  const settings = await prisma.affiliateProgramSetting.findUnique({ where: { companyId: affiliate.companyId }, select: { commissionBps: true } });
  const terms = snapshotAffiliateTerms({ companyId: affiliate.companyId, affiliateCompanyId: affiliate.companyId,
    affiliateId: affiliate.id, globalRateBps: settings?.commissionBps, affiliateRateBps: affiliate.commissionBps });
  const linkBase = await affiliateLinkBase();
  const linksEnabled = process.env.RX_REFERRALS_ENABLED === "true" && process.env.RX_STOREFRONT_ENABLED === "true" &&
    process.env.RX_COMPANY_SLUG === (process.env.AFFILIATE_COMPANY_SLUG || "america-first-clinic");
  const storeLink = buildAffiliateRxLink(affiliate.referralCode, undefined, linkBase);
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q.trim().slice(0, 100) : "";
  const { categories, categoryId, total, pages, page, products } = await readCatalog(affiliate.companyId, async (db, companyId) => {
  const categories = await db.productCategory.findMany({ where: { companyId,
    products: { some: { active: true, companyId } } }, select: { id: true, name: true }, orderBy: { name: "asc" } });
  const categoryId = categories.find(category => category.id === params.category)?.id;
  const where = { companyId, active: true, ...(categoryId ? { categoryId } : {}),
    ...(q ? { title: { contains: q, mode: "insensitive" as const } } : {}) };
  const total = await db.product.count({ where });
  const pages = Math.max(1, Math.ceil(total / 24));
  const page = Math.min(catalogPage(params.page), pages);
  const products = await db.product.findMany({ where,
    select: { id: true, title: true, slug: true, description: true, supportsRecurring: true,
      priceCents: true, internalCostCents: true, category: { select: { name: true } },
      images: { orderBy: [{ sortOrder: "asc" }, { id: "asc" }], take: 1, select: { url: true, alt: true } } },
    orderBy: [{ title: "asc" }, { id: "asc" }], take: 24, skip: (page - 1) * 24 });
  return { categories, categoryId, total, pages, page, products };
  });
  const pageUrl = (next: number) => `/affiliates/products?${new URLSearchParams({ q, category: categoryId || "", page: String(next) })}`;
  return <div className="space-y-8">
    <header className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
      <div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Your affiliate catalog</p><h1 className="mt-3 text-3xl font-semibold tracking-tight text-clinic-navy sm:text-4xl">Products worth sharing.</h1><p className="mt-3 max-w-xl text-sm leading-6 text-slate-500">Explore the collection and see your estimated earnings on every product.</p></div>
      <div className="shrink-0 rounded-2xl border border-slate-200 bg-white px-5 py-4"><p className="text-xs text-slate-500">Your commission rate</p><p className="mt-1 text-3xl font-semibold tracking-tight text-clinic-navy">{terms.rateBps / 100}% <span className="text-xs font-normal text-slate-500">of margin</span></p><p className="mt-1 text-xs text-slate-500">{terms.rateSource === "AFFILIATE_OVERRIDE" ? "Your individual rate" : "Program standard rate"}</p></div>
    </header>
    {process.env.LOCAL_CATALOG_SOURCE_URL && <p className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-xs leading-5 text-clinic-navy">Live Admin catalog · Test affiliate account · No payments or earned commissions are created here.</p>}
    <details className="rounded-2xl border border-slate-200 bg-white p-5">
      <summary className="cursor-pointer text-sm font-semibold text-clinic-navy">Your personal store link</summary>
      <p className="mt-3 text-sm leading-6 text-slate-500">One link for the entire RX store. Online purchasing is not open yet; browsing does not generate earnings.</p>
      <AffiliateShareLink url={storeLink} label="Store" enabled={linksEnabled} local={linkBase !== undefined} />
    </details>
    <form role="search" className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-3 sm:flex-row">
      <label className="min-w-0 flex-1"><span className="sr-only">Search products</span><input name="q" defaultValue={q} placeholder="Find a product…" className="h-12 w-full rounded-xl border-0 bg-slate-50 px-4 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-clinic-blue" /></label>
      <label className="min-w-0 sm:max-w-[15rem]"><span className="sr-only">Product category</span><select name="category" defaultValue={categoryId || ""} className="h-12 w-full rounded-xl border-0 bg-slate-50 px-3 text-sm"><option value="">All categories</option>{categories.map(category => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
      <button className="min-h-12 rounded-xl bg-clinic-navy px-6 text-sm font-semibold text-white">Search</button>
    </form>
    <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-slate-500">{total} {total === 1 ? "product" : "products"}{q || categoryId ? " found" : " in the collection"}</p>{(q || categoryId) && <Link href="/affiliates/products" className="inline-flex min-h-11 items-center text-sm font-medium text-clinic-navy">Clear filters</Link>}</div>
    <div className="grid min-w-0 gap-6 md:grid-cols-2 xl:grid-cols-3">{products.map(product => {
      const earningsCents = estimateAffiliateProductEarnings({ priceCents: product.priceCents, internalCostCents: product.internalCostCents, rateBps: terms.rateBps });
      const productLink = buildAffiliateRxLink(affiliate.referralCode, product.slug, linkBase);
      return <article key={product.id} className="flex min-w-0 flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white transition-shadow hover:shadow-lg hover:shadow-slate-200/40">
        <AffiliateProductImage src={affiliateProductImageSource(product.images[0]?.url)} alt={product.images[0]?.alt || null} title={product.title} />
        <div className="flex flex-1 flex-col p-5">
          <p className="text-xs font-medium text-slate-500">{product.category.name}</p>
          <h2 className="mt-2 break-words text-lg font-semibold leading-7 tracking-tight text-clinic-navy">{product.title}</h2>
          <p className="mt-3 line-clamp-2 text-sm leading-6 text-slate-500">{product.description}</p>
          <div className="mt-auto pt-6"><p className="text-xs text-slate-500">Customer price</p><p className="mt-1 text-xl font-semibold text-clinic-navy">{formatCurrency(product.priceCents)}</p></div>
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-emerald-50 px-4 py-4"><div><p className="text-xs font-medium text-emerald-800">You could earn / unit</p><p className="mt-1 text-xs text-emerald-800">{terms.rateBps / 100}% of margin</p></div><p className="text-2xl font-semibold tracking-tight text-emerald-900">{earningsCents == null ? "Unavailable" : formatCurrency(earningsCents)}</p></div>
          <div className="mt-4 border-t border-slate-100 pt-4"><AffiliateShareLink url={productLink} label={product.title} enabled={linksEnabled} local={linkBase !== undefined} /></div>
        </div>
      </article>;
    })}</div>
    {!products.length && <Card className="rounded-2xl p-10 text-center"><h2 className="font-semibold text-clinic-navy">No matching products</h2><p className="mt-2 text-sm text-slate-500">Try another search or category.</p><Link href="/affiliates/products" className="mt-5 inline-flex min-h-11 items-center text-sm font-semibold text-clinic-blue">View all products</Link></Card>}
    {pages > 1 && <nav aria-label="Product pages" className="flex items-center justify-between gap-4 text-sm">{page > 1 ? <Link href={pageUrl(page - 1)} className="flex min-h-11 items-center rounded-xl border bg-white px-4">Previous</Link> : <span />}<span className="text-slate-500">Page {page} of {pages}</span>{page < pages ? <Link href={pageUrl(page + 1)} className="flex min-h-11 items-center rounded-xl border bg-white px-4">Next</Link> : <span />}</nav>}
    <p className="max-w-3xl text-xs leading-6 text-slate-500">Estimates use the current product price and cost saved by Go Virtual Health, before discounts. Your individual rate takes priority over the program rate. Final earnings depend on the completed purchase and are not an available payout balance.</p>
  </div>;
}
