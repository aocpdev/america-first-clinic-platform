import { AddToCart } from "../../cart/add-to-cart";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { readCatalog } from "@/lib/products/catalog-reader";
import { requireRxCompany, rxBasePath, rxProductSelect } from "@/lib/products/rx-catalog";
import { formatCurrency } from "@/lib/products/catalog";
import { RxProductImage } from "../../product-image";
import { cache } from "react";
import { legacyAffiliateLanding } from "@/lib/referrals/rx-browsing-referral";
import { ArrowUpRight } from "lucide-react";
import { CareJourney, ProductQuestions } from "../../care-journey";
import { isWeightLossCategory } from "@/lib/products/rx-weight-loss";
import { isRxClinicalService } from "@/lib/products/rx-telehealth";

const getProduct = cache(async (slug: string) => {
  const company = await requireRxCompany();
  return readCatalog(company.id, (db, companyId) => db.product.findFirst({ where: { companyId, slug, active: true }, select: rxProductSelect }));
});

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProduct(slug);
  if (!product) return { title: "Product unavailable", robots: { index: false, follow: false } };
  if (isRxClinicalService(product.category.name)) return { title: "Telehealth", alternates: { canonical: "https://rx.govirtualhealth.com/telehealth" } };
  const description = product.description.replace(/\s+/g, " ").trim().slice(0, 160);
  const url = `https://rx.govirtualhealth.com/products/${encodeURIComponent(product.slug)}`;
  return { title: product.title, description, alternates: { canonical: url },
    openGraph: { title: product.title, description, url, type: "website" } };
}

export default async function RxProductPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ ref?: string | string[] }> }) {
  const { slug } = await params;
  const [base, product] = await Promise.all([rxBasePath(), getProduct(slug)]);
  const query = await searchParams;
  const landing = process.env.RX_REFERRALS_ENABLED === "true" && legacyAffiliateLanding(query.ref, base, slug);
  if (landing) redirect(landing);
  if (!product) notFound();
  if (isRxClinicalService(product.category.name)) redirect(`${base}/telehealth`);
  return <div className="rx-landing">
    <div className="rx-product-landing rx-enter">
      <nav aria-label="Breadcrumb" className="rx-breadcrumb"><Link href={`${base}/catalog#catalog`}>All products</Link><span aria-hidden="true">/</span>{isWeightLossCategory(product.category.name) ? <Link href={`${base}/weight-loss`}>Weight loss</Link> : <span>{product.category.name}</span>}</nav>
      <section className="rx-product-detail"><div className="rx-product-stage"><p>Go Virtual Health / The collection</p><RxProductImage src={product.images[0]?.url} alt={product.images[0]?.alt} title={product.title} priority /></div><div className="rx-product-overview"><p className="rx-eyebrow">{product.category.name}</p><h1>{product.title}</h1><p>Explore the details. Understand your options. Take the next step at your own pace.</p><p className="rx-product-price">{formatCurrency(product.priceCents)}<span>Current catalog product price</span></p><AddToCart productId={product.id} title={product.title} /><Link href={`${base}/review/${encodeURIComponent(slug)}`} className="rx-button-text">Review pricing <ArrowUpRight size={16} aria-hidden="true" /></Link><p>Catalog preview only. No payment or order is created.</p>{product.supportsRecurring && <p>Recurring options are being prepared for launch.</p>}</div></section>
      <section className="rx-product-about" id="product-details"><div><p className="rx-eyebrow">Know your selection</p><h2>Details that<br />make a difference.</h2></div><p>{product.description || "Additional details will appear when published in our catalog."}</p></section>
    </div>
    <CareJourney service={product.category.name === "Clinical Services"} /><ProductQuestions service={product.category.name === "Clinical Services"} />
    <section className="rx-landing-section"><div className="rx-final-cta"><p className="rx-eyebrow">Keep exploring</p><h2>Your wellness.<br />Your next chapter.</h2><Link className="rx-button-primary" href={isWeightLossCategory(product.category.name) ? `${base}/weight-loss` : `${base}/catalog#catalog`}>Explore the collection <ArrowUpRight size={18} aria-hidden="true" /></Link></div></section>
  </div>;
}
