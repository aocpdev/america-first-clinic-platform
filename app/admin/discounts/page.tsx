import { SidebarShell } from "@/components/layout/sidebar-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { deleteDiscount, toggleDiscount } from "@/app/admin/discounts/actions";
import { DiscountForm } from "@/app/admin/discounts/discount-form";
import { requireRole } from "@/lib/auth/current-user";
import { adminNav } from "@/lib/constants/navigation";
import { calculateDiscountApplication, isDiscountActive } from "@/lib/discounts/calculations";
import { prisma } from "@/lib/db/prisma";
import { formatCurrency } from "@/lib/products/catalog";

function percent(bps: number) {
  return (bps / 100).toFixed(2).replace(/\.00$/, "");
}

export default async function AdminDiscountsPage() {
  const user = await requireRole("COMPANY_ADMIN");
  const companyId = user.companyId;

  if (!companyId) {
    return (
      <SidebarShell nav={adminNav} eyebrow="Admin" title="Discounts">
        <Card className="p-6">Company setup required.</Card>
      </SidebarShell>
    );
  }

  const [discounts, products, redemptions, redemptionCount] = await Promise.all([
    prisma.discount.findMany({
      where: { companyId },
      orderBy: [{ active: "desc" }, { createdAt: "desc" }]
    }),
    prisma.product.findMany({
      where: { companyId, active: true },
      include: { category: true },
      orderBy: [{ category: { name: "asc" } }, { title: "asc" }]
    }),
    prisma.discountRedemption.findMany({
      where: { companyId },
      orderBy: { createdAt: "desc" },
      take: 12
    }),
    prisma.discountRedemption.count({
      where: { companyId }
    })
  ]);

  const productLines = products.map((product) => ({
    productId: product.id,
    categoryName: product.category.name,
    priceCents: product.priceCents,
    internalCostCents: product.internalCostCents,
    quantity: 1
  }));
  const activeCount = discounts.filter((discount) => isDiscountActive(discount)).length;
  const redeemedCents = redemptions.reduce((sum, redemption) => sum + redemption.discountCents, 0);

  return (
    <SidebarShell nav={adminNav} eyebrow="Admin" title="Discounts">
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="p-5">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Active discounts</p>
            <p className="mt-3 text-3xl font-semibold text-clinic-navy">{activeCount}</p>
          </Card>
          <Card className="p-5">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Total redemptions</p>
            <p className="mt-3 text-3xl font-semibold text-clinic-navy">{redemptionCount}</p>
          </Card>
          <Card className="p-5">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Recent discount value</p>
            <p className="mt-3 text-3xl font-semibold text-clinic-navy">{formatCurrency(redeemedCents)}</p>
          </Card>
        </div>

        <Card className="overflow-visible rounded-3xl">
          <div className="border-b border-border p-6">
            <Badge>Profit preview</Badge>
            <h2 className="mt-3 text-3xl font-semibold text-clinic-ink">Create discount</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
              Select specific products, or leave Products set to All products for a storewide coupon.
            </p>
          </div>
          <DiscountForm products={products} />
        </Card>

        <div className="grid gap-4">
          {discounts.map((discount) => {
            const preview = calculateDiscountApplication(discount, productLines);
            return (
              <Card key={discount.id} className="overflow-visible rounded-3xl">
                <div className="grid gap-5 p-5 xl:grid-cols-[1fr_420px]">
                  <div>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge>{discount.active ? "Active" : "Paused"}</Badge>
                          <code className="rounded-full bg-clinic-mist px-3 py-1 text-xs font-bold text-clinic-navy">{discount.code}</code>
                        </div>
                        <h3 className="mt-3 text-2xl font-semibold text-clinic-ink">{discount.name}</h3>
                        <p className="mt-1 text-sm text-slate-500">
                          {discount.discountType === "PERCENT" ? `${percent(discount.valueBps)}% off` : `${formatCurrency(discount.amountCents)} off`}
                          {discount.productIds.length > 0
                            ? ` · ${discount.productIds.length} product${discount.productIds.length === 1 ? "" : "s"}`
                            : " · All products"}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <form action={toggleDiscount}>
                          <input type="hidden" name="discountId" value={discount.id} />
                          <input type="hidden" name="active" value={discount.active ? "false" : "true"} />
                          <Button type="submit" variant="outline">{discount.active ? "Pause" : "Enable"}</Button>
                        </form>
                        <form action={deleteDiscount}>
                          <input type="hidden" name="discountId" value={discount.id} />
                          <Button type="submit" variant="outline" disabled={discount.redemptionCount > 0}>Delete</Button>
                        </form>
                      </div>
                    </div>

                    <details className="mt-5 rounded-2xl border border-border bg-clinic-mist p-4">
                      <summary className="cursor-pointer text-sm font-bold text-clinic-navy">Edit discount</summary>
                      <DiscountForm discount={discount} products={products} />
                    </details>
                  </div>

                  <div className="rounded-3xl border border-border bg-white p-4 shadow-line">
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Profit preview</p>
                    {preview ? (
                      <div className="mt-4 grid gap-3 text-sm">
                        <Metric label="Eligible subtotal" value={formatCurrency(preview.eligibleSubtotalCents)} />
                        <Metric label="Discount applied" value={formatCurrency(preview.discountCents)} />
                        <Metric label="Gross margin after discount" value={formatCurrency(preview.grossMarginCents)} />
                        <Metric label="Estimated owner profit" value={formatCurrency(preview.grossMarginCents)} />
                        <Metric label="Commissionable margin" value={formatCurrency(preview.commissionableMarginCents)} />
                      </div>
                    ) : (
                      <p className="mt-4 rounded-2xl bg-clinic-mist p-4 text-sm text-slate-500">No active products match this discount.</p>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </SidebarShell>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl bg-clinic-mist px-3 py-2">
      <span className="text-slate-500">{label}</span>
      <span className="font-semibold text-clinic-ink">{value}</span>
    </div>
  );
}
