import Link from "next/link";
import { MarketingHeader } from "@/components/layout/marketing-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { products } from "@/lib/mock-data";

export default function ShopPage() {
  return (
    <>
      <MarketingHeader />
      <main className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-clinic-red">Shop</p>
            <h1 className="mt-2 text-4xl font-semibold text-clinic-ink">Wellness programs and products</h1>
          </div>
          <Badge>Referral attribution ready</Badge>
        </div>
        <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {products.map((product) => (
            <Card key={product.slug} className="flex flex-col p-5">
              <div className="rounded-xl bg-clinic-mist p-5">
                <Badge>{product.category}</Badge>
                <p className="mt-8 text-3xl font-semibold text-clinic-navy">${product.price}</p>
              </div>
              <h2 className="mt-5 text-lg font-semibold text-clinic-ink">{product.title}</h2>
              <p className="mt-3 flex-1 text-sm leading-6 text-slate-600">{product.description}</p>
              <Link href={`/shop/${product.slug}`} className="mt-5">
                <Button className="w-full" variant="accent">View product</Button>
              </Link>
            </Card>
          ))}
        </div>
      </main>
    </>
  );
}
