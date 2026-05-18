import Link from "next/link";
import { notFound } from "next/navigation";
import { MarketingHeader } from "@/components/layout/marketing-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { prisma } from "@/lib/db/prisma";
import { formatCurrency } from "@/lib/products/catalog";

export const dynamic = "force-dynamic";

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = await prisma.product.findFirst({
    where: {
      slug,
      active: true,
      company: { slug: "america-first-clinic" }
    },
    include: {
      category: true,
      inventory: true,
      images: {
        orderBy: { sortOrder: "asc" },
        take: 1
      }
    }
  });

  if (!product) notFound();

  return (
    <>
      <MarketingHeader />
      <main className="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:px-6 lg:grid-cols-[.9fr_1.1fr] lg:px-8">
        <Card className="min-h-[420px] overflow-hidden bg-clinic-mist">
          {product.images[0] ? (
            <img src={product.images[0].url} alt={product.images[0].alt ?? product.title} className="h-64 w-full object-cover" />
          ) : (
            <div className="h-64 bg-clinic-mist" />
          )}
          <div className="p-6">
          <Badge>{product.category.name}</Badge>
          <div className="mt-20 rounded-xl bg-white p-6 shadow-soft">
            <p className="text-sm font-semibold text-slate-500">Program price</p>
            <p className="mt-2 text-3xl font-semibold text-clinic-red">{formatCurrency(product.priceCents)}</p>
            <p className="mt-4 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              {product.supportsSubscription ? "Subscription ready" : "One-time checkout"}
            </p>
          </div>
          </div>
        </Card>
        <div>
          <h1 className="text-4xl font-semibold text-clinic-ink">{product.title}</h1>
          <p className="mt-5 text-lg leading-8 text-slate-600">{product.description}</p>
          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            <Card className="p-4"><p className="text-xs text-slate-500">Price</p><p className="mt-1 font-semibold text-clinic-ink">{formatCurrency(product.priceCents)}</p></Card>
            <Card className="p-4"><p className="text-xs text-slate-500">Inventory</p><p className="mt-1 font-semibold text-clinic-ink">{product.inventory?.quantityOnHand ?? 0}</p></Card>
            <Card className="p-4"><p className="text-xs text-slate-500">Recurring</p><p className="mt-1 font-semibold text-clinic-ink">{product.supportsRecurring ? "Supported" : "One-time"}</p></Card>
          </div>
          <Link href="/checkout">
            <Button size="lg" className="mt-8" variant="accent">Continue to secure checkout</Button>
          </Link>
        </div>
      </main>
    </>
  );
}
