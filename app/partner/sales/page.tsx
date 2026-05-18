import { SalesBuilderClient } from "@/app/consultant/sales/sales-builder-client";
import { createPartnerOrder } from "@/app/sales/actions";
import { SidebarShell } from "@/components/layout/sidebar-shell";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { requirePartner } from "@/lib/auth/current-user";
import { DEFAULT_MARGIN_POOL_BPS } from "@/lib/commissions/margin-split";
import { partnerNav } from "@/lib/constants/navigation";
import { prisma } from "@/lib/db/prisma";
import { formatCurrency } from "@/lib/products/catalog";

function personName(person: { firstName: string | null; lastName: string | null; email?: string }) {
  const name = [person.firstName, person.lastName].filter(Boolean).join(" ").trim();
  return name || person.email || "Unassigned";
}

function commissionPoolPerUnit(priceCents: number, internalCostCents: number) {
  const grossMarginCents = Math.max(0, priceCents - internalCostCents);
  return Math.round((grossMarginCents * DEFAULT_MARGIN_POOL_BPS) / 10000);
}

export default async function PartnerSalesPage({
  searchParams
}: {
  searchParams: Promise<{ created?: string; error?: string }>;
}) {
  const params = await searchParams;
  const user = await requirePartner();
  const partnerProfile = await prisma.partnerProfile.findUnique({
    where: { userId: user.id },
    select: { id: true, displayName: true }
  });

  const [customers, products, orders] = partnerProfile
    ? await Promise.all([
        prisma.customer.findMany({
          where: {
            companyId: user.companyId!,
            OR: [
              { partnerProfileId: partnerProfile.id },
              { consultantProfile: { partnerProfileId: partnerProfile.id } }
            ]
          },
          orderBy: [{ lastPurchaseAt: "desc" }, { createdAt: "desc" }],
          take: 120
        }),
        prisma.product.findMany({
          where: {
            companyId: user.companyId!,
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
          OR: [
            { partnerProfileId: partnerProfile.id },
            { consultantProfile: { partnerProfileId: partnerProfile.id } }
          ]
        },
        include: {
          customer: true,
          consultantProfile: {
            include: { user: true }
          },
          items: {
            include: {
              product: {
                select: { title: true }
              }
            }
          },
          commissionSplits: {
            where: { partnerProfileId: partnerProfile.id }
          }
        },
        orderBy: { createdAt: "desc" },
        take: 100
        })
      ])
    : [[], [], []];

  const totalRevenueCents = orders.reduce((sum, order) => sum + order.totalCents, 0);
  const partnerProfitCents = orders.reduce(
    (sum, order) => sum + order.commissionSplits.filter((split) => split.participantRole === "PARTNER").reduce((splitSum, split) => splitSum + split.amountCents, 0),
    0
  );
  const consultantPayoutCents = orders.reduce(
    (sum, order) => sum + order.commissionSplits.filter((split) => split.participantRole === "CONSULTANT").reduce((splitSum, split) => splitSum + split.amountCents, 0),
    0
  );

  return (
    <SidebarShell nav={partnerNav} eyebrow="Partner" title="Sales">
      <div className="space-y-6">
        {!partnerProfile && (
          <Card className="p-6">
            <h2 className="text-xl font-semibold text-clinic-ink">Partner profile not configured</h2>
            <p className="mt-2 text-slate-600">An owner must create and assign your partner profile before sales appear here.</p>
          </Card>
        )}

        {partnerProfile && (
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
              estimatedCommissionCents: commissionPoolPerUnit(product.priceCents, product.internalCostCents),
              imageUrl: product.images[0]?.url ?? null,
              imageAlt: product.images[0]?.alt ?? null,
              supportsRecurring: product.supportsRecurring,
              supportsSubscription: product.supportsSubscription
            }))}
            recentOrders={orders.slice(0, 8).map((order) => ({
              id: order.id,
              customerName: personName(order.customer),
              totalCents: order.totalCents,
              commissionCents: order.commissionSplits
                .filter((split) => split.participantRole === "PARTNER")
                .reduce((sum, split) => sum + split.amountCents, 0),
              orderStatus: order.orderStatus,
              paymentStatus: order.paymentStatus,
              createdAt: order.createdAt.toISOString()
            }))}
            canCreateOrders={Boolean(partnerProfile)}
            createOrderAction={createPartnerOrder}
            commissionLabel="Profit generated"
            commissionDetailLabel="Profit generated"
            productEstimateLabel="est. profit"
            successMessage="Order created successfully. The partner profit is pending approval."
            ownershipCopy="Partner sales can be created for direct partner customers or customers owned by consultants assigned to this partner profile."
            createdOrderId={params.created}
            error={params.error}
          />
        )}

        <div className="grid gap-4 md:grid-cols-3">
          <Card className="p-5">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Attributed revenue</p>
            <p className="mt-3 text-3xl font-semibold text-clinic-navy">{formatCurrency(totalRevenueCents)}</p>
          </Card>
          <Card className="p-5">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Partner profit</p>
            <p className="mt-3 text-3xl font-semibold text-clinic-navy">{formatCurrency(partnerProfitCents)}</p>
          </Card>
          <Card className="p-5">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Consultant payouts</p>
            <p className="mt-3 text-3xl font-semibold text-clinic-red">{formatCurrency(consultantPayoutCents)}</p>
          </Card>
        </div>

        <Card className="overflow-hidden">
          <div className="border-b border-border p-5">
            <Badge className="border-blue-100 bg-blue-50 text-clinic-navy">Partner-attributed only</Badge>
            <h2 className="mt-4 text-2xl font-semibold text-clinic-ink">Partner sales workspace</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              This list includes orders created directly by this partner and orders created by consultants assigned to this partner profile.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead className="bg-clinic-mist text-xs uppercase tracking-[0.14em] text-slate-500">
                <tr>
                  <th className="px-5 py-3">Customer</th>
                  <th className="px-5 py-3">Consultant</th>
                  <th className="px-5 py-3">Products</th>
                  <th className="px-5 py-3">Total</th>
                  <th className="px-5 py-3">Partner profit</th>
                  <th className="px-5 py-3">Consultant payout</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-white">
                {orders.map((order) => {
                  const partnerProfit = order.commissionSplits
                    .filter((split) => split.participantRole === "PARTNER")
                    .reduce((sum, split) => sum + split.amountCents, 0);
                  const consultantPayout = order.commissionSplits
                    .filter((split) => split.participantRole === "CONSULTANT")
                    .reduce((sum, split) => sum + split.amountCents, 0);

                  return (
                    <tr key={order.id}>
                      <td className="px-5 py-4">
                        <p className="font-semibold text-clinic-ink">{personName(order.customer)}</p>
                        <p className="mt-1 text-xs text-slate-500">{order.customer.email}</p>
                      </td>
                      <td className="px-5 py-4 text-slate-600">
                        {order.consultantProfile ? personName(order.consultantProfile.user) : "Unassigned"}
                      </td>
                      <td className="px-5 py-4 text-slate-600">
                        <p className="line-clamp-2">
                          {order.items.map((item) => `${item.quantity}x ${item.product.title}`).join(", ")}
                        </p>
                      </td>
                      <td className="px-5 py-4 font-semibold text-clinic-ink">{formatCurrency(order.totalCents)}</td>
                      <td className="px-5 py-4 font-semibold text-clinic-navy">{formatCurrency(partnerProfit)}</td>
                      <td className="px-5 py-4 font-semibold text-clinic-red">{formatCurrency(consultantPayout)}</td>
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
                {orders.length === 0 && (
                  <tr>
                    <td className="px-5 py-10 text-center text-slate-500" colSpan={8}>
                      No partner-attributed sales yet.
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
