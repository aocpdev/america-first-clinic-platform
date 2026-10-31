import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { RxProductImage } from "./product-image";

type FeaturedProduct = { slug: string; title: string; images: { url: string; alt: string | null }[] };

export function CatalogFeature({ base, product }: { base: string; product: FeaturedProduct | null }) {
  return <section id="catalog" className="rx-catalog-feature" aria-labelledby="rx-catalog-feature-title">
    <div className="rx-catalog-feature-shell">
      <div className="rx-catalog-feature-visual" data-rx-reveal>
        {product ? <>
          <p className="rx-home-eyebrow">In the collection / Weight loss</p>
          <Link className="rx-catalog-feature-image" href={`${base}/products/${encodeURIComponent(product.slug)}`} aria-label={`Explore ${product.title}`}>
            <RxProductImage src={product.images[0]?.url} alt={product.images[0]?.alt} title={product.title} />
          </Link>
        </> : <Image src="/rx/wellness/hero-v1.webp" alt="A quiet moment at home" fill sizes="(max-width: 760px) 100vw, 50vw" className="object-cover" />}
      </div>
      <div className="rx-catalog-feature-copy" data-rx-reveal>
        <p className="rx-home-eyebrow">The catalog</p>
        <h2 id="rx-catalog-feature-title">Thoughtfully selected.<br /><span>Ready to explore.</span></h2>
        <p>Your next step deserves a closer look. Discover our full collection, compare current pricing, and find the details that matter to you.</p>
        <Link href={`${base}/catalog#catalog`} className="rx-home-primary">Explore the catalog <ArrowRight size={18} aria-hidden="true" /></Link>
        <div className="rx-catalog-feature-note"><span>Browse by category</span><span>Clear product details</span></div>
        <p className="rx-catalog-feature-disclaimer">Prescription treatment requires clinical review. Exploring a product does not establish eligibility or start treatment.</p>
      </div>
    </div>
  </section>;
}
