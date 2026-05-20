import { SalesBuilderClient } from "@/app/consultant/sales/sales-builder-client";
import { createConsultantOrder } from "@/app/sales/actions";
import { SidebarShell } from "@/components/layout/sidebar-shell";
import { Card } from "@/components/ui/card";
import { requireApprovedConsultant } from "@/lib/auth/current-user";
import { consultantNav } from "@/lib/constants/navigation";
import { prisma } from "@/lib/db/prisma";
import { extractProductSalesGuide } from "@/lib/products/catalog";

function customerName(customer: { firstName: string | null; lastName: string | null; email: string }) {
  const name = [customer.firstName, customer.lastName].filter(Boolean).join(" ").trim();
  return name || customer.email;
}

function consultantCommissionPerUnit(
  priceCents: number,
  internalCostCents: number,
  partnerPoolBps: number,
  consultantShareBps: number,
  leaderOverrideBps: number
) {
  const grossMarginCents = Math.max(0, priceCents - internalCostCents);
  const partnerPoolCents = Math.round((grossMarginCents * partnerPoolBps) / 10000);
  return Math.round((partnerPoolCents * Math.max(0, consultantShareBps - leaderOverrideBps)) / 10000);
}

export default async function ConsultantSalesPage({
  searchParams
}: {
  searchParams: Promise<{ created?: string; error?: string }>;
}) {
  const params = await searchParams;
  const user = await requireApprovedConsultant();
  const companyId = user.companyId;
  const consultantProfileId = user.consultantProfile?.id;

  if (!companyId || !consultantProfileId) {
    return (
      <SidebarShell nav={consultantNav} eyebrow="Consultant" title="Sales">
        <Card className="p-6">
          <h2 className="text-xl font-semibold text-clinic-ink">Consultant setup required</h2>
          <p className="mt-2 text-slate-600">Your account needs an active consultant profile before orders can be created.</p>
        </Card>
      </SidebarShell>
    );
  }

  const [consultantProfile, customers, products, recentOrders] = await Promise.all([
    prisma.consultantProfile.findUnique({
      where: { id: consultantProfileId },
      include: { partnerProfile: true, groupLeaderProfile: true }
    }),
    prisma.customer.findMany({
      where: {
        companyId,
        consultantProfileId
      },
      orderBy: [{ lastPurchaseAt: "desc" }, { createdAt: "desc" }],
      take: 80
    }),
    prisma.product.findMany({
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
    }),
    prisma.order.findMany({
      where: {
        companyId,
        consultantProfileId
      },
      include: {
        customer: true,
        commissionSplits: {
          where: { participantRole: "CONSULTANT" },
          take: 1
        }
      },
      orderBy: { createdAt: "desc" },
      take: 8
    })
  ]);

  const canCreateOrders = Boolean(user.consultantProfile?.partnerProfileId);

  return (
    <SidebarShell nav={consultantNav} eyebrow="Consultant" title="Sales">
      <SalesBuilderClient
        customers={customers.map((customer) => ({
          id: customer.id,
          name: customerName(customer),
          email: customer.email,
          phone: customer.phone,
          lifetimeValueCents: customer.lifetimeValueCents
        }))}
        products={products.map((product) => ({
          id: product.id,
          title: product.title,
          description: product.description,
          categoryName: product.category.name,
          priceCents: product.priceCents,
          estimatedCommissionCents: consultantCommissionPerUnit(
            product.priceCents,
            product.internalCostCents,
            consultantProfile?.partnerProfile?.commissionBps ?? 2500,
            consultantProfile?.commissionBps ?? 5000,
            consultantProfile?.groupLeaderProfile?.consultantOverrideBps ?? 0
          ),
          imageUrl: product.images[0]?.url ?? null,
          imageAlt: product.images[0]?.alt ?? null,
          supportsRecurring: product.supportsRecurring,
          supportsSubscription: product.supportsSubscription,
          salesGuide: extractProductSalesGuide(product.metadata)
        }))}
        recentOrders={recentOrders.map((order) => ({
          id: order.id,
          customerName: customerName(order.customer),
          totalCents: order.totalCents,
          commissionCents: order.commissionSplits[0]?.amountCents ?? 0,
          orderStatus: order.orderStatus,
          paymentStatus: order.paymentStatus,
          createdAt: order.createdAt.toISOString()
        }))}
        canCreateOrders={canCreateOrders}
        createOrderAction={createConsultantOrder}
        setupMessage={canCreateOrders ? undefined : "Commission setup must be completed before this account can create orders."}
        createdOrderId={params.created}
        error={params.error}
      />
    </SidebarShell>
  );
}
