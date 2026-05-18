import { SidebarShell } from "@/components/layout/sidebar-shell";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { requirePartner } from "@/lib/auth/current-user";
import { partnerNav } from "@/lib/constants/navigation";
import { prisma } from "@/lib/db/prisma";
import { formatCurrency, formatPercentBps } from "@/lib/products/catalog";

export default async function PartnerProductsPage() {
  const user = await requirePartner();
  const companyId = user.companyId;

  if (!companyId) {
    return (
      <SidebarShell nav={partnerNav} eyebrow="Partner" title="Products">
        <Card className="p-6">
          <h2 className="text-xl font-semibold text-clinic-ink">Company setup required</h2>
          <p className="mt-2 text-slate-600">This partner account needs to be linked to a company before product visibility is available.</p>
        </Card>
      </SidebarShell>
    );
  }

  const partnerProfile = await prisma.partnerProfile.findUnique({
    where: { userId: user.id },
    select: { id: true, displayName: true }
  });

  if (user.role === "PARTNER" && !partnerProfile) {
    return (
      <SidebarShell nav={partnerNav} eyebrow="Partner" title="Products">
        <Card className="p-6">
          <h2 className="text-xl font-semibold text-clinic-ink">Partner profile not configured</h2>
          <p className="mt-2 text-slate-600">An owner must create and assign your partner profile before sales visibility is available.</p>
        </Card>
      </SidebarShell>
    );
  }

  const [products, salesByProduct] = await Promise.all([
    prisma.product.findMany({
      where: { companyId },
      include: {
        category: true,
        inventory: true,
        images: {
          orderBy: { sortOrder: "asc" },
          take: 1
        }
      },
      orderBy: [{ active: "desc" }, { title: "asc" }]
    }),
    prisma.orderItem.groupBy({
      by: ["productId"],
      where: {
        product: { companyId },
        ...(partnerProfile
          ? {
              order: {
                consultantProfile: {
                  partnerProfileId: partnerProfile.id
                }
              }
            }
          : {})
      },
      _sum: {
        quantity: true,
        totalCents: true
      }
    })
  ]);

  const salesMap = new Map(salesByProduct.map((row) => [row.productId, row]));
  const revenueCents = salesByProduct.reduce((sum, row) => sum + (row._sum.totalCents ?? 0), 0);
  const unitsSold = salesByProduct.reduce((sum, row) => sum + (row._sum.quantity ?? 0), 0);

  return (
    <SidebarShell nav={partnerNav} eyebrow="Partner" title="Products">
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="p-5">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Visible products</p>
            <p className="mt-3 text-3xl font-semibold text-clinic-navy">{products.length}</p>
          </Card>
          <Card className="p-5">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Attributed revenue</p>
            <p className="mt-3 text-3xl font-semibold text-clinic-navy">{formatCurrency(revenueCents)}</p>
          </Card>
          <Card className="p-5">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Units sold</p>
            <p className="mt-3 text-3xl font-semibold text-clinic-navy">{unitsSold}</p>
          </Card>
        </div>

        <Card className="overflow-hidden">
          <div className="border-b border-border p-5">
            <Badge className="border-blue-100 bg-blue-50 text-clinic-navy">Read-only margin view</Badge>
            <h2 className="mt-4 text-2xl font-semibold text-clinic-ink">Product pricing and margin visibility</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              Partners can view catalog pricing and margin details. Sales totals shown here only include orders from consultants assigned to this partner profile.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px] text-left text-sm">
              <thead className="bg-clinic-mist text-xs uppercase tracking-[0.14em] text-slate-500">
                <tr>
                  <th className="px-5 py-3">Image</th>
                  <th className="px-5 py-3">Product</th>
                  <th className="px-5 py-3">SKU</th>
                  <th className="px-5 py-3">Category</th>
                  <th className="px-5 py-3">Price</th>
                  <th className="px-5 py-3">Internal cost</th>
                  <th className="px-5 py-3">Gross margin</th>
                  <th className="px-5 py-3">Stock</th>
                  <th className="px-5 py-3">Attributed sales</th>
                  <th className="px-5 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-white">
                {products.map((product) => {
                  const sales = salesMap.get(product.id);
                  const primaryImage = product.images[0];
                  return (
                    <tr key={product.id}>
                      <td className="px-5 py-4">
                        <div className="flex h-16 w-24 items-center justify-center overflow-hidden rounded-lg border border-border bg-clinic-mist">
                          {primaryImage ? (
                            <img src={primaryImage.url} alt={primaryImage.alt ?? product.title} className="h-full w-full object-cover" />
                          ) : (
                            <span className="text-xs text-slate-500">No image</span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <p className="font-semibold text-clinic-ink">{product.title}</p>
                        <p className="mt-1 max-w-sm text-xs leading-5 text-slate-500">{product.description}</p>
                      </td>
                      <td className="px-5 py-4 font-semibold text-slate-600">{product.sku}</td>
                      <td className="px-5 py-4 text-slate-600">{product.category.name}</td>
                      <td className="px-5 py-4 font-semibold text-clinic-ink">{formatCurrency(product.priceCents)}</td>
                      <td className="px-5 py-4 text-slate-600">{formatCurrency(product.internalCostCents)}</td>
                      <td className="px-5 py-4 font-semibold text-clinic-navy">{formatPercentBps(product.marginBps)}</td>
                      <td className="px-5 py-4 text-slate-600">{product.inventory?.quantityOnHand ?? 0}</td>
                      <td className="px-5 py-4">
                        <p className="font-semibold text-clinic-ink">{formatCurrency(sales?._sum.totalCents ?? 0)}</p>
                        <p className="text-xs text-slate-500">{sales?._sum.quantity ?? 0} units</p>
                      </td>
                      <td className="px-5 py-4">
                        <Badge className={product.active ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-slate-100 text-slate-600"}>
                          {product.active ? "Active" : "Archived"}
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
                {products.length === 0 && (
                  <tr>
                    <td className="px-5 py-10 text-center text-slate-500" colSpan={10}>
                      Products will appear here after the admin adds them to the catalog.
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
