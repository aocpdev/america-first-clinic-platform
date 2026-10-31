import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ArrowRight, ShoppingBag, Trash2 } from "lucide-react";
import { requireRxCompany, rxBasePath } from "@/lib/products/rx-catalog";
import { formatCurrency } from "@/lib/products/catalog";
import { loadRxCartView } from "@/lib/orders/rx-cart-view";
import { RxProductImage } from "../product-image";
import { setCartQuantity, removeCartItem } from "./actions";
import { CartSubmit } from "./cart-submit";
import { OrderSummary } from "./order-summary";

export const metadata: Metadata = { title: "Your cart", robots: { index: false, follow: false } };
const messages: Record<string, string> = { added: "Added to your cart.", updated: "Your cart has been updated.", removed: "Product removed from your cart.", limit: "Choose a quantity from 1 to 100. Your cart can hold up to 25 different products.", unavailable: "This product is no longer available.", coupon: "Enter a promo code of no more than 64 characters." };

export default async function CartPage({ searchParams }: { searchParams: Promise<{ notice?: string }> }) {
  const company = await requireRxCompany();
  const [base, params, view] = await Promise.all([rxBasePath(), searchParams, loadRxCartView(company.id)]);
  const notice = typeof params.notice === "string" && Object.hasOwn(messages, params.notice) ? messages[params.notice] : undefined;
  return <section id="cart" className="rx-cart-page">
    <Link className="rx-cart-back" href={`${base}/catalog#catalog`}><ArrowLeft size={16} aria-hidden="true" />Back to the catalog</Link>
    <p className="rx-home-eyebrow">Your selection</p><h1>Your cart.</h1><p className="rx-cart-intro">A considered next step. Review your products before continuing.</p>
    {notice && <p role="status" className="rx-cart-status">{notice}</p>}{view.warning && <p role="alert" className="rx-cart-warning">{view.warning}</p>}
    {!view.lines.length ? <div className="rx-cart-empty"><ShoppingBag size={36} strokeWidth={1.3} aria-hidden="true" /><h2>A little space for your next step.</h2><p>Your cart is empty. Explore the collection and find what interests you.</p><Link href={`${base}/catalog#catalog`} className="rx-home-primary">Explore the catalog <ArrowRight size={17} aria-hidden="true" /></Link></div> : <div className="rx-cart-grid">
      <div><ul className="rx-cart-lines">{view.lines.map(line => <li key={line.productId} className="rx-cart-line">
        <div className="rx-cart-line-image"><RxProductImage src={line.product?.images[0]?.url} alt={line.product?.images[0]?.alt} title={line.product?.title ?? "Unavailable product"} /></div>
        <div className="rx-cart-line-copy"><p className="rx-home-eyebrow">{line.product?.category.name ?? "Review selection"}</p><h2>{line.product?.active ? <Link href={`${base}/products/${encodeURIComponent(line.product.slug)}`}>{line.product.title}</Link> : line.product?.title ?? "Unavailable product"}</h2>
          {line.product?.active ? <p className="rx-cart-unit-price">{formatCurrency(line.product.priceCents)} / unit</p> : <p className="rx-cart-unavailable">No longer available</p>}
          <div className="rx-cart-line-controls">{line.product?.active && <form action={setCartQuantity} aria-label={`Update quantity for ${line.product.title}`}><input type="hidden" name="productId" value={line.productId} /><label>Qty<input name="quantity" type="number" min="1" max="100" step="1" required defaultValue={line.quantity} key={line.quantity} aria-label={`Quantity for ${line.product.title}`} /></label><CartSubmit className="rx-cart-small-button">Update</CartSubmit></form>}<form action={removeCartItem}><input type="hidden" name="productId" value={line.productId} /><CartSubmit className="rx-cart-remove" pendingText="Removing…"><Trash2 size={15} aria-hidden="true" /><span>Remove<span className="sr-only"> {line.product?.title ?? "unavailable product"}</span></span></CartSubmit></form></div>
        </div><p className="rx-cart-line-total">{line.product?.active ? formatCurrency(line.product.priceCents * line.quantity) : "—"}</p>
      </li>)}</ul><p className="rx-cart-note">Your cart stores product selections for this browser session. Adding a product does not establish clinical eligibility or reserve inventory.</p></div>
      <OrderSummary view={view} base={base} />
    </div>}
  </section>;
}
