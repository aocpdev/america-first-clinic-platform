import { SidebarShell } from "@/components/layout/sidebar-shell";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { requirePartner } from "@/lib/auth/current-user";
import { partnerNav } from "@/lib/constants/navigation";
import { prisma } from "@/lib/db/prisma";
import { formatCurrency } from "@/lib/products/catalog";

function personName(person: { firstName: string | null; lastName: string | null; email?: string }) {
  const name = [person.firstName, person.lastName].filter(Boolean).join(" ").trim();
  return name || person.email || "Unassigned";
}

export default async function PartnerSalesPage() {
  const user = await requirePartner();
  const partnerProfile = await prisma.partnerProfile.findUnique({
    where: { userId: user.id },
    select: { id: true, displayName: true }
  });

  const orders = partnerProfile
    ? await prisma.order.findMany({
        where: {
          consultantProfile: {
            partnerProfileId: partnerProfile.id
          }
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
    : [];

  const totalRevenueCents = orders.reduce((sum, order) => sum + order.totalCents, 0);
  const partnerCommissionCents = orders.reduce(
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

        <div className="grid gap-4 md:grid-cols-3">
          <Card className="p-5">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Attributed revenue</p>
            <p className="mt-3 text-3xl font-semibold text-clinic-navy">{formatCurrency(totalRevenueCents)}</p>
          </Card>
          <Card className="p-5">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Partner commission</p>
            <p className="mt-3 text-3xl font-semibold text-clinic-navy">{formatCurrency(partnerCommissionCents)}</p>
          </Card>
          <Card className="p-5">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Consultant payouts</p>
            <p className="mt-3 text-3xl font-semibold text-clinic-red">{formatCurrency(consultantPayoutCents)}</p>
          </Card>
        </div>

        <Card className="overflow-hidden">
          <div className="border-b border-border p-5">
            <Badge className="border-blue-100 bg-blue-50 text-clinic-navy">Partner-attributed only</Badge>
            <h2 className="mt-4 text-2xl font-semibold text-clinic-ink">Sales from assigned consultants</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              This list only includes orders created by consultants assigned to this partner profile.
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
                  <th className="px-5 py-3">Partner commission</th>
                  <th className="px-5 py-3">Consultant payout</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-white">
                {orders.map((order) => {
                  const partnerCommission = order.commissionSplits
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
                      <td className="px-5 py-4 font-semibold text-clinic-navy">{formatCurrency(partnerCommission)}</td>
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
