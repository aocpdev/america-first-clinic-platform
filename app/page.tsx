import Link from "next/link";
import { ArrowRight, BadgeCheck, BarChart3, CreditCard, ShieldCheck, Users } from "lucide-react";
import { MarketingHeader } from "@/components/layout/marketing-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { products } from "@/lib/mock-data";

export default function HomePage() {
  return (
    <>
      <MarketingHeader />
      <main>
        <section className="grid-paper relative overflow-hidden">
          <div className="mx-auto grid min-h-[calc(100vh-5rem)] max-w-7xl items-center gap-12 px-4 py-16 sm:px-6 lg:grid-cols-[1.05fr_.95fr] lg:px-8">
            <div>
              <Badge className="border-clinic-red/20 bg-clinic-blush text-clinic-red">Healthcare CRM + consultant commerce</Badge>
              <h1 className="mt-6 max-w-4xl text-5xl font-semibold tracking-normal text-clinic-ink sm:text-6xl lg:text-7xl">
                America First Clinic
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600">
                A production-ready SaaS platform for wellness sales teams: CRM, eCommerce, subscriptions,
                commissions, referrals, analytics, and payment-provider flexibility from day one.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link href="/admin/dashboard">
                  <Button size="lg" variant="accent">
                    View admin dashboard
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
                <Link href="/consultant/dashboard">
                  <Button size="lg" variant="outline">Open consultant workspace</Button>
                </Link>
              </div>
            </div>
            <Card className="relative overflow-hidden p-5 shadow-soft">
              <div className="absolute right-0 top-0 h-24 w-24 bg-clinic-red/10" />
              <div className="rounded-xl border border-border bg-clinic-mist p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-500">Monthly revenue</p>
                    <p className="mt-2 text-4xl font-semibold text-clinic-navy">$104,500</p>
                  </div>
                  <BarChart3 className="h-10 w-10 text-clinic-red" />
                </div>
                <div className="mt-5 h-3 rounded-full bg-white">
                  <div className="h-3 w-[78%] rounded-full bg-clinic-red" />
                </div>
              </div>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                {[
                  ["Payment agnostic", CreditCard],
                  ["RLS secured", ShieldCheck],
                  ["Consultant CRM", Users],
                  ["Commission engine", BadgeCheck]
                ].map(([label, Icon]) => (
                  <div key={String(label)} className="rounded-xl border border-border bg-white p-4">
                    <Icon className="h-5 w-5 text-clinic-blue" />
                    <p className="mt-4 text-sm font-semibold text-clinic-ink">{String(label)}</p>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </section>
        <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.18em] text-clinic-red">Commerce catalog</p>
              <h2 className="mt-2 text-3xl font-semibold text-clinic-ink">Built for wellness programs and recurring care</h2>
            </div>
            <Link href="/shop">
              <Button variant="outline">Browse products</Button>
            </Link>
          </div>
          <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {products.map((product) => (
              <Card key={product.slug} className="p-5">
                <Badge>{product.category}</Badge>
                <h3 className="mt-5 text-lg font-semibold text-clinic-ink">{product.title}</h3>
                <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-600">{product.description}</p>
                <p className="mt-5 text-2xl font-semibold text-clinic-navy">${product.price}</p>
              </Card>
            ))}
          </div>
        </section>
      </main>
    </>
  );
}
