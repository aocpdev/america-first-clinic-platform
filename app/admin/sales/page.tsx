import { SalesBuilderClient } from "@/app/consultant/sales/sales-builder-client";
import { createAdminOrder } from "@/app/sales/actions";
import { SidebarShell } from "@/components/layout/sidebar-shell";
import { Card } from "@/components/ui/card";
import { requireRole } from "@/lib/auth/current-user";
import { adminNav } from "@/lib/constants/navigation";
import { prisma } from "@/lib/db/prisma";

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

  const [customers, products, recentOrders] = await Promise.all([
    prisma.customer.findMany({
      where: { companyId: user.companyId },
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
    }),
    prisma.order.findMany({
      where: { companyId: user.companyId },
      include: {
        customer: true,
        commissionSplits: true
      },
      orderBy: { createdAt: "desc" },
      take: 8
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
          lifetimeValueCents: customer.lifetimeValueCents
        }))}
        products={products.map((product) => ({
          id: product.id,
          title: product.title,
          categoryName: product.category.name,
          priceCents: product.priceCents,
          estimatedCommissionCents: grossMarginPerUnit(product.priceCents, product.internalCostCents),
          imageUrl: product.images[0]?.url ?? null,
          imageAlt: product.images[0]?.alt ?? null,
          supportsRecurring: product.supportsRecurring,
          supportsSubscription: product.supportsSubscription
        }))}
        recentOrders={recentOrders.map((order) => ({
          id: order.id,
          customerName: personName(order.customer),
          totalCents: order.totalCents,
          commissionCents: order.commissionSplits.reduce((sum, split) => sum + split.amountCents, 0),
          orderStatus: order.orderStatus,
          paymentStatus: order.paymentStatus,
          createdAt: order.createdAt.toISOString()
        }))}
        canCreateOrders
        createOrderAction={createAdminOrder}
        commissionLabel="Profit generated"
        commissionDetailLabel="Profit generated"
        productEstimateLabel="est. profit"
        successMessage="Order created successfully. No commission was generated for this admin sale."
        ownershipCopy="Admins can create orders for any company customer. Admin-created sales do not generate partner or consultant commission."
        createdOrderId={params.created}
        error={params.error}
      />
    </SidebarShell>
  );
}
