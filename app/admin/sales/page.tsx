import { SalesBuilderClient } from "@/app/consultant/sales/sales-builder-client";
import { createAdminOrder } from "@/app/sales/actions";
import { SidebarShell } from "@/components/layout/sidebar-shell";
import { Card } from "@/components/ui/card";
import { requireRole } from "@/lib/auth/current-user";
import { adminNav } from "@/lib/constants/navigation";
import { prisma } from "@/lib/db/prisma";
import { extractProductSalesGuide } from "@/lib/products/catalog";

function personName(person: { firstName: string | null; lastName: string | null; email?: string }) {
  const name = [person.firstName, person.lastName].filter(Boolean).join(" ").trim();
  return name || person.email || "Unassigned";
}

function grossMarginPerUnit(priceCents: number, internalCostCents: number) {
  return Math.max(0, priceCents - internalCostCents);
}

export default async function AdminSalesPage({
  searchParams
}: {
  searchParams: Promise<{ created?: string; error?: string }>;
}) {
  const params = await searchParams;
  const user = await requireRole("COMPANY_ADMIN");

  if (!user.companyId) {
    return (
      <SidebarShell nav={adminNav} eyebrow="Company admin" title="Sales">
        <Card className="p-6">
          <h2 className="text-xl font-semibold text-clinic-ink">Company setup required</h2>
          <p className="mt-2 text-slate-600">Your admin account must be connected to a company before creating sales.</p>
        </Card>
      </SidebarShell>
    );
  }

  const [customers, products] = await Promise.all([
    prisma.customer.findMany({
      where: { companyId: user.companyId },
      include: {
        addresses: {
          orderBy: [{ isDefault: "desc" }, { lastUsedAt: "desc" }, { createdAt: "desc" }]
        }
      },
      orderBy: [{ lastPurchaseAt: "desc" }, { createdAt: "desc" }],
      take: 150
    }),
    prisma.product.findMany({
      where: {
        companyId: user.companyId,
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
    })
  ]);

  return (
    <SidebarShell nav={adminNav} eyebrow="Company admin" title="Sales">
      <SalesBuilderClient
        customers={customers.map((customer) => ({
          id: customer.id,
          name: personName(customer),
          email: customer.email,
          phone: customer.phone,
          lifetimeValueCents: customer.lifetimeValueCents,
          addresses: customer.addresses.map((address) => ({
            id: address.id,
            label: address.label,
            line1: address.line1,
            line2: address.line2,
            city: address.city,
            state: address.state,
            postalCode: address.postalCode,
            country: address.country,
            isDefault: address.isDefault
          }))
        }))}
        products={products.map((product) => ({
          id: product.id,
          title: product.title,
          description: product.description,
          categoryName: product.category.name,
          priceCents: product.priceCents,
          estimatedCommissionCents: grossMarginPerUnit(product.priceCents, product.internalCostCents),
          imageUrl: product.images[0]?.url ?? null,
          imageAlt: product.images[0]?.alt ?? null,
          supportsRecurring: product.supportsRecurring,
          supportsSubscription: product.supportsSubscription,
          salesGuide: extractProductSalesGuide(product.metadata)
        }))}
        canCreateOrders
        createOrderAction={createAdminOrder}
        commissionLabel="Profit generated"
        commissionDetailLabel="Profit generated"
        productEstimateLabel="est. profit"
        successMessage="Order created successfully. No commission was generated for this admin sale."
        ownershipCopy={null}
        createdOrderId={params.created}
        error={params.error}
      />
    </SidebarShell>
  );
}
