import { SidebarShell } from "@/components/layout/sidebar-shell";
import { OrdersTable } from "@/components/orders/orders-table";
import type { RecordFiltersState } from "@/components/filters/record-filters";
import { Card } from "@/components/ui/card";
import { requireManager } from "@/lib/auth/current-user";
import { managerNav } from "@/lib/constants/navigation";
import { prisma } from "@/lib/db/prisma";
import { mapOrderRows, orderListInclude } from "@/lib/orders/queries";
import { currency } from "@/lib/utils";

export default async function ManagerOrdersPage({ searchParams }: { searchParams: Promise<RecordFiltersState> }) {
  const filters = await searchParams;
  const user = await requireManager();
  const managerProfile = await prisma.managerProfile.findUnique({ where: { userId: user.id } });

  const orders = user.companyId && managerProfile
    ? await prisma.order.findMany({
        where: {
          companyId: user.companyId,
          OR: [
            { managerProfileId: managerProfile.id },
            { groupLeaderProfile: { managerProfileId: managerProfile.id } },
            { consultantProfile: { managerProfileId: managerProfile.id } },
            { consultantProfile: { groupLeaderProfile: { managerProfileId: managerProfile.id } } }
          ]
        },
        include: orderListInclude,
        orderBy: { createdAt: "desc" },
        take: 200
      })
    : [];

  const rows = mapOrderRows(orders);
  const totalRevenueCents = rows.reduce((sum, order) => sum + order.totalCents, 0);
  const managerEarningsCents = rows.reduce((sum, order) => sum + order.managerProfitCents, 0);
  const teamCommissionCents = rows.reduce((sum, order) => sum + order.leaderProfitCents + order.consultantCommissionCents, 0);

  return (
    <SidebarShell nav={managerNav} eyebrow="Manager" title="Orders">
      <div className="space-y-6">
        {!managerProfile ? (
          <Card className="p-6">
            <h2 className="text-xl font-semibold text-clinic-ink">Order visibility not configured</h2>
            <p className="mt-2 text-slate-600">A partner or Go Virtual Health must assign your manager profile before orders appear here.</p>
          </Card>
        ) : null}
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="p-5">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Manager-scope revenue</p>
            <p className="mt-3 text-3xl font-semibold text-clinic-navy">{currency(totalRevenueCents / 100)}</p>
          </Card>
          <Card className="p-5">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Manager earnings</p>
            <p className="mt-3 text-3xl font-semibold text-clinic-navy">{currency(managerEarningsCents / 100)}</p>
          </Card>
          <Card className="p-5">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Team commissions</p>
            <p className="mt-3 text-3xl font-semibold text-clinic-red">{currency(teamCommissionCents / 100)}</p>
          </Card>
        </div>
        <OrdersTable orders={rows} mode="manager" filters={filters} />
      </div>
    </SidebarShell>
  );
}
