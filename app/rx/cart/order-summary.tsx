import Link from "next/link";
import { ArrowRight, LockKeyhole } from "lucide-react";
import { formatCurrency } from "@/lib/products/catalog";
import type { loadRxCartView } from "@/lib/orders/rx-cart-view";
import { applyCartCoupon } from "./actions";
import { CartSubmit } from "./cart-submit";

type CartView = Awaited<ReturnType<typeof loadRxCartView>>;
export function OrderSummary({ view, base, checkout = false, paymentReady = false }: { view: CartView; base: string; checkout?: boolean; paymentReady?: boolean }) {
  const { quote, cart } = view;
  const unitCount = quote?.items.reduce((sum, item) => sum + item.quantity, 0) ?? 0;
  return <aside className="rx-cart-summary" aria-label="Order summary">
    <p className="rx-home-eyebrow">At a glance</p><h2>Order summary</h2>
    {checkout && <ul className="rx-checkout-items">{view.lines.map(line => <li key={line.productId}><span>{line.quantity} × {line.product?.title ?? "Unavailable product"}</span><strong>{line.product && formatCurrency(line.product.priceCents * line.quantity)}</strong></li>)}</ul>}
    {quote ? <dl><div><dt>Products · {unitCount} {unitCount === 1 ? "unit" : "units"}</dt><dd>{formatCurrency(quote.subtotalCents)}</dd></div><div><dt>Discount{quote.couponCode ? ` · ${quote.couponCode}` : ""}</dt><dd>−{formatCurrency(quote.discountCents)}</dd></div><div><dt>Shipping</dt><dd>Included</dd></div><div><dt>Tax</dt><dd>Included</dd></div><div className="rx-cart-total"><dt>Total</dt><dd>{formatCurrency(quote.totalCents)}</dd></div></dl> : <p className="rx-cart-note">Pricing is unavailable until the items in your cart are reviewed.</p>}
    {!checkout && <details className="rx-cart-coupon"><summary>Have a promo code?</summary><form action={applyCartCoupon}><label><span className="sr-only">Promo code</span><input name="coupon" defaultValue={cart.couponCode} key={cart.couponCode} maxLength={64} placeholder="Enter code" autoComplete="off" /></label><CartSubmit className="rx-cart-small-button" pendingText="Applying…">Apply</CartSubmit></form></details>}
    <p className="rx-cart-note">USD. Shipping and applicable taxes are included in the product price. No additional shipping or tax charges at checkout.</p>
    {checkout ? paymentReady ? <p className="rx-cart-note">Confirm your delivery details to continue to secure payment.</p> : <><button disabled className="rx-cart-payment-disabled" aria-describedby="rx-payment-status"><LockKeyhole size={16} aria-hidden="true" />Payment not enabled</button><p id="rx-payment-status" className="rx-cart-note">Preview only. No payment, order or reservation is created.</p></> : quote ? <Link href={`${base}/checkout#checkout`} className="rx-home-primary">Continue to checkout <ArrowRight size={17} aria-hidden="true" /></Link> : <button disabled className="rx-cart-payment-disabled">Review your cart to continue</button>}
    <Link href={`${base}/catalog#catalog`} className="rx-cart-continue">Continue shopping</Link>
  </aside>;
}
