"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ExternalLink, PhoneCall, Search, SlidersHorizontal, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/products/catalog";

type ConsultantProduct = {
  id: string;
  title: string;
  slug: string;
  description: string;
  sku: string;
  categoryName: string;
  priceCents: number;
  image: {
    url: string;
    alt: string | null;
  } | null;
  supportsRecurring: boolean;
  supportsSubscription: boolean;
  salesGuide: {
    benefits: string[];
    talkingPoints: string[];
    commonObjections: string[];
    callNotes: string;
  };
};

const priceRanges = [
  { label: "All prices", min: 0, max: Number.POSITIVE_INFINITY },
  { label: "Under $100", min: 0, max: 10000 },
  { label: "$100-$250", min: 10000, max: 25000 },
  { label: "$250-$500", min: 25000, max: 50000 },
  { label: "$500+", min: 50000, max: Number.POSITIVE_INFINITY }
];

function GuideList({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-2xl border border-border bg-white p-4">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">{title}</p>
      <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-600">
        {items.length > 0 ? items.map((item) => <li key={item}>{item}</li>) : <li>No guidance added yet.</li>}
      </ul>
    </div>
  );
}

export function ConsultantProductsClient({ products }: { products: ConsultantProduct[] }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [priceRange, setPriceRange] = useState(priceRanges[0].label);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);

  const categories = useMemo(() => {
    return ["All", ...Array.from(new Set(products.map((product) => product.categoryName))).sort()];
  }, [products]);

  const filteredProducts = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const selectedRange = priceRanges.find((range) => range.label === priceRange) ?? priceRanges[0];

    return products.filter((product) => {
      const matchesQuery = !normalizedQuery || `${product.title} ${product.description} ${product.categoryName} ${product.sku}`.toLowerCase().includes(normalizedQuery);
      const matchesCategory = category === "All" || product.categoryName === category;
      const matchesPrice = product.priceCents >= selectedRange.min && product.priceCents < selectedRange.max;
      return matchesQuery && matchesCategory && matchesPrice;
    });
  }, [products, query, category, priceRange]);

  const selectedProduct = products.find((product) => product.id === selectedProductId) ?? null;

  return (
    <div className="space-y-6">
      <Card className="p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <Badge className="border-blue-100 bg-blue-50 text-clinic-navy">Sales guide</Badge>
            <h2 className="mt-4 text-2xl font-semibold text-clinic-ink">Product call library</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              Search by product, filter by category or price, and open a clean product brief during customer calls.
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-2xl bg-clinic-mist px-4 py-3 text-sm font-semibold text-clinic-navy">
            <SlidersHorizontal className="h-4 w-4" />
            {filteredProducts.length} of {products.length} products
          </div>
        </div>

        <div className="mt-5 grid gap-3 lg:grid-cols-[1fr_220px_180px]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search products, SKU, benefits..." className="pl-9" />
          </div>
          <select
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            className="h-11 rounded-xl border border-border bg-white px-3 text-sm font-semibold text-clinic-ink outline-none transition focus:border-clinic-navy focus:ring-4 focus:ring-clinic-navy/10"
          >
            {categories.map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>
          <select
            value={priceRange}
            onChange={(event) => setPriceRange(event.target.value)}
            className="h-11 rounded-xl border border-border bg-white px-3 text-sm font-semibold text-clinic-ink outline-none transition focus:border-clinic-navy focus:ring-4 focus:ring-clinic-navy/10"
          >
            {priceRanges.map((range) => (
              <option key={range.label} value={range.label}>{range.label}</option>
            ))}
          </select>
        </div>
      </Card>

      {filteredProducts.length > 0 ? (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {filteredProducts.map((product) => (
            <button
              key={product.id}
              type="button"
              onClick={() => setSelectedProductId(product.id)}
              className="group overflow-hidden rounded-3xl border border-border bg-white text-left shadow-sm transition hover:-translate-y-0.5 hover:border-clinic-navy/25 hover:shadow-xl"
            >
              <div className="aspect-[4/3] bg-clinic-mist">
                {product.image ? (
                  <img src={product.image.url} alt={product.image.alt ?? product.title} className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]" />
                ) : (
                  <div className="flex h-full items-center justify-center text-sm font-semibold text-slate-400">No image</div>
                )}
              </div>
              <div className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <Badge>{product.categoryName}</Badge>
                    <p className="mt-3 line-clamp-2 min-h-10 text-sm font-semibold leading-5 text-clinic-ink">{product.title}</p>
                  </div>
                  <p className="shrink-0 text-lg font-semibold text-clinic-navy">{formatCurrency(product.priceCents)}</p>
                </div>
                <p className="mt-3 line-clamp-2 text-sm leading-6 text-slate-600">{product.description}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {product.supportsRecurring ? <Badge className="border-blue-100 bg-blue-50 text-clinic-navy">Recurring</Badge> : null}
                  {product.supportsSubscription ? <Badge className="border-red-100 bg-clinic-blush text-clinic-red">Subscription</Badge> : null}
                </div>
              </div>
            </button>
          ))}
        </div>
      ) : (
        <Card className="p-8 text-center">
          <h2 className="text-xl font-semibold text-clinic-ink">No products match these filters</h2>
          <p className="mt-2 text-slate-600">Try another category, price range, or search term.</p>
        </Card>
      )}

      {selectedProduct ? (
        <div className="fixed inset-0 z-50 flex items-end bg-clinic-navy/30 p-0 backdrop-blur-sm sm:items-center sm:p-6">
          <div className="mx-auto max-h-[92vh] w-full max-w-5xl overflow-hidden rounded-t-3xl border border-white/70 bg-white shadow-[0_24px_80px_rgba(7,55,99,0.18)] sm:rounded-3xl">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Product brief</p>
                <h3 className="mt-1 text-xl font-semibold text-clinic-ink">{selectedProduct.title}</h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedProductId(null)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border bg-white text-slate-500 transition hover:bg-clinic-mist hover:text-clinic-ink"
                aria-label="Close product brief"
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
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Retail price</p>
                  <p className="mt-2 text-3xl font-semibold text-clinic-navy">{formatCurrency(selectedProduct.priceCents)}</p>
                  <p className="mt-3 text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">SKU {selectedProduct.sku}</p>
                </div>
                <Link href={`/shop/${selectedProduct.slug}`} target="_blank">
                  <Button variant="outline" className="w-full">
                    Product page
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </Link>
              </div>

              <div className="space-y-4">
                <div className="rounded-2xl border border-border bg-white p-4">
                  <div className="flex flex-wrap gap-2">
                    <Badge>{selectedProduct.categoryName}</Badge>
                    {selectedProduct.supportsRecurring ? <Badge>Recurring ready</Badge> : null}
                    {selectedProduct.supportsSubscription ? <Badge>Subscription supported</Badge> : null}
                  </div>
                  <p className="mt-4 text-sm leading-6 text-slate-600">{selectedProduct.description}</p>
                </div>
                <GuideList title="Benefits" items={selectedProduct.salesGuide.benefits} />
                <GuideList title="Talking points" items={selectedProduct.salesGuide.talkingPoints} />
                <GuideList title="Objection handling" items={selectedProduct.salesGuide.commonObjections} />
                <div className="rounded-2xl border border-border bg-clinic-mist p-4">
                  <div className="flex items-center gap-2">
                    <PhoneCall className="h-4 w-4 text-clinic-red" />
                    <p className="text-sm font-semibold text-clinic-ink">Call notes</p>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-600">
                    {selectedProduct.salesGuide.callNotes || "No call notes have been added yet. Route clinical questions to the licensed provider workflow."}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
