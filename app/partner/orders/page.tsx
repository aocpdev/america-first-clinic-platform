import { SidebarShell } from "@/components/layout/sidebar-shell";
import { OrdersTable } from "@/components/orders/orders-table";
import { Card } from "@/components/ui/card";
import { requirePartner } from "@/lib/auth/current-user";
import { groupLeaderNav, partnerNav } from "@/lib/constants/navigation";
import { prisma } from "@/lib/db/prisma";
import { mapOrderRows, orderListInclude } from "@/lib/orders/queries";
import { currency } from "@/lib/utils";

export default async function PartnerOrdersPage() {
  const user = await requirePartner();
  const isGroupLeader = user.role === "GROUP_LEADER";
  const nav = isGroupLeader ? groupLeaderNav : partnerNav;
  const [partnerProfile, groupLeaderProfile] = await Promise.all([
    prisma.partnerProfile.findUnique({ where: { userId: user.id } }),
    prisma.groupLeaderProfile.findUnique({ where: { userId: user.id } })
  ]);

  const orders = partnerProfile || groupLeaderProfile
    ? await prisma.order.findMany({
        where: partnerProfile
          ? {
              OR: [
                { partnerProfileId: partnerProfile.id },
                { consultantProfile: { partnerProfileId: partnerProfile.id } }
              ]
            }
          : {
              OR: [
                { groupLeaderProfileId: groupLeaderProfile!.id },
                { consultantProfile: { groupLeaderProfileId: groupLeaderProfile!.id } }
              ]
            },
        include: orderListInclude,
        orderBy: { createdAt: "desc" },
        take: 200
      })
    : [];
  const rows = mapOrderRows(orders);
  const totalRevenueCents = rows.reduce((sum, order) => sum + order.totalCents, 0);
  const profitCents = rows.reduce((sum, order) => sum + (isGroupLeader ? order.leaderProfitCents : order.partnerProfitCents), 0);
  const consultantCommissionCents = rows.reduce((sum, order) => sum + order.consultantCommissionCents, 0);

  return (
    <SidebarShell nav={nav} eyebrow={isGroupLeader ? "Group leader" : "Partner"} title="Orders">
      <div className="space-y-6">
        {!partnerProfile && !groupLeaderProfile ? (
          <Card className="p-6">
            <h2 className="text-xl font-semibold text-clinic-ink">Order visibility not configured</h2>
            <p className="mt-2 text-slate-600">An owner must assign your partner or leader profile before orders appear here.</p>
          </Card>
        ) : null}
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="p-5">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Attributed revenue</p>
            <p className="mt-3 text-3xl font-semibold text-clinic-navy">{currency(totalRevenueCents / 100)}</p>
          </Card>
          <Card className="p-5">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">{isGroupLeader ? "Leader profit" : "Partner profit"}</p>
            <p className="mt-3 text-3xl font-semibold text-clinic-navy">{currency(profitCents / 100)}</p>
          </Card>
          <Card className="p-5">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Consultant commissions</p>
            <p className="mt-3 text-3xl font-semibold text-clinic-red">{currency(consultantCommissionCents / 100)}</p>
          </Card>
        </div>
        <OrdersTable orders={rows} mode={isGroupLeader ? "group_leader" : "partner"} />
      </div>
    </SidebarShell>
  );
}
