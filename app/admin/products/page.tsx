import { Boxes, Download, Plus, Trash2 } from "lucide-react";
import { createProduct, deleteProduct, updateProduct } from "@/app/admin/products/actions";
import { SidebarShell } from "@/components/layout/sidebar-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { requireRole } from "@/lib/auth/current-user";
import { adminNav } from "@/lib/constants/navigation";
import { prisma } from "@/lib/db/prisma";
import {
  centsToDollars,
  extractProductSalesGuide,
  formatCurrency,
  formatPercentBps,
  linesToTextarea
} from "@/lib/products/catalog";

export default async function AdminProductsPage() {
  const user = await requireRole("COMPANY_ADMIN");
  const companyId = user.companyId;

  if (!companyId) {
    return (
      <SidebarShell nav={adminNav} eyebrow="Admin" title="Products">
        <Card className="p-6">
          <h2 className="text-xl font-semibold text-clinic-ink">Company setup required</h2>
          <p className="mt-2 text-slate-600">This admin account needs to be linked to a company before products can be managed.</p>
        </Card>
      </SidebarShell>
    );
  }

  const [products, categories, salesByProduct] = await Promise.all([
    prisma.product.findMany({
      where: { companyId },
      include: {
        category: true,
        inventory: true,
        _count: { select: { orderItems: true } }
      },
      orderBy: [{ active: "desc" }, { title: "asc" }]
    }),
    prisma.productCategory.findMany({
      where: { companyId },
      orderBy: { name: "asc" }
    }),
    prisma.orderItem.groupBy({
      by: ["productId"],
      where: {
        product: { companyId }
      },
      _sum: {
        quantity: true,
        totalCents: true
      }
    })
  ]);

  const salesMap = new Map(salesByProduct.map((row) => [row.productId, row]));
  const activeProducts = products.filter((product) => product.active).length;
  const totalRevenueCents = salesByProduct.reduce((sum, row) => sum + (row._sum.totalCents ?? 0), 0);
  const lowStockCount = products.filter((product) => {
    const inventory = product.inventory;
    return inventory && inventory.quantityOnHand <= inventory.reorderPoint;
  }).length;

  return (
    <SidebarShell nav={adminNav} eyebrow="Admin" title="Products">
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="p-5">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Active products</p>
            <p className="mt-3 text-3xl font-semibold text-clinic-navy">{activeProducts}</p>
          </Card>
          <Card className="p-5">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Catalog revenue</p>
            <p className="mt-3 text-3xl font-semibold text-clinic-navy">{formatCurrency(totalRevenueCents)}</p>
          </Card>
          <Card className="p-5">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Inventory alerts</p>
            <p className="mt-3 text-3xl font-semibold text-clinic-navy">{lowStockCount}</p>
          </Card>
        </div>

        <Card className="p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <Badge className="border-blue-100 bg-blue-50 text-clinic-navy">Admin only</Badge>
              <h2 className="mt-4 text-2xl font-semibold text-clinic-ink">Add a product</h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                Products store the customer price, internal cost, live margin, inventory, subscription support, and healthcare metadata used by sales, reporting, and commissions.
              </p>
            </div>
            <Button variant="outline" type="button">
              <Download className="h-4 w-4" />
              Import sheet ready
            </Button>
          </div>

          <form action={createProduct} className="mt-6 grid gap-4 lg:grid-cols-12">
            <Input name="title" placeholder="Product title" required className="lg:col-span-3" />
            <Input name="sku" placeholder="SKU" required className="lg:col-span-2" />
            <Input name="categoryName" placeholder="Category" list="product-categories" required className="lg:col-span-2" />
            <Input name="price" placeholder="Price, e.g. 499" required className="lg:col-span-1" />
            <Input name="internalCost" placeholder="Cost" required className="lg:col-span-1" />
            <Input name="quantityOnHand" placeholder="Stock" type="number" min="0" defaultValue="0" className="lg:col-span-1" />
            <Input name="reorderPoint" placeholder="Reorder" type="number" min="0" defaultValue="10" className="lg:col-span-1" />
            <SubmitButton className="lg:col-span-1" pendingText="Adding...">
              <Plus className="h-4 w-4" />
              Add
            </SubmitButton>
            <textarea
              name="description"
              required
              placeholder="Product description"
              className="min-h-24 rounded-lg border border-input bg-white px-3 py-2 text-sm text-clinic-ink shadow-line focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:col-span-6"
            />
            <div className="grid gap-3 rounded-lg border border-border bg-clinic-mist p-4 text-sm lg:col-span-6">
              <label className="flex items-center gap-2 font-semibold text-clinic-ink">
                <input name="active" type="checkbox" defaultChecked className="h-4 w-4" />
                Active in catalog
              </label>
              <label className="flex items-center gap-2 font-semibold text-clinic-ink">
                <input name="supportsSubscription" type="checkbox" className="h-4 w-4" />
                Supports subscription
              </label>
              <label className="flex items-center gap-2 font-semibold text-clinic-ink">
                <input name="supportsRecurring" type="checkbox" className="h-4 w-4" />
                Supports recurring billing
              </label>
              <label className="flex items-center gap-2 font-semibold text-clinic-ink">
                <input name="requiresConsult" type="checkbox" className="h-4 w-4" />
                Requires consultation workflow
              </label>
              <input type="hidden" name="healthcareCategory" value="wellness" />
              <input type="hidden" name="importSource" value="manual" />
            </div>
            <div className="grid gap-3 rounded-lg border border-border bg-white p-4 lg:col-span-12">
              <div>
                <p className="text-sm font-semibold text-clinic-ink">Sales enablement guide</p>
                <p className="mt-1 text-xs text-slate-500">One item per line. Consultants will use this during calls.</p>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <textarea
                  name="benefits"
                  placeholder="Key benefits"
                  className="min-h-24 rounded-lg border border-input bg-white px-3 py-2 text-sm text-clinic-ink shadow-line focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
                <textarea
                  name="talkingPoints"
                  placeholder="Call talking points"
                  className="min-h-24 rounded-lg border border-input bg-white px-3 py-2 text-sm text-clinic-ink shadow-line focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
                <textarea
                  name="commonObjections"
                  placeholder="Common objections and responses"
                  className="min-h-24 rounded-lg border border-input bg-white px-3 py-2 text-sm text-clinic-ink shadow-line focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
                <textarea
                  name="callNotes"
                  placeholder="Compliance notes for the sales call"
                  className="min-h-24 rounded-lg border border-input bg-white px-3 py-2 text-sm text-clinic-ink shadow-line focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>
            </div>
          </form>
          <datalist id="product-categories">
            {categories.map((category) => (
              <option key={category.id} value={category.name} />
            ))}
          </datalist>
        </Card>

        <Card className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-border p-5">
            <div>
              <h3 className="text-lg font-semibold text-clinic-ink">Product catalog</h3>
              <p className="mt-1 text-sm text-slate-500">Only admins can edit or remove products. Partners get read-only margin and sales visibility.</p>
            </div>
            <Boxes className="h-5 w-5 text-clinic-red" />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1180px] text-left text-sm">
              <thead className="bg-clinic-mist text-xs uppercase tracking-[0.14em] text-slate-500">
                <tr>
                  <th className="px-5 py-3">Product</th>
                  <th className="px-5 py-3">SKU</th>
                  <th className="px-5 py-3">Category</th>
                  <th className="px-5 py-3">Price</th>
                  <th className="px-5 py-3">Cost</th>
                  <th className="px-5 py-3">Margin</th>
                  <th className="px-5 py-3">Stock</th>
                  <th className="px-5 py-3">Sales</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-white">
                {products.map((product) => {
                  const sales = salesMap.get(product.id);
                  const revenueCents = sales?._sum.totalCents ?? 0;
                  const units = sales?._sum.quantity ?? 0;
                  const salesGuide = extractProductSalesGuide(product.metadata);
                  return (
                    <tr key={product.id} className={!product.active ? "bg-slate-50" : undefined}>
                      <td className="px-5 py-4">
                        <form id={`product-${product.id}`} action={updateProduct} className="space-y-2">
                          <input type="hidden" name="productId" value={product.id} />
                          <Input name="title" defaultValue={product.title} aria-label="Product title" />
                          <textarea
                            name="description"
                            defaultValue={product.description}
                            aria-label="Product description"
                            className="min-h-20 w-80 rounded-lg border border-input bg-white px-3 py-2 text-xs text-clinic-ink shadow-line focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          />
                          <input type="hidden" name="healthcareCategory" value="wellness" />
                          <input type="hidden" name="importSource" value="manual" />
                          <details className="w-80 rounded-lg border border-border bg-clinic-mist p-3">
                            <summary className="cursor-pointer text-xs font-bold uppercase tracking-[0.14em] text-clinic-navy">
                              Sales guide
                            </summary>
                            <div className="mt-3 space-y-2">
                              <textarea
                                name="benefits"
                                defaultValue={linesToTextarea(salesGuide.benefits)}
                                placeholder="Benefits, one per line"
                                className="min-h-20 w-full rounded-lg border border-input bg-white px-3 py-2 text-xs text-clinic-ink shadow-line focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                              />
                              <textarea
                                name="talkingPoints"
                                defaultValue={linesToTextarea(salesGuide.talkingPoints)}
                                placeholder="Talking points, one per line"
                                className="min-h-20 w-full rounded-lg border border-input bg-white px-3 py-2 text-xs text-clinic-ink shadow-line focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                              />
                              <textarea
                                name="commonObjections"
                                defaultValue={linesToTextarea(salesGuide.commonObjections)}
                                placeholder="Objections, one per line"
                                className="min-h-20 w-full rounded-lg border border-input bg-white px-3 py-2 text-xs text-clinic-ink shadow-line focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                              />
                              <textarea
                                name="callNotes"
                                defaultValue={salesGuide.callNotes}
                                placeholder="Call notes"
                                className="min-h-20 w-full rounded-lg border border-input bg-white px-3 py-2 text-xs text-clinic-ink shadow-line focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                              />
                            </div>
                          </details>
                        </form>
                      </td>
                      <td className="px-5 py-4">
                        <Input form={`product-${product.id}`} name="sku" defaultValue={product.sku} aria-label="SKU" className="w-32" />
                      </td>
                      <td className="px-5 py-4">
                        <Input form={`product-${product.id}`} name="categoryName" defaultValue={product.category.name} aria-label="Category" className="w-44" />
                      </td>
                      <td className="px-5 py-4">
                        <Input form={`product-${product.id}`} name="price" defaultValue={centsToDollars(product.priceCents)} aria-label="Price" className="w-28" />
                      </td>
                      <td className="px-5 py-4">
                        <Input form={`product-${product.id}`} name="internalCost" defaultValue={centsToDollars(product.internalCostCents)} aria-label="Internal cost" className="w-28" />
                      </td>
                      <td className="px-5 py-4 font-semibold text-clinic-navy">{formatPercentBps(product.marginBps)}</td>
                      <td className="px-5 py-4">
                        <div className="flex gap-2">
                          <Input form={`product-${product.id}`} name="quantityOnHand" type="number" min="0" defaultValue={product.inventory?.quantityOnHand ?? 0} aria-label="Stock" className="w-20" />
                          <Input form={`product-${product.id}`} name="reorderPoint" type="number" min="0" defaultValue={product.inventory?.reorderPoint ?? 10} aria-label="Reorder point" className="w-20" />
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <p className="font-semibold text-clinic-ink">{formatCurrency(revenueCents)}</p>
                        <p className="text-xs text-slate-500">{units} units</p>
                      </td>
                      <td className="px-5 py-4">
                        <div className="space-y-2">
                          <Badge className={product.active ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-slate-100 text-slate-600"}>
                            {product.active ? "Active" : "Archived"}
                          </Badge>
                          <label className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                            <input form={`product-${product.id}`} name="active" type="checkbox" defaultChecked={product.active} />
                            Active
                          </label>
                          <label className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                            <input form={`product-${product.id}`} name="supportsSubscription" type="checkbox" defaultChecked={product.supportsSubscription} />
                            Subscription
                          </label>
                          <label className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                            <input form={`product-${product.id}`} name="supportsRecurring" type="checkbox" defaultChecked={product.supportsRecurring} />
                            Recurring
                          </label>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex justify-end gap-2">
                          <SubmitButton form={`product-${product.id}`} size="sm" pendingText="Saving...">Save</SubmitButton>
                          <form action={deleteProduct}>
                            <input type="hidden" name="productId" value={product.id} />
                            <SubmitButton size="sm" variant="outline" pendingText="Removing...">
                              <Trash2 className="h-4 w-4" />
                              Delete
                            </SubmitButton>
                          </form>
                        </div>
                        {product._count.orderItems > 0 && (
                          <p className="mt-2 text-right text-xs text-slate-500">Has order history; delete archives it.</p>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {products.length === 0 && (
                  <tr>
                    <td className="px-5 py-10 text-center text-slate-500" colSpan={10}>
                      No products yet. Add the first catalog item above, then import the spreadsheet once access is available.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </SidebarShell>
  );
}
