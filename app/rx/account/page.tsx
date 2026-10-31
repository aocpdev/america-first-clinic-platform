import Link from "next/link";
import { ShoppingBag } from "lucide-react";
import { prisma } from "@/lib/db/prisma";
import { requireCustomerSession } from "@/lib/customers/customer-session";
import { rxBasePath } from "@/lib/products/rx-catalog";
import { rxPageNumber } from "@/lib/products/rx-routing";
import { signOutCustomer } from "../login/actions";
import { listCustomerOrders } from "@/lib/customers/customer-orders";
import { CustomerSmsForm } from "./sms-form";

export const metadata = { title: "My orders" };
const money = (cents: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
const label = (value: string) => value.toLowerCase().replaceAll("_", " ");

export default async function CustomerAccount({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const customer = await requireCustomerSession();
  const base = await rxBasePath();
  const where = { companyId: customer.companyId, customerId: customer.id };
  const total = await prisma.order.count({ where });
  const pages = Math.max(1, Math.ceil(total / 12));
  const page = rxPageNumber((await searchParams).page, pages);
  const orders = await listCustomerOrders(prisma, customer, page);
  return <section className="mx-auto max-w-4xl px-4 py-10 sm:px-6" data-clarity-mask="true"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-widest text-clinic-blue">Your RX account</p><h1 className="mt-3 text-3xl font-semibold tracking-tight text-clinic-navy">My orders</h1><p className="mt-3 break-all text-sm text-slate-500">{customer.email}</p></div><form action={signOutCustomer}><button className="min-h-11 rounded-full border px-5 text-sm font-medium" type="submit">Sign out</button></form></div><Link href={`${base}/catalog#catalog`} className="mt-6 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-clinic-blue"><ShoppingBag className="h-4 w-4" aria-hidden="true" />Explore products</Link><div className="mt-6 space-y-4">{orders.map(order => <article key={order.id} className="rounded-2xl border bg-white p-5 sm:p-6"><div className="flex flex-wrap justify-between gap-3"><div><h2 className="font-semibold text-clinic-navy">Order #{order.id.slice(0, 8).toUpperCase()}</h2><p className="mt-1 text-xs text-slate-500">{order.createdAt.toLocaleDateString("en-US", { timeZone: "UTC", month: "short", day: "numeric", year: "numeric" })}</p></div><p className="font-semibold text-clinic-navy">{money(order.totalCents)}</p></div><ul className="mt-5 space-y-2 text-sm">{order.items.map((item, index) => <li key={index} className="flex justify-between gap-4"><span>{item.quantity} × {item.product.title}</span><span className="shrink-0">{money(item.totalCents)}</span></li>)}</ul><div className="mt-5 flex flex-wrap gap-2 text-xs capitalize"><span className="rounded-full bg-clinic-mist px-3 py-2">Order: {label(order.orderStatus)}</span><span className="rounded-full bg-slate-50 px-3 py-2">Payment: {label(order.paymentStatus)}</span></div><Link href={`${base}/account/orders/${order.id}`} aria-label={`View order ${order.id.slice(0, 8).toUpperCase()}`} className="mt-4 inline-flex min-h-11 items-center text-sm font-semibold text-clinic-blue">View details</Link></article>)}{!orders.length && <div className="rounded-2xl border bg-white p-8"><h2 className="font-semibold text-clinic-navy">No orders yet</h2><p className="mt-3 text-sm leading-6 text-slate-500">Your verified purchase history will appear here. If you purchased before account activation, contact support to verify the connection.</p></div>}</div>{pages > 1 && <nav aria-label="Order pages" className="mt-6 flex items-center justify-between text-sm">{page > 1 ? <Link className="min-h-11 p-3" href={`${base}/account?page=${page - 1}`}>Previous</Link> : <span />}<span>Page {page} of {pages}</span>{page < pages ? <Link className="min-h-11 p-3" href={`${base}/account?page=${page + 1}`}>Next</Link> : <span />}</nav>}<CustomerSmsForm /><p className="mt-8 text-xs leading-6 text-slate-500">Private account preview. New online purchases are not enabled yet.</p></section>;
}
