import Link from "next/link";
import { ExternalLink, PhoneCall } from "lucide-react";
import { SidebarShell } from "@/components/layout/sidebar-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { requireApprovedConsultant } from "@/lib/auth/current-user";
import { consultantNav } from "@/lib/constants/navigation";
import { prisma } from "@/lib/db/prisma";
import { extractProductSalesGuide, formatCurrency } from "@/lib/products/catalog";

export default async function ConsultantProductsPage() {
  const user = await requireApprovedConsultant();
  const companyId = user.companyId;

  if (!companyId) {
    return (
      <SidebarShell nav={consultantNav} eyebrow="Consultant" title="Products">
        <Card className="p-6">
          <h2 className="text-xl font-semibold text-clinic-ink">Company setup required</h2>
          <p className="mt-2 text-slate-600">Your account needs to be linked to America First Clinic before products are available.</p>
        </Card>
      </SidebarShell>
    );
  }

  const products = await prisma.product.findMany({
    where: {
      companyId,
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
    orderBy: [{ category: { name: "asc" } }, { title: "asc" }]
  });

  return (
    <SidebarShell nav={consultantNav} eyebrow="Consultant" title="Products">
      <div className="space-y-6">
        <Card className="p-6">
          <Badge className="border-blue-100 bg-blue-50 text-clinic-navy">Sales guide</Badge>
          <h2 className="mt-4 text-2xl font-semibold text-clinic-ink">Product call library</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            Use these product cards during customer calls. They include benefits, conversation prompts, objection handling, and compliant call notes without exposing internal costs.
          </p>
        </Card>

        <div className="grid gap-5 xl:grid-cols-2">
          {products.map((product) => {
            const salesGuide = extractProductSalesGuide(product.metadata);
            return (
              <Card key={product.id} className="overflow-hidden">
                {product.images[0] && (
                  <img src={product.images[0].url} alt={product.images[0].alt ?? product.title} className="h-48 w-full object-cover" />
                )}
                <div className="border-b border-border bg-white p-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <Badge>{product.category.name}</Badge>
                      <h3 className="mt-3 text-xl font-semibold text-clinic-ink">{product.title}</h3>
                      <p className="mt-2 text-sm leading-6 text-slate-600">{product.description}</p>
                    </div>
                    <div className="rounded-lg bg-clinic-mist px-4 py-3 text-right">
                      <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Retail</p>
                      <p className="mt-1 text-xl font-semibold text-clinic-navy">{formatCurrency(product.priceCents)}</p>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700">{product.inventory?.quantityOnHand ?? 0} available</Badge>
                    {product.supportsRecurring && <Badge className="border-blue-100 bg-blue-50 text-clinic-navy">Recurring ready</Badge>}
                    {product.supportsSubscription && <Badge className="border-red-100 bg-clinic-blush text-clinic-red">Subscription supported</Badge>}
                  </div>
                </div>

                <div className="grid gap-4 p-5 md:grid-cols-2">
                  <GuideSection title="Benefits" items={salesGuide.benefits} />
                  <GuideSection title="Talking points" items={salesGuide.talkingPoints} />
                  <GuideSection title="Objection handling" items={salesGuide.commonObjections} />
                  <div className="rounded-lg border border-border bg-clinic-mist p-4">
                    <div className="flex items-center gap-2">
                      <PhoneCall className="h-4 w-4 text-clinic-red" />
                      <p className="text-sm font-semibold text-clinic-ink">Call notes</p>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-slate-600">
                      {salesGuide.callNotes || "No call notes have been added yet. Use the product description and route clinical questions to the licensed provider workflow."}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between border-t border-border bg-clinic-mist px-5 py-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">SKU {product.sku}</p>
                  <Link href={`/shop/${product.slug}`} target="_blank">
                    <Button size="sm" variant="outline">
                      Product page
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </Link>
                </div>
              </Card>
            );
          })}
        </div>

        {products.length === 0 && (
          <Card className="p-8 text-center">
            <h2 className="text-xl font-semibold text-clinic-ink">No products are active yet</h2>
            <p className="mt-2 text-slate-600">Active products added by the admin will appear here.</p>
          </Card>
        )}
      </div>
    </SidebarShell>
  );
}

function GuideSection({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-lg border border-border p-4">
      <p className="text-sm font-semibold text-clinic-ink">{title}</p>
      <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-600">
        {items.length > 0 ? (
          items.map((item) => <li key={item}>- {item}</li>)
        ) : (
          <li>No guidance added yet.</li>
        )}
      </ul>
    </div>
  );
}
