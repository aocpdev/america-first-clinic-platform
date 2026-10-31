import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, UserRound, MapPin, CreditCard } from "lucide-react";
import { requireRxCompany, rxBasePath } from "@/lib/products/rx-catalog";
import { loadRxCartView } from "@/lib/orders/rx-cart-view";
import { OrderSummary } from "../cart/order-summary";
import { randomUUID } from "node:crypto";
import { rxCheckoutCanCharge } from "@/lib/payments/rx-checkout-release";
import { requireCustomerSession } from "@/lib/customers/customer-session";
import { prisma } from "@/lib/db/prisma";
import { CheckoutShippingForm } from "./shipping-form";

export const metadata: Metadata = { title: "Checkout", robots: { index: false, follow: false } };

export default async function CheckoutPage() {
  const company = await requireRxCompany();
  const [base, view] = await Promise.all([rxBasePath(), loadRxCartView(company.id)]);
  if (!view.lines.length || !view.quote) redirect(`${base}/cart#cart`);
  if (rxCheckoutCanCharge()) {
    const customer = await requireCustomerSession();
    const address = await prisma.customerAddress.findFirst({ where: { customerId: customer.id, customer: { companyId: company.id }, country: "US" },
      orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }], select: { line1: true, line2: true, city: true, state: true, postalCode: true } });
    return <section id="checkout" className="rx-cart-page">
      <Link href={`${base}/cart#cart`} className="rx-cart-back"><ArrowLeft size={16} aria-hidden="true" />Back to your cart</Link>
      <h1>One step closer.</h1><p className="rx-cart-intro">Review your order and confirm your delivery details.</p>
      {view.warning && <p role="alert" className="rx-cart-warning">{view.warning}</p>}
      <div className="rx-cart-grid"><div className="rx-checkout-details">
        <section className="rx-checkout-step"><div className="rx-checkout-step-heading"><UserRound size={20} aria-hidden="true" /><h2>Your verified account</h2></div><p>{customer.firstName} · {customer.email}</p></section>
        <CheckoutShippingForm requestId={randomUUID()} totalCents={view.quote.totalCents} address={address} />
      </div><OrderSummary view={view} base={base} checkout paymentReady /></div>
    </section>;
  }
  return <section id="checkout" className="rx-cart-page">
    <Link href={`${base}/cart#cart`} className="rx-cart-back"><ArrowLeft size={16} aria-hidden="true" />Back to your cart</Link>
    <nav className="rx-checkout-progress" aria-label="Checkout progress"><Link href={`${base}/cart#cart`}>01 Cart</Link><span aria-current="step">02 Checkout preview</span><span>03 Payment · Not enabled</span></nav>
    <h1>Your next step.</h1><p className="rx-cart-intro">Everything in one place. Review your selection and the checkout steps.</p>
    <p className="rx-cart-warning" role="status">Checkout preview: customer details and payment are not enabled. No personal information is collected or saved here.</p>
    {view.warning && <p role="alert" className="rx-cart-warning">{view.warning}</p>}
    <div className="rx-cart-grid"><div className="rx-checkout-details">
      <section className="rx-checkout-step"><div className="rx-checkout-step-heading"><UserRound size={20} aria-hidden="true" /><div><p className="rx-home-eyebrow">01 / Account</p><h2>Your details</h2></div><span>Coming soon</span></div><p>Verified customer access will connect your order history and the seller who originally referred you.</p><fieldset disabled aria-label="Customer details preview"><legend className="sr-only">Customer details · Not enabled</legend><label>Full name<input placeholder="Your full name" autoComplete="off" /></label><label>Email address<input type="email" placeholder="you@example.com" autoComplete="off" /></label></fieldset></section>
      <section className="rx-checkout-step"><div className="rx-checkout-step-heading"><MapPin size={20} aria-hidden="true" /><div><p className="rx-home-eyebrow">02 / Delivery</p><h2>Shipping details</h2></div><span>Coming soon</span></div><p>Confirm your delivery address for products that require shipping. Clinical services do not require delivery.</p><fieldset disabled aria-label="Shipping details preview"><legend className="sr-only">Shipping details · Not enabled</legend><label className="rx-checkout-full">Address<input placeholder="Street address" autoComplete="off" /></label><label>City<input placeholder="City" autoComplete="off" /></label><label>ZIP code<input placeholder="ZIP code" autoComplete="off" /></label></fieldset></section>
      <section className="rx-checkout-step"><div className="rx-checkout-step-heading"><CreditCard size={20} aria-hidden="true" /><div><p className="rx-home-eyebrow">03 / Payment</p><h2>Review & pay</h2></div><span>Not enabled</span></div><p>Final charges and any required clinical steps must be confirmed before payment. This preview does not collect card or bank details.</p></section>
    </div><OrderSummary view={view} base={base} checkout /></div>
  </section>;
}
