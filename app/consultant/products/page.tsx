import { ConsultantProductsClient } from "@/app/consultant/products/consultant-products-client";
import { SidebarShell } from "@/components/layout/sidebar-shell";
import { Card } from "@/components/ui/card";
import { requireApprovedConsultant } from "@/lib/auth/current-user";
import { consultantNav } from "@/lib/constants/navigation";
import { prisma } from "@/lib/db/prisma";
import { extractProductSalesGuide } from "@/lib/products/catalog";

export default async function ConsultantProductsPage() {
  const user = await requireApprovedConsultant();
  const companyId = user.companyId;

  if (!companyId) {
    return (
      <SidebarShell nav={consultantNav} eyebrow="Agent" title="Products">
        <Card className="p-6">
          <h2 className="text-xl font-semibold text-clinic-ink">Company setup required</h2>
          <p className="mt-2 text-slate-600">Your account needs to be linked to Go Virtual Health before products are available.</p>
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
      images: {
        orderBy: { sortOrder: "asc" },
        take: 1
      }
    },
    orderBy: [{ category: { name: "asc" } }, { title: "asc" }]
  });

  return (
    <SidebarShell nav={consultantNav} eyebrow="Agent" title="Products">
      <ConsultantProductsClient
        products={products.map((product) => ({
          id: product.id,
          title: product.title,
          slug: product.slug,
          description: product.description,
          sku: product.sku,
          categoryName: product.category.name,
          priceCents: product.priceCents,
          image: product.images[0]
            ? {
                url: product.images[0].url,
                alt: product.images[0].alt
              }
            : null,
          supportsRecurring: product.supportsRecurring,
          supportsSubscription: product.supportsSubscription,
          salesGuide: extractProductSalesGuide(product.metadata)
        }))}
      />
    </SidebarShell>
  );
}
