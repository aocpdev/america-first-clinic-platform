import { ProductCatalogClient } from "@/app/admin/products/product-catalog-client";
import { SidebarShell } from "@/components/layout/sidebar-shell";
import { Card } from "@/components/ui/card";
import { requireRole } from "@/lib/auth/current-user";
import { adminNav } from "@/lib/constants/navigation";
import { prisma } from "@/lib/db/prisma";
import { extractProductSalesGuide } from "@/lib/products/catalog";

export default async function AdminProductsPage() {
  const user = await requireRole("COMPANY_ADMIN");
  const companyId = user.companyId;

  if (!companyId) {
    return (
      <SidebarShell nav={adminNav} eyebrow="Go Virtual Health" title="Products">
        <Card className="p-6">
          <h2 className="text-xl font-semibold text-clinic-ink">Company setup required</h2>
          <p className="mt-2 text-slate-600">This Go Virtual Health account needs to be linked to a company before products can be managed.</p>
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
        images: {
          orderBy: { sortOrder: "asc" },
          take: 1
        },
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
  const inactiveProducts = products.length - activeProducts;

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
      inventory: product.inventory
        ? {
            quantityOnHand: product.inventory.quantityOnHand,
            reorderPoint: product.inventory.reorderPoint
          }
        : null,
      image: product.images[0]
        ? {
            id: product.images[0].id,
            url: product.images[0].url,
            alt: product.images[0].alt
          }
        : null,
      orderItemCount: product._count.orderItems,
      revenueCents: sales?._sum.totalCents ?? 0,
      unitsSold: sales?._sum.quantity ?? 0,
      salesGuide: extractProductSalesGuide(product.metadata)
    };
  });

  return (
    <SidebarShell nav={adminNav} eyebrow="Go Virtual Health" title="Products">
      <ProductCatalogClient
        products={productViews}
        categories={categories.map((category) => category.name)}
        activeProducts={activeProducts}
        totalRevenueCents={totalRevenueCents}
        inactiveProducts={inactiveProducts}
      />
    </SidebarShell>
  );
}
