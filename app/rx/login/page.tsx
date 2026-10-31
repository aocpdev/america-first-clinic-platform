import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ClipboardList, ShoppingBag, UserRound } from "lucide-react";
import { rxBasePath } from "@/lib/products/rx-catalog";
import { redirect } from "next/navigation";
import { getCustomerSession } from "@/lib/customers/customer-session";
import { CustomerLoginForm } from "./form";

export const metadata: Metadata = { title: "Customer account" };

export default async function CustomerLoginPreview() {
  const base = await rxBasePath();
  if (process.env.CUSTOMER_PORTAL_ENABLED === "true") {
    if (await getCustomerSession()) redirect(`${base}/account`);
    return <section className="mx-auto max-w-lg px-4 py-12 sm:py-20"><Link href={base || "/"} className="inline-flex min-h-11 items-center gap-2 text-sm text-slate-500"><ArrowLeft className="h-4 w-4" aria-hidden="true" />Back to the shop</Link><div className="mt-5 rounded-3xl border bg-white p-6 sm:p-10"><p className="text-xs font-semibold uppercase tracking-widest text-clinic-blue">Your RX account</p><h1 className="mt-3 text-3xl font-semibold tracking-tight text-clinic-navy">Welcome back.</h1><p className="mt-4 text-sm leading-6 text-slate-500">Sign in to view your purchases and explore the shop.</p><CustomerLoginForm /><p className="mt-6 text-xs leading-6 text-slate-500">Pilot access is available only for verified, linked customer accounts. Existing purchases are not linked automatically.</p></div></section>;
  }
  return <section className="mx-auto max-w-5xl px-4 py-12 sm:px-6 sm:py-20"><Link href={base || "/"} className="inline-flex min-h-11 items-center gap-2 text-sm text-slate-500"><ArrowLeft className="h-4 w-4" aria-hidden="true" />Back to the shop</Link><div className="mt-6 grid overflow-hidden rounded-3xl border border-slate-100 bg-white md:grid-cols-2"><div className="bg-clinic-mist p-7 sm:p-10"><span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white"><UserRound className="h-5 w-5 text-clinic-blue" aria-hidden="true" /></span><p className="mt-6 text-xs font-semibold uppercase tracking-widest text-clinic-blue">Your RX account</p><h1 className="mt-3 text-3xl font-semibold tracking-tight text-clinic-navy">Your wellness.<br />All in one place.</h1><p className="mt-5 text-sm leading-7 text-slate-500">A dedicated space for your purchases and account, separate from our consultant platform.</p><div className="mt-8 space-y-4 text-sm text-clinic-navy"><p className="flex items-center gap-3"><ClipboardList className="h-4 w-4" aria-hidden="true" />Order history — planned</p><p className="flex items-center gap-3"><ShoppingBag className="h-4 w-4" aria-hidden="true" />Shop and buy again — planned</p></div></div><div className="flex flex-col justify-center p-7 sm:p-10"><p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Coming soon</p><h2 className="mt-3 text-2xl font-semibold tracking-tight text-clinic-navy">Customer login is being prepared.</h2><p className="mt-5 text-sm leading-7 text-slate-500">Account access is not available in this preview. No account is created and no login information is collected here.</p><p className="mt-4 text-sm leading-7 text-slate-500">Existing purchase history will require verified account activation before it can be shown.</p><Link href={`${base}/catalog#catalog`} className="mt-7 inline-flex min-h-12 items-center justify-center rounded-full bg-clinic-navy px-6 text-sm font-semibold text-white">Continue exploring</Link></div></div></section>;
}
