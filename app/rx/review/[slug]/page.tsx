import { AddToCart } from "../../cart/add-to-cart";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { isRxClinicalService } from "@/lib/products/rx-telehealth";
import { ArrowLeft, ArrowRight, LockKeyhole } from "lucide-react";
import { readCatalog } from "@/lib/products/catalog-reader";
import { requireRxCompany, rxBasePath, rxProductSelect } from "@/lib/products/rx-catalog";
import { formatCurrency } from "@/lib/products/catalog";
import { loadRxQuote } from "@/lib/orders/rx-quote-service";
import { rxReviewInput } from "@/lib/orders/rx-review-input";
import { RxProductImage } from "../../product-image";

export const metadata: Metadata = { title: "Review your selection" };

export default async function RxReviewPage({ params, searchParams }: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ quantity?: string | string[]; coupon?: string | string[] }>
}) {
  const company = await requireRxCompany();
  const [{ slug }, query, base] = await Promise.all([params, searchParams, rxBasePath()]);
  const { product, input, warning, quote } = await readCatalog(company.id, async (db, companyId) => {
  const product = await db.product.findFirst({ where: { companyId, slug, active: true }, select: rxProductSelect });
  if (!product) notFound();
  if (isRxClinicalService(product.category.name)) redirect(`${base}/telehealth`);
  const input = rxReviewInput(query);
  let warning = input.error;
  const intent = { items: [{ productId: product.id, quantity: input.quantity }], couponCode: warning ? "" : input.coupon };
  let quote;
  try {
    quote = (await loadRxQuote(db, companyId, intent)).publicQuote;
  } catch (error) {
    if (!(error instanceof Error) || !["INVALID_DISCOUNT", "DISCOUNT_NOT_APPLICABLE"].includes(error.message)) throw error;
    warning = "This coupon is unavailable or does not apply to your selection. No discount has been applied.";
    quote = (await loadRxQuote(db, companyId, { ...intent, couponCode: "" })).publicQuote;
  }
  return { product, input, warning, quote };
  });
  return <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
    <Link href={`${base}/products/${encodeURIComponent(slug)}`} className="inline-flex min-h-11 items-center gap-2 text-sm text-slate-500"><ArrowLeft className="h-4 w-4" aria-hidden="true" />Back to product</Link>
    <nav aria-label="Purchase progress" className="mt-5 flex flex-wrap gap-5 text-xs text-slate-400"><span aria-current="step" className="font-semibold text-clinic-navy">01 Selection</span><span>02 Your details · Coming soon</span><span>03 Payment · Coming soon</span></nav>
    <div className="mt-8 grid items-start gap-8 lg:grid-cols-[1.2fr_.8fr]">
      <section><p className="text-xs font-semibold uppercase tracking-widest text-clinic-blue">Your next step</p><h1 className="mt-3 text-3xl font-semibold tracking-tight text-clinic-navy">Review your selection.</h1><p className="mt-3 text-sm leading-6 text-slate-500">Adjust the quantity and review current catalog pricing before continuing.</p>
        <div className="mt-7 overflow-hidden rounded-3xl border border-slate-100"><div className="max-w-sm"><RxProductImage src={product.images[0]?.url} alt={product.images[0]?.alt} title={product.title} /></div><div className="p-6"><p className="text-xs text-clinic-blue">{product.category.name}</p><h2 className="mt-2 break-words text-xl font-semibold text-clinic-navy">{product.title}</h2><p className="mt-3 text-sm text-slate-500">{formatCurrency(product.priceCents)} per unit · One-time selection</p></div></div>
        <form action={`${base}/review/${encodeURIComponent(slug)}`} role="form" aria-label="Update your selection" className="mt-6 rounded-2xl border border-slate-100 p-6">
          {warning && <p role="alert" className="mb-5 rounded-xl bg-amber-50 p-4 text-sm leading-6 text-amber-900">{warning}</p>}
          <div className="grid gap-5 sm:grid-cols-[.45fr_1fr]"><label className="text-sm font-medium text-clinic-navy">Quantity<input type="number" name="quantity" min={1} max={100} step={1} required defaultValue={input.quantity} className="mt-2 h-12 w-full rounded-xl border border-slate-200 px-4" /></label><label className="text-sm font-medium text-clinic-navy">Coupon <span className="font-normal text-slate-400">(optional)</span><input name="coupon" maxLength={64} defaultValue={input.coupon} placeholder="Enter code" autoComplete="off" className="mt-2 h-12 w-full rounded-xl border border-slate-200 px-4" /></label></div><button className="mt-5 inline-flex min-h-12 items-center gap-3 rounded-full border border-slate-200 px-5 text-sm font-semibold text-clinic-navy">Update selection<ArrowRight className="h-4 w-4" aria-hidden="true" /></button>
        </form>
      </section>
      <aside aria-label="Selection summary" className="rounded-3xl border border-slate-100 bg-clinic-mist p-6 sm:p-8 lg:sticky lg:top-28"><h2 className="text-xl font-semibold text-clinic-navy">Selection summary</h2><div className="mt-6 space-y-4 text-sm"><div className="flex justify-between gap-4"><span className="text-slate-500">Product subtotal · {input.quantity} {input.quantity === 1 ? "unit" : "units"}</span><span className="font-medium text-clinic-navy">{formatCurrency(quote.subtotalCents)}</span></div><div className="flex justify-between gap-4"><span className="text-slate-500">Discount{quote.couponCode ? ` · ${quote.couponCode}` : ""}</span><span className="font-medium text-clinic-navy">−{formatCurrency(quote.discountCents)}</span></div><div className="flex justify-between gap-4 border-t border-slate-200 pt-5 text-lg"><span className="font-semibold text-clinic-navy">Total</span><span className="font-semibold text-clinic-navy">{formatCurrency(quote.totalCents)}</span></div></div><p className="mt-4 text-xs leading-5 text-slate-500">USD. Shipping and applicable taxes are included in the product price. Prices are revalidated against the current catalog before payment.</p><AddToCart productId={product.id} title={product.title} quantity={input.quantity} /><p className="rx-cart-note">Promo codes can be applied in the cart.</p><button disabled aria-describedby="ordering-status" className="mt-7 flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-slate-200 px-4 text-sm font-semibold text-slate-500"><LockKeyhole className="h-4 w-4" aria-hidden="true" />Checkout coming soon</button><p id="ordering-status" className="mt-3 text-xs leading-5 text-slate-500">No order, payment or reservation is created by this preview. Customer details and payment will open after launch verification.</p><Link href={`${base}/catalog#catalog`} className="mt-5 inline-flex min-h-11 items-center text-sm font-medium text-clinic-blue">Continue browsing</Link></aside>
    </div>
  </div>;
}
