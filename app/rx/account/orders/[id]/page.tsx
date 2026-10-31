import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ShoppingBag, Truck, ArrowUpRight } from "lucide-react";
import { prisma } from "@/lib/db/prisma";
import { requireCustomerSession } from "@/lib/customers/customer-session";
import { getCustomerOrder } from "@/lib/customers/customer-orders";
import { rxBasePath } from "@/lib/products/rx-catalog";
import { carrierLabel, carrierTrackingUrl } from "@/lib/orders/tracking";

export const metadata = { title: "Order details" };
const money = (cents: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
const label = (value: string) => value.toLowerCase().replaceAll("_", " ");

export default async function OrderDetails({ params }: { params: Promise<{ id: string }> }) {
  const customer = await requireCustomerSession();
  const { id } = await params;
  const order = await getCustomerOrder(prisma, customer, id);
  if (!order) notFound();
  const base = await rxBasePath();
  const trackingCode = order.shippingTrackingCode?.trim() || null;
  const trackingUrl = carrierTrackingUrl(order.shippingCarrier, trackingCode);
  const summary = [
    ["Subtotal", money(order.subtotalCents)],
    ["Discount", order.discountCents ? `−${money(order.discountCents)}` : money(0)],
    ["Shipping", money(order.shippingCents)],
    ["Tax", money(order.taxCents)]
  ];
  return (
    <section className="mx-auto max-w-3xl px-4 py-10 sm:px-6" data-clarity-mask="true">
      <Link href={`${base}/account`} className="inline-flex min-h-11 items-center gap-2 text-sm text-slate-500">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />My orders
      </Link>
      <p className="mt-6 text-xs font-semibold uppercase tracking-widest text-clinic-blue">Purchase details</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight text-clinic-navy">Order #{order.id.slice(0, 8).toUpperCase()}</h1>
      <p className="mt-3 text-sm text-slate-500">{order.createdAt.toLocaleDateString("en-US", { timeZone: "UTC", month: "long", day: "numeric", year: "numeric" })}</p>
      <div className="mt-5 flex flex-wrap gap-2 text-xs capitalize">
        <span className="rounded-full bg-clinic-mist px-3 py-2">Order: {label(order.orderStatus)}</span>
        <span className="rounded-full bg-slate-50 px-3 py-2">Payment: {label(order.paymentStatus)}</span>
      </div>
      <div className="mt-7 rounded-2xl border bg-clinic-mist/40 p-5 sm:p-7">
        <h2 className="flex items-center gap-3 text-lg font-semibold text-clinic-navy"><Truck className="h-5 w-5" aria-hidden="true" />Shipping & tracking</h2>
        {trackingCode || order.shippedAt ? <>
          <dl className="mt-5 space-y-4 text-sm">
            {trackingCode && <><div><dt className="text-xs text-slate-500">Carrier</dt><dd className="mt-1 break-words font-medium">{carrierLabel(order.shippingCarrier)}</dd></div><div><dt className="text-xs text-slate-500">Tracking number</dt><dd className="mt-1 break-all font-medium">{trackingCode}</dd></div></>}
            {order.shippedAt && <div><dt className="text-xs text-slate-500">Shipment date</dt><dd className="mt-1 font-medium">{order.shippedAt.toLocaleDateString("en-US", { timeZone: "UTC", month: "long", day: "numeric", year: "numeric" })}</dd></div>}
          </dl>
          {!trackingCode && <p className="mt-4 text-sm leading-6 text-slate-500">No tracking number is currently available for this shipment.</p>}
          {trackingUrl && <a href={trackingUrl} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer" className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-full border border-clinic-navy/15 bg-white px-5 text-sm font-semibold text-clinic-navy">Track shipment<ArrowUpRight className="h-4 w-4" aria-hidden="true" /><span className="sr-only"> (opens carrier website in a new tab)</span></a>}
          {trackingUrl && <p className="mt-3 text-xs leading-6 text-slate-500">Visit the carrier website for the latest delivery updates.</p>}
        </> : <p className="mt-4 text-sm leading-6 text-slate-500">Tracking will appear here when shipping information is added to your order.</p>}
      </div>
      <div className="mt-7 rounded-2xl border bg-white p-5 sm:p-7">
        <h2 className="text-lg font-semibold text-clinic-navy">Your products</h2>
        <ul className="mt-5 divide-y">
          {order.items.map(item => <li key={item.id} className="flex justify-between gap-4 py-4">
            <div className="min-w-0"><p className="break-words font-medium text-clinic-navy">{item.product.title}</p><p className="mt-2 text-xs text-slate-500">Quantity {item.quantity} · {money(item.unitPriceCents)} each</p></div>
            <p className="shrink-0 text-sm font-medium">{money(item.totalCents)}</p>
          </li>)}
        </ul>
        <dl className="mt-5 space-y-3 border-t pt-5 text-sm">
          {summary.map(([title, amount]) => <div key={title} className="flex justify-between gap-4"><dt className="text-slate-500">{title}</dt><dd>{amount}</dd></div>)}
          <div className="flex justify-between gap-4 border-t pt-4 text-lg font-semibold text-clinic-navy"><dt>Order total</dt><dd>{money(order.totalCents)}</dd></div>
        </dl>
      </div>
      <p className="mt-4 text-xs leading-6 text-slate-500">Amounts come from your saved order. This summary is not a tax invoice or confirmation of a new payment.</p>
      <Link href={`${base}/catalog#catalog`} className="mt-7 inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-clinic-navy px-6 text-sm font-semibold text-white"><ShoppingBag className="h-4 w-4" aria-hidden="true" />Explore products</Link>
      <p className="mt-4 text-xs leading-6 text-slate-500">New online purchases are not enabled yet.</p>
    </section>
  );
}
