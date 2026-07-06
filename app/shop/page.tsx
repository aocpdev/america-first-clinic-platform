import Link from "next/link";
import { MarketingHeader } from "@/components/layout/marketing-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { prisma } from "@/lib/db/prisma";
import { formatCurrency } from "@/lib/products/catalog";

export const dynamic = "force-dynamic";

export default async function ShopPage() {
  const company = await prisma.company.findUnique({
    where: { slug: "america-first-clinic" },
    select: { id: true }
  });

  const products = company
    ? await prisma.product.findMany({
        where: {
          companyId: company.id,
          active: true
        },
        include: {
          category: true,
          inventory: true,
          images: {
            orderBy: { sortOrder: "asc" },
            take: 1
          }
        },
        orderBy: { title: "asc" }
      })
    : [];

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
              <div className="overflow-hidden rounded-xl bg-clinic-mist">
                {product.images[0] ? (
                  <img src={product.images[0].url} alt={product.images[0].alt ?? product.title} className="h-40 w-full object-cover" />
                ) : (
                  <div className="h-40 w-full bg-clinic-mist" />
                )}
                <div className="p-5">
                <Badge>{product.category.name}</Badge>
                <p className="mt-8 text-3xl font-semibold text-clinic-navy">{formatCurrency(product.priceCents)}</p>
                </div>
              </div>
              <h2 className="mt-5 text-lg font-semibold text-clinic-ink">{product.title}</h2>
              <p className="mt-3 flex-1 text-sm leading-6 text-slate-600">{product.description}</p>
              <div className="mt-5 flex items-center justify-between text-xs font-semibold text-slate-500">
                <span>{product.supportsRecurring ? "Recurring ready" : "One-time purchase"}</span>
                <span>{product.inventory?.quantityOnHand ?? 0} available</span>
              </div>
              <Link href={`/shop/${product.slug}`} className="mt-5">
                <Button className="w-full" variant="accent">View product</Button>
              </Link>
            </Card>
          ))}
        </div>
        {products.length === 0 && (
          <Card className="mt-8 p-8 text-center">
            <h2 className="text-xl font-semibold text-clinic-ink">The catalog is being prepared</h2>
            <p className="mt-2 text-slate-600">Products added by Go Virtual Health will appear here automatically.</p>
          </Card>
        )}
      </main>
    </>
  );
}
