import type { Metadata } from "next";
import Link from "next/link";
import { ArrowDown, ArrowUpRight, ShieldCheck } from "lucide-react";
import { readCatalog } from "@/lib/products/catalog-reader";
import { requireRxCompany, rxBasePath, rxProductSelect } from "@/lib/products/rx-catalog";
import { weightLossCatalogWhere } from "@/lib/products/rx-weight-loss";
import { formatCurrency } from "@/lib/products/catalog";
import { RxProductImage } from "../product-image";
import { CareJourney, ProductQuestions } from "../care-journey";

export const metadata: Metadata = {
  title: "Weight loss", description: "Explore weight management products, current pricing and the next steps in clinical review with Go Virtual Health.",
  alternates: { canonical: "https://rx.govirtualhealth.com/weight-loss" },
  openGraph: { title: "Weight care. On your terms. | Go Virtual Health", description: "Explore the current weight management collection.", url: "https://rx.govirtualhealth.com/weight-loss", type: "website" }
};
export default async function WeightLossPage() {
  const [company, base] = await Promise.all([requireRxCompany(), rxBasePath()]);
  const products = await readCatalog(company.id, (db, companyId) => db.product.findMany({ where: weightLossCatalogWhere(companyId), select: rxProductSelect, orderBy: [{ title: "asc" }, { id: "asc" }] }));
  const featured = products.find(product => product.title.toLowerCase().includes("semaglutide")) ?? products[0];
  return <div className="rx-landing">
    <section className="rx-weight-hero rx-enter">
      <div className="rx-weight-copy"><p className="rx-eyebrow"><span className="rx-status-dot" /> Weight management, thoughtfully considered</p><h1>Weight care.<br /><span>On your terms.</span></h1><p className="rx-hero-description">Your goals are personal. Exploring your options should feel that way, too. Discover our weight management collection, with clear details to help you take your next step.</p><div className="rx-hero-actions"><a className="rx-button-primary" href="#weight-options">Explore your options <ArrowUpRight size={18} aria-hidden="true" /></a><a className="rx-button-text" href="#care-journey">How it works <ArrowDown size={16} aria-hidden="true" /></a></div><p className="rx-clinical-note"><ShieldCheck size={18} aria-hidden="true" /> Prescription treatment is subject to clinical review. Individual eligibility and results vary.</p></div>
      <div className="rx-weight-visual rx-feature"><div className="rx-visual-label"><span>THE WEIGHT CARE COLLECTION</span><span>GO / RX</span></div>
        {featured ? <><RxProductImage src={featured.images[0]?.url} alt={featured.images[0]?.alt} title={featured.title} priority /><Link className="rx-feature-caption" href={`${base}/products/${encodeURIComponent(featured.slug)}`}><div><span>Explore the details</span><h2>{featured.title}</h2></div><span className="rx-circle-arrow"><ArrowUpRight size={22} aria-hidden="true" /></span></Link></> : <div className="rx-visual-empty"><p>Space for your<br />next chapter.</p><span>Products will appear when available in our catalog.</span></div>}
      </div>
    </section>
    <div className="rx-editorial-strip"><span>Explore at your pace</span><span>Current catalog pricing</span><span>Clinical review before treatment</span></div>
    <section id="weight-options" className="rx-landing-section"><div className="rx-section-heading"><div><p className="rx-eyebrow">Find your starting point</p><h2>Different options.<br /><span>Your next conversation.</span></h2></div><p>Explore the products in our weight management catalog. Your clinician can help determine what, if anything, is appropriate for you.</p></div>
      <div className="rx-treatment-grid">{products.map(product => <article className="rx-treatment-card" key={product.id}><Link href={`${base}/products/${encodeURIComponent(product.slug)}`} className="rx-treatment-image" aria-label={`Explore ${product.title}`}><RxProductImage src={product.images[0]?.url} alt={product.images[0]?.alt} title={product.title} /></Link><div className="rx-treatment-copy"><p className="rx-eyebrow">{product.category.name}</p><h3><Link href={`${base}/products/${encodeURIComponent(product.slug)}`}>{product.title}</Link></h3><p className="rx-treatment-description">{product.description}</p><div className="rx-treatment-bottom"><div><span>Product price</span><strong>{formatCurrency(product.priceCents)}</strong></div><Link href={`${base}/products/${encodeURIComponent(product.slug)}`} aria-label={`View details for ${product.title}`} className="rx-circle-arrow"><ArrowUpRight size={21} aria-hidden="true" /></Link></div></div></article>)}</div>
      {!products.length && <p className="rx-empty-catalog">Our weight management collection is being prepared. <Link href={`${base}/catalog#catalog`}>Explore the full catalog.</Link></p>}
    </section>
    <CareJourney /><ProductQuestions />
    <section className="rx-landing-section"><div className="rx-final-cta"><p className="rx-eyebrow">Your next chapter</p><h2>Start with a little<br />more clarity.</h2><a className="rx-button-primary" href="#weight-options">Explore weight care <ArrowUpRight size={18} aria-hidden="true" /></a><p>Browse now. Online ordering is coming soon.</p></div></section>
  </div>;
}
