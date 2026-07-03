import { SalesBuilderClient } from "@/app/consultant/sales/sales-builder-client";
import { createManagerOrder } from "@/app/sales/actions";
import { SidebarShell } from "@/components/layout/sidebar-shell";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { requireManager } from "@/lib/auth/current-user";
import { managerNav } from "@/lib/constants/navigation";
import { prisma } from "@/lib/db/prisma";
import { extractProductSalesGuide, formatCurrency } from "@/lib/products/catalog";

function personName(person: { firstName: string | null; lastName: string | null; email?: string }) {
  return [person.firstName, person.lastName].filter(Boolean).join(" ").trim() || person.email || "Unassigned";
}

function managerCommissionPerUnit(priceCents: number, internalCostCents: number, partnerPoolBps: number, managerShareBps: number) {
  const grossMarginCents = Math.max(0, priceCents - internalCostCents);
  const partnerPoolCents = Math.round((grossMarginCents * partnerPoolBps) / 10000);
  return Math.round((partnerPoolCents * managerShareBps) / 10000);
}

export default async function ManagerSalesPage({
  searchParams
}: {
  searchParams: Promise<{ created?: string; error?: string }>;
}) {
  const params = await searchParams;
  const user = await requireManager();
  const managerProfile = await prisma.managerProfile.findUnique({
    where: { userId: user.id },
    include: { partnerProfile: true }
  });

  if (!user.companyId || !managerProfile) {
    return (
      <SidebarShell nav={managerNav} eyebrow="Manager" title="Sales">
        <Card className="p-6">
          <h2 className="text-xl font-semibold text-clinic-ink">Manager sales profile not configured</h2>
          <p className="mt-2 text-slate-600">A partner or admin must assign your manager profile before you can create sales.</p>
        </Card>
      </SidebarShell>
    );
  }

  const [customers, products, orders, discounts] = await Promise.all([
    prisma.customer.findMany({
      where: {
        companyId: user.companyId,
        OR: [
          { managerProfileId: managerProfile.id },
          { groupLeaderProfile: { managerProfileId: managerProfile.id } },
          { consultantProfile: { managerProfileId: managerProfile.id } },
          { consultantProfile: { groupLeaderProfile: { managerProfileId: managerProfile.id } } }
        ]
      },
      include: {
        addresses: {
          orderBy: [{ isDefault: "desc" }, { lastUsedAt: "desc" }, { createdAt: "desc" }]
        }
      },
      orderBy: [{ lastPurchaseAt: "desc" }, { createdAt: "desc" }],
      take: 120
    }),
    prisma.product.findMany({
      where: { companyId: user.companyId, active: true },
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
        companyId: user.companyId,
        OR: [
          { managerProfileId: managerProfile.id },
          { groupLeaderProfile: { managerProfileId: managerProfile.id } },
          { consultantProfile: { managerProfileId: managerProfile.id } },
          { consultantProfile: { groupLeaderProfile: { managerProfileId: managerProfile.id } } }
        ]
      },
      include: {
        customer: true,
        consultantProfile: { include: { user: true } },
        groupLeaderProfile: { include: { user: true } },
        items: { include: { product: { select: { title: true } } } },
        commissionSplits: { where: { managerProfileId: managerProfile.id } }
      },
      orderBy: { createdAt: "desc" },
      take: 100
    }),
    prisma.discount.findMany({
      where: { companyId: user.companyId, active: true },
      orderBy: { createdAt: "desc" }
    })
  ]);

  const totalRevenueCents = orders.reduce((sum, order) => sum + order.totalCents, 0);
  const managerEarningsCents = orders.reduce(
    (sum, order) => sum + order.commissionSplits.filter((split) => split.participantRole === "MANAGER").reduce((splitSum, split) => splitSum + split.amountCents, 0),
    0
  );
  const downlinePayoutCents = orders.reduce(
    (sum, order) => sum + order.commissionSplits.filter((split) => split.participantRole !== "MANAGER").reduce((splitSum, split) => splitSum + split.amountCents, 0),
    0
  );

  return (
    <SidebarShell nav={managerNav} eyebrow="Manager" title="Sales">
      <div className="space-y-6">
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
            internalCostCents: product.internalCostCents,
            estimatedCommissionCents: managerCommissionPerUnit(
              product.priceCents,
              product.internalCostCents,
              managerProfile.partnerProfile.commissionBps,
              managerProfile.commissionBps
            ),
            imageUrl: product.images[0]?.url ?? null,
            imageAlt: product.images[0]?.alt ?? null,
            supportsRecurring: product.supportsRecurring,
            supportsSubscription: product.supportsSubscription,
            salesGuide: extractProductSalesGuide(product.metadata)
          }))}
          discounts={discounts.map((discount) => ({
            id: discount.id,
            name: discount.name,
            code: discount.code,
            discountType: discount.discountType,
            valueBps: discount.valueBps,
            amountCents: discount.amountCents,
            minSubtotalCents: discount.minSubtotalCents,
            ownerProtectedProfitCents: discount.ownerProtectedProfitCents,
            affectsCommissions: discount.affectsCommissions,
            fundingStrategy: discount.fundingStrategy,
            productIds: discount.productIds,
            categoryNames: discount.categoryNames,
            startsAt: discount.startsAt?.toISOString() ?? null,
            endsAt: discount.endsAt?.toISOString() ?? null,
            maxRedemptions: discount.maxRedemptions,
            redemptionCount: discount.redemptionCount,
            active: discount.active
          }))}
          canCreateOrders
          createOrderAction={createManagerOrder}
          commissionLabel="Manager earnings"
          commissionDetailLabel="Manager earnings"
          productEstimateLabel="est. manager earnings"
          successMessage="Order created successfully. Manager earnings are pending approval."
          ownershipCopy="Manager sales are attributed to your manager profile and partner. Team sales remain visible in your manager workspace."
          createdOrderId={params.created}
          error={params.error}
        />

        <div className="grid gap-4 md:grid-cols-3">
          <Card className="p-5">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Manager-scope revenue</p>
            <p className="mt-3 text-3xl font-semibold text-clinic-navy">{formatCurrency(totalRevenueCents)}</p>
          </Card>
          <Card className="p-5">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Manager earnings</p>
            <p className="mt-3 text-3xl font-semibold text-clinic-navy">{formatCurrency(managerEarningsCents)}</p>
          </Card>
          <Card className="p-5">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Team payout activity</p>
            <p className="mt-3 text-3xl font-semibold text-clinic-red">{formatCurrency(downlinePayoutCents)}</p>
          </Card>
        </div>

        <Card className="overflow-hidden">
          <div className="border-b border-border p-5">
            <Badge className="border-blue-100 bg-blue-50 text-clinic-navy">Manager scope</Badge>
            <h2 className="mt-4 text-2xl font-semibold text-clinic-ink">Manager sales workspace</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              Includes your direct manager sales plus orders from leaders and agents assigned to your manager profile.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead className="bg-clinic-mist text-xs uppercase tracking-[0.14em] text-slate-500">
                <tr>
                  <th className="px-5 py-3">Customer</th>
                  <th className="px-5 py-3">Agent</th>
                  <th className="px-5 py-3">Products</th>
                  <th className="px-5 py-3">Total</th>
                  <th className="px-5 py-3">Manager earnings</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-white">
                {orders.map((order) => {
                  const managerProfit = order.commissionSplits
                    .filter((split) => split.participantRole === "MANAGER")
                    .reduce((sum, split) => sum + split.amountCents, 0);
                  return (
                    <tr key={order.id}>
                      <td className="px-5 py-4">
                        <p className="font-semibold text-clinic-ink">{personName(order.customer)}</p>
                        <p className="mt-1 text-xs text-slate-500">{order.customer.email}</p>
                      </td>
                      <td className="px-5 py-4 text-slate-600">
                        {order.consultantProfile ? personName(order.consultantProfile.user) : order.groupLeaderProfile ? personName(order.groupLeaderProfile.user) : "Manager direct"}
                      </td>
                      <td className="px-5 py-4 text-slate-600">
                        <p className="line-clamp-2">{order.items.map((item) => `${item.quantity}x ${item.product.title}`).join(", ")}</p>
                      </td>
                      <td className="px-5 py-4 font-semibold text-clinic-ink">{formatCurrency(order.totalCents)}</td>
                      <td className="px-5 py-4 font-semibold text-clinic-navy">{formatCurrency(managerProfit)}</td>
                      <td className="px-5 py-4">
                        <div className="flex flex-wrap gap-2">
                          <Badge>{order.orderStatus}</Badge>
                          <Badge className="border-blue-100 bg-blue-50 text-clinic-navy">{order.paymentStatus}</Badge>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-slate-600">{order.createdAt.toLocaleDateString()}</td>
                    </tr>
                  );
                })}
                {orders.length === 0 ? (
                  <tr>
                    <td className="px-5 py-10 text-center text-slate-500" colSpan={7}>No manager sales yet.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </SidebarShell>
  );
}
