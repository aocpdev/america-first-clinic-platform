import { AddToCart } from "../cart/add-to-cart";
import { rxShopCategoryWhere, rxShopProductWhere } from "@/lib/products/rx-telehealth";
import type { Metadata } from "next";
import Link from "next/link";
import { readCatalog } from "@/lib/products/catalog-reader";
import { requireRxCompany, rxBasePath, rxProductSelect } from "@/lib/products/rx-catalog";
import { rxPageNumber } from "@/lib/products/rx-routing";
import { formatCurrency } from "@/lib/products/catalog";
import { RxProductImage } from "../product-image";
import { orderRxCategories } from "@/lib/products/rx-category-order";
import { CatalogPagination } from "../catalog-pagination";
import { redirect } from "next/navigation";
import { legacyAffiliateLanding } from "@/lib/referrals/rx-browsing-referral";

export const metadata: Metadata = { title: "Catalog", description: "Explore the Go Virtual Health collection. Browse categories, product details and current pricing.", alternates: { canonical: "https://rx.govirtualhealth.com/catalog" } };

export default async function RxCatalog({ searchParams }: { searchParams: Promise<{ q?: string; category?: string; page?: string; ref?: string | string[] }> }) {
  const company = await requireRxCompany();
  const [params, base] = await Promise.all([searchParams, rxBasePath()]);
  const landing = process.env.RX_REFERRALS_ENABLED === "true" && legacyAffiliateLanding(params.ref, base);
  if (landing) redirect(landing);
  const q = typeof params.q === "string" ? params.q.trim().slice(0, 100) : "";
  const { categories, categoryId, total, pages, page, products } = await readCatalog(company.id, async (db, companyId) => {
  const categories = orderRxCategories(await db.productCategory.findMany({ where: { companyId, ...rxShopCategoryWhere, products: { some: { companyId, active: true } } },
      select: { id: true, name: true, _count: { select: { products: { where: { active: true, companyId } } } } }, orderBy: { name: "asc" } }));
  const categoryId = categories.find(category => category.id === params.category)?.id;
  const where = { ...rxShopProductWhere(companyId), ...(categoryId ? { categoryId } : {}),
    ...(q ? { title: { contains: q, mode: "insensitive" as const } } : {}) };
  const total = await db.product.count({ where });
  const pages = Math.max(1, Math.ceil(total / 12));
  const page = rxPageNumber(params.page, pages);
  const products = await db.product.findMany({ where, select: rxProductSelect,
    orderBy: [{ title: "asc" }, { id: "asc" }], take: 12, skip: (page - 1) * 12 });
  return { categories, categoryId, total, pages, page, products };
  });
  const pageUrl = (value: number) => `${base}/catalog?${new URLSearchParams({ q, category: categoryId || "", page: String(value) })}#catalog`;
  return <>
    <section id="catalog" className="rx-home-catalog rx-dedicated-catalog mx-auto max-w-6xl scroll-mt-6 px-4 py-10 sm:px-6 sm:py-14"><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="rx-home-eyebrow">Explore the collection</p><h1 className="rx-catalog-title">The catalog.</h1><p className="rx-catalog-intro">Find your focus. Explore the details. Choose your next step.</p></div><p className="text-sm text-slate-500">{total} {total === 1 ? "product" : "products"} available</p></div>
      <form key={`${q}:${categoryId ?? ""}`} action={`${base}/catalog#catalog`} role="search" className="mt-7 flex flex-col gap-3 sm:flex-row"><label className="flex-1"><span className="sr-only">Search products</span><input name="q" defaultValue={q} placeholder="Search products" maxLength={100} className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clinic-navy" /></label><label><span className="sr-only">Category</span><select name="category" defaultValue={categoryId || ""} className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm"><option value="">All categories</option>{categories.map(category => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label><button className="min-h-12 rounded-xl bg-clinic-navy px-6 text-sm font-semibold text-white">Search</button></form>
      <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">{products.map(product => <article key={product.id} className="rx-product flex min-w-0 flex-col overflow-hidden rounded-3xl border border-slate-100 bg-white"><Link href={`${base}/products/${encodeURIComponent(product.slug)}`} aria-label={`View ${product.title}`}><RxProductImage src={product.images[0]?.url} alt={product.images[0]?.alt} title={product.title} /></Link><div className="flex flex-1 flex-col p-5"><p className="text-xs font-medium text-clinic-blue">{product.category.name}</p><h3 className="mt-2 break-words text-lg font-semibold leading-6 text-clinic-navy">{product.title}</h3><p className="mt-3 line-clamp-2 flex-1 text-sm leading-6 text-slate-500">{product.description}</p><div className="mt-6 flex flex-wrap items-center justify-between gap-3"><p className="text-xl font-semibold text-clinic-navy">{formatCurrency(product.priceCents)}</p><Link href={`${base}/products/${encodeURIComponent(product.slug)}`} className="inline-flex min-h-11 items-center rounded-lg border border-slate-200 px-4 text-sm font-semibold text-clinic-navy">View details</Link></div><AddToCart productId={product.id} title={product.title} /></div></article>)}</div>
      {!products.length && <div className="mt-8 rounded-2xl border border-slate-100 bg-clinic-mist p-8 text-center"><h3 className="font-semibold text-clinic-navy">{q || categoryId ? "No matching products" : "Our catalog is being prepared"}</h3><p className="mt-3 text-sm text-slate-500">{q || categoryId ? "Try another search or explore all categories." : "Available products will appear here when published by Go Virtual Health."}</p>{(q || categoryId) && <Link href={`${base}/catalog#catalog`} className="mt-4 inline-flex min-h-11 items-center text-sm font-medium text-clinic-blue">Clear filters</Link>}</div>}
      <CatalogPagination page={page} pages={pages} pageUrl={pageUrl} />
    </section>
  </>;
}
