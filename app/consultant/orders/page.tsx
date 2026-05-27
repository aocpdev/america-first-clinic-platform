import { SidebarShell } from "@/components/layout/sidebar-shell";
import { OrdersTable } from "@/components/orders/orders-table";
import type { RecordFiltersState } from "@/components/filters/record-filters";
import { Card } from "@/components/ui/card";
import { requireApprovedConsultant } from "@/lib/auth/current-user";
import { consultantNav } from "@/lib/constants/navigation";
import { prisma } from "@/lib/db/prisma";
import { mapOrderRows, orderListInclude } from "@/lib/orders/queries";
import { currency } from "@/lib/utils";

export default async function ConsultantOrdersPage({ searchParams }: { searchParams: Promise<RecordFiltersState> }) {
  const filters = await searchParams;
  const user = await requireApprovedConsultant();
  const consultantProfile = user.consultantProfile;
  const orders = consultantProfile
    ? await prisma.order.findMany({
        where: { consultantProfileId: consultantProfile.id },
        include: orderListInclude,
        orderBy: { createdAt: "desc" },
        take: 100
      })
    : [];
  const rows = mapOrderRows(orders);
  const totalRevenueCents = rows.reduce((sum, order) => sum + order.totalCents, 0);
  const commissionCents = rows.reduce((sum, order) => sum + order.consultantCommissionCents, 0);

  return (
    <SidebarShell nav={consultantNav} eyebrow="Consultant" title="Orders">
      <div className="space-y-6">
        {!consultantProfile ? (
          <Card className="p-6">
            <h2 className="text-xl font-semibold text-clinic-ink">Consultant profile not configured</h2>
            <p className="mt-2 text-slate-600">Your account needs an active consultant profile before orders appear here.</p>
          </Card>
        ) : null}
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="p-5">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">My order revenue</p>
            <p className="mt-3 text-3xl font-semibold text-clinic-navy">{currency(totalRevenueCents / 100)}</p>
          </Card>
          <Card className="p-5">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">My commission</p>
            <p className="mt-3 text-3xl font-semibold text-clinic-red">{currency(commissionCents / 100)}</p>
          </Card>
        </div>
        <OrdersTable orders={rows} mode="consultant" filters={filters} />
      </div>
    </SidebarShell>
  );
}
