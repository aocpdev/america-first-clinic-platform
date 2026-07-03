"use client";

import { useMemo, useState } from "react";
import { Activity, DollarSign, Eye, Package, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatCurrency, formatPercentBps } from "@/lib/products/catalog";

type PartnerProduct = {
  id: string;
  title: string;
  description: string;
  sku: string;
  categoryName: string;
  priceCents: number;
  internalCostCents: number;
  marginBps: number;
  active: boolean;
  supportsSubscription: boolean;
  supportsRecurring: boolean;
  image: {
    url: string;
    alt: string | null;
  } | null;
  attributedRevenueCents: number;
  attributedUnitsSold: number;
  salesGuide: {
    benefits: string[];
    talkingPoints: string[];
    commonObjections: string[];
    callNotes: string;
  };
};

function DetailBlock({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-2xl border border-border bg-white p-4">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">{title}</p>
      {items.length > 0 ? (
        <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-600">
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-slate-500">No details added yet.</p>
      )}
    </div>
  );
}

export function PartnerProductsClient({
  products,
  revenueCents,
  unitsSold
}: {
  products: PartnerProduct[];
  revenueCents: number;
  unitsSold: number;
}) {
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const selectedProduct = useMemo(
    () => products.find((product) => product.id === selectedProductId) ?? null,
    [products, selectedProductId]
  );
  const activeProducts = products.filter((product) => product.active).length;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="p-5">
          <div className="flex items-center gap-2 text-slate-500">
            <Package className="h-4 w-4" />
            <p className="text-xs font-bold uppercase tracking-[0.16em]">Active products</p>
          </div>
          <p className="mt-3 text-3xl font-semibold text-clinic-navy">{activeProducts}</p>
        </Card>
        <Card className="p-5">
          <div className="flex items-center gap-2 text-slate-500">
            <DollarSign className="h-4 w-4" />
            <p className="text-xs font-bold uppercase tracking-[0.16em]">Attributed revenue</p>
          </div>
          <p className="mt-3 text-3xl font-semibold text-clinic-navy">{formatCurrency(revenueCents)}</p>
        </Card>
        <Card className="p-5">
          <div className="flex items-center gap-2 text-slate-500">
            <Activity className="h-4 w-4" />
            <p className="text-xs font-bold uppercase tracking-[0.16em]">Units sold</p>
          </div>
          <p className="mt-3 text-3xl font-semibold text-clinic-navy">{unitsSold}</p>
        </Card>
      </div>

      <section className="rounded-3xl border border-border bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <Badge className="border-blue-100 bg-blue-50 text-clinic-navy">Partner catalog</Badge>
            <h2 className="mt-4 text-2xl font-semibold text-clinic-ink">Product visibility</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              Review active catalog items, pricing, margin, and product details. Sales figures only include agents assigned to your partner profile.
            </p>
          </div>
        </div>

        {products.length > 0 ? (
          <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {products.map((product) => (
              <button
                key={product.id}
                type="button"
                onClick={() => setSelectedProductId(product.id)}
                className="group overflow-hidden rounded-2xl border border-border bg-white text-left shadow-sm transition hover:-translate-y-0.5 hover:border-clinic-navy/25 hover:shadow-xl"
              >
                <div className="relative aspect-[4/3] bg-clinic-mist">
                  {product.image ? (
                    <img src={product.image.url} alt={product.image.alt ?? product.title} className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-sm font-semibold text-slate-400">No image</div>
                  )}
                  <div className="absolute left-3 top-3">
                    <Badge className={product.active ? "border-emerald-200 bg-white/95 text-emerald-700" : "border-slate-200 bg-white/95 text-slate-600"}>
                      {product.active ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                </div>
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="line-clamp-2 min-h-10 text-sm font-semibold leading-5 text-clinic-ink">{product.title}</p>
                      <p className="mt-1 text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">{product.categoryName}</p>
                    </div>
                    <Eye className="mt-1 h-4 w-4 shrink-0 text-slate-400 transition group-hover:text-clinic-navy" />
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-3 rounded-2xl bg-clinic-mist p-3 text-sm">
                    <div>
                      <p className="text-xs text-slate-500">Price</p>
                      <p className="font-semibold text-clinic-ink">{formatCurrency(product.priceCents)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Cost</p>
                      <p className="font-semibold text-clinic-ink">{formatCurrency(product.internalCostCents)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Margin</p>
                      <p className="font-semibold text-clinic-navy">{formatPercentBps(product.marginBps)}</p>
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="mt-6 rounded-2xl border border-dashed border-border bg-clinic-mist p-10 text-center">
            <p className="font-semibold text-clinic-ink">No products are visible yet.</p>
            <p className="mt-2 text-sm text-slate-500">Products will appear after the admin activates them in the catalog.</p>
          </div>
        )}
      </section>

      {selectedProduct ? (
        <div className="fixed inset-0 z-50 flex items-end bg-clinic-navy/30 p-0 backdrop-blur-sm sm:items-center sm:p-6">
          <div className="mx-auto max-h-[92vh] w-full max-w-5xl overflow-hidden rounded-t-3xl border border-white/70 bg-white shadow-[0_24px_80px_rgba(7,55,99,0.18)] sm:rounded-3xl">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Product details</p>
                <h3 className="mt-1 text-xl font-semibold text-clinic-ink">{selectedProduct.title}</h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedProductId(null)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border bg-white text-slate-500 transition hover:bg-clinic-mist hover:text-clinic-ink"
                aria-label="Close product details"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="grid max-h-[calc(92vh-82px)] gap-6 overflow-y-auto p-5 lg:grid-cols-[320px_1fr]">
              <div className="space-y-4">
                <div className="overflow-hidden rounded-3xl border border-border bg-clinic-mist">
                  <div className="aspect-square">
                    {selectedProduct.image ? (
                      <img src={selectedProduct.image.url} alt={selectedProduct.image.alt ?? selectedProduct.title} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-sm font-semibold text-slate-400">No image</div>
                    )}
                  </div>
                </div>
                <div className="rounded-2xl border border-border bg-clinic-mist p-4">
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Commercial summary</p>
                  <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-slate-500">Price</p>
                      <p className="font-semibold text-clinic-ink">{formatCurrency(selectedProduct.priceCents)}</p>
                    </div>
                    <div>
                      <p className="text-slate-500">Internal cost</p>
                      <p className="font-semibold text-clinic-ink">{formatCurrency(selectedProduct.internalCostCents)}</p>
                    </div>
                    <div>
                      <p className="text-slate-500">Gross margin</p>
                      <p className="font-semibold text-clinic-navy">{formatPercentBps(selectedProduct.marginBps)}</p>
                    </div>
                    <div>
                      <p className="text-slate-500">Partner sales</p>
                      <p className="font-semibold text-clinic-ink">{formatCurrency(selectedProduct.attributedRevenueCents)}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="rounded-2xl border border-border bg-white p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge>{selectedProduct.categoryName}</Badge>
                    <Badge className={selectedProduct.active ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-slate-100 text-slate-600"}>
                      {selectedProduct.active ? "Active" : "Inactive"}
                    </Badge>
                    {selectedProduct.supportsSubscription ? <Badge>Subscription</Badge> : null}
                    {selectedProduct.supportsRecurring ? <Badge>Recurring</Badge> : null}
                  </div>
                  <p className="mt-4 text-sm leading-6 text-slate-600">{selectedProduct.description}</p>
                  <p className="mt-4 text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">SKU {selectedProduct.sku}</p>
                </div>
                <DetailBlock title="Benefits" items={selectedProduct.salesGuide.benefits} />
                <DetailBlock title="Talking points" items={selectedProduct.salesGuide.talkingPoints} />
                <DetailBlock title="Common objections" items={selectedProduct.salesGuide.commonObjections} />
                {selectedProduct.salesGuide.callNotes ? (
                  <div className="rounded-2xl border border-border bg-white p-4">
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Call notes</p>
                    <p className="mt-3 text-sm leading-6 text-slate-600">{selectedProduct.salesGuide.callNotes}</p>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
