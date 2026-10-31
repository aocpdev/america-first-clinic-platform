import Link from "next/link";
import { rxBasePath } from "@/lib/products/rx-catalog";

export default async function AccountNotFound() {
  const base = await rxBasePath();
  return <section className="mx-auto max-w-lg px-4 py-16"><h1 className="text-2xl font-semibold text-clinic-navy">Order unavailable</h1><p className="mt-4 text-sm leading-7 text-slate-500">We couldn’t find this order in your account.</p><Link href={`${base}/account`} className="mt-6 inline-flex min-h-12 items-center rounded-full bg-clinic-navy px-6 text-sm font-semibold text-white">Back to my orders</Link></section>;
}
