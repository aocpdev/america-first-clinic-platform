import { PartnerProductsClient } from "@/app/partner/products/partner-products-client";
import { SidebarShell } from "@/components/layout/sidebar-shell";
import { Card } from "@/components/ui/card";
import { requireManager } from "@/lib/auth/current-user";
import { managerNav } from "@/lib/constants/navigation";
import { prisma } from "@/lib/db/prisma";
import { extractProductSalesGuide } from "@/lib/products/catalog";

export default async function ManagerProductsPage() {
  const user = await requireManager();
  const managerProfile = await prisma.managerProfile.findUnique({ where: { userId: user.id } });

  if (!user.companyId || !managerProfile) {
    return (
      <SidebarShell nav={managerNav} eyebrow="Manager" title="Products">
        <Card className="p-6">
          <h2 className="text-xl font-semibold text-clinic-ink">Manager profile not configured</h2>
          <p className="mt-2 text-slate-600">A partner or admin must assign your manager profile before product visibility is available.</p>
        </Card>
      </SidebarShell>
    );
  }

  const [products, salesByProduct] = await Promise.all([
    prisma.product.findMany({
      where: { companyId: user.companyId },
      include: {
        category: true,
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
        product: { companyId: user.companyId },
        order: {
          OR: [
            { managerProfileId: managerProfile.id },
            { groupLeaderProfile: { managerProfileId: managerProfile.id } },
            { consultantProfile: { managerProfileId: managerProfile.id } },
            { consultantProfile: { groupLeaderProfile: { managerProfileId: managerProfile.id } } }
          ]
        }
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
  const productViews = products.map((product) => {
    const sales = salesMap.get(product.id);

    return {
      id: product.id,
      title: product.title,
      description: product.description,
      sku: product.sku,
      categoryName: product.category.name,
      priceCents: product.priceCents,
      internalCostCents: product.internalCostCents,
      marginBps: product.marginBps,
      active: product.active,
      supportsSubscription: product.supportsSubscription,
      supportsRecurring: product.supportsRecurring,
      image: product.images[0]
        ? {
            url: product.images[0].url,
            alt: product.images[0].alt
          }
        : null,
      attributedRevenueCents: sales?._sum.totalCents ?? 0,
      attributedUnitsSold: sales?._sum.quantity ?? 0,
      salesGuide: extractProductSalesGuide(product.metadata)
    };
  });

  return (
    <SidebarShell nav={managerNav} eyebrow="Manager" title="Products">
      <PartnerProductsClient products={productViews} revenueCents={revenueCents} unitsSold={unitsSold} />
    </SidebarShell>
  );
}
