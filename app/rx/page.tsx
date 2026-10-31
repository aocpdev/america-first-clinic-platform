import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, ArrowUpRight, Check, ShoppingBag, Truck, Video } from "lucide-react";
import { readCatalog } from "@/lib/products/catalog-reader";
import { requireRxCompany, rxBasePath, rxProductSelect } from "@/lib/products/rx-catalog";
import { orderRxCategories } from "@/lib/products/rx-category-order";
import { legacyHomeCatalogDestination } from "@/lib/products/rx-catalog-navigation";
import { weightLossCatalogWhere } from "@/lib/products/rx-weight-loss";
import { legacyAffiliateLanding } from "@/lib/referrals/rx-browsing-referral";
import { StoreHero } from "./store-hero";
import { CategoryRail } from "./category-rail";
import { CatalogFeature } from "./catalog-feature";
import { TelehealthFeature } from "./telehealth-feature";
import { rxShopCategoryWhere } from "@/lib/products/rx-telehealth";
import { HomeMotion } from "./home-motion";

export default async function RxHome({ searchParams }: { searchParams: Promise<{ q?: string; category?: string; page?: string; ref?: string | string[] }> }) {
  const company = await requireRxCompany();
  const [params, base] = await Promise.all([searchParams, rxBasePath()]);
  const landing = process.env.RX_REFERRALS_ENABLED === "true" && legacyAffiliateLanding(params.ref, base);
  if (landing) redirect(landing);
  const catalogDestination = legacyHomeCatalogDestination(params, base);
  if (catalogDestination) redirect(catalogDestination);
  const { categories, featured } = await readCatalog(company.id, async (db, companyId) => {
    const categories = orderRxCategories(await db.productCategory.findMany({
      where: { companyId, ...rxShopCategoryWhere, products: { some: { companyId, active: true } } },
      select: { id: true, name: true, _count: { select: { products: { where: { active: true, companyId } } } } },
      orderBy: { name: "asc" }
    }));
    const featured = await db.product.findFirst({
      where: { ...weightLossCatalogWhere(companyId), title: { startsWith: "Tirzepatide", mode: "insensitive" } },
      select: rxProductSelect, orderBy: [{ title: "asc" }, { id: "asc" }]
    });
    return { categories, featured };
  });
  return <HomeMotion>
    <StoreHero base={base} />
    <CategoryRail base={base} categories={categories} />
    <CatalogFeature base={base} product={featured} />
    <TelehealthFeature base={base} />
    <section id="how-it-works" className="rx-home-journey" aria-labelledby="rx-journey-title">
      <div className="rx-home-journey-heading" data-rx-reveal>
        <div><p className="rx-home-eyebrow">How it works</p><h2 id="rx-journey-title">Three simple steps.<br /><span>One healthier direction.</span></h2></div>
        <p>From your first order to your doorstep.<br />Your telehealth consultation is on us.</p>
      </div>
      <ol className="rx-journey-steps">
        {[
          { title: "Place your order", text: "Explore our products, choose what fits your goals, and place your order online.", label: "Your next step", Icon: ShoppingBag },
          { title: "Connect with a clinician", text: "Complete your free telehealth consultation to review your goals and whether treatment is right for you.", label: "Free consultation", Icon: Video },
          { title: "We ship to you", text: "Once your treatment is approved, we prepare your order for shipping. Follow its journey with your tracking details.", label: "Delivered to your door", Icon: Truck }
        ].map(({ title, text, label, Icon }, index) => <li key={title} className={`rx-journey-card rx-journey-card-${index + 1}`} data-rx-reveal>
          <div className="rx-journey-card-top"><span className="rx-journey-label">{index === 1 && <Check size={13} aria-hidden="true" />}{label}</span></div>
          <div className="rx-journey-visual" aria-hidden="true"><span className="rx-journey-orbit" /><span className="rx-journey-icon"><Icon size={42} strokeWidth={1.25} /></span><span className="rx-journey-check"><Check size={16} strokeWidth={2} /></span></div>
          <h3>{title}</h3><p>{text}</p>
          {index < 2 && <span className="rx-journey-connector" aria-hidden="true"><ArrowRight size={19} strokeWidth={1.5} /></span>}
        </li>)}
      </ol>
      <div className="rx-journey-footer" data-rx-reveal>
        <Link href={`${base}/catalog`} className="rx-home-primary">Explore treatments <ArrowRight size={18} aria-hidden="true" /></Link>
        <div><p>Telehealth consultation included at no additional cost.</p><p>Prescription treatments require clinical approval. Ordering does not guarantee a prescription.</p></div>
      </div>
    </section>
    <section className="rx-home-community" aria-labelledby="rx-community-title">
      <div className="rx-home-community-inner" data-rx-reveal><div><p className="rx-home-eyebrow">The affiliate program</p><h2 id="rx-community-title">Good connections.<br /><span>New possibilities.</span></h2><p>Creators, trainers, gyms and community builders: discover a new way to connect your audience with Go Virtual Health.</p></div><Link href={`${base}/affiliates`} className="rx-community-link"><span className="rx-community-arrow" aria-hidden="true"><ArrowUpRight size={34} strokeWidth={1.3} /></span><span>Explore the program</span></Link></div>
    </section>
  </HomeMotion>;
}
