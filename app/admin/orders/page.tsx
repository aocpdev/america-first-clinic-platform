import { SidebarShell } from "@/components/layout/sidebar-shell";
import { OrdersTable } from "@/components/orders/orders-table";
import type { RecordFiltersState } from "@/components/filters/record-filters";
import { Card } from "@/components/ui/card";
import { adminNav } from "@/lib/constants/navigation";
import { prisma } from "@/lib/db/prisma";
import { mapOrderRows, orderListInclude } from "@/lib/orders/queries";
import { currency } from "@/lib/utils";

export default async function AdminOrdersPage({ searchParams }: { searchParams: Promise<RecordFiltersState> }) {
  const filters = await searchParams;
  const orders = await prisma.order.findMany({
    include: orderListInclude,
    orderBy: { createdAt: "desc" },
    take: 200
  });
  const rows = mapOrderRows(orders);
  const totalRevenueCents = rows.reduce((sum, order) => sum + order.totalCents, 0);
  const marginCents = rows.reduce((sum, order) => sum + order.grossMarginCents, 0);
  const poolCents = rows.reduce((sum, order) => sum + order.commissionPoolCents, 0);

  return (
    <SidebarShell nav={adminNav} eyebrow="Admin" title="Orders">
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="p-5">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Total revenue</p>
            <p className="mt-3 text-3xl font-semibold text-clinic-navy">{currency(totalRevenueCents / 100)}</p>
          </Card>
          <Card className="p-5">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Gross margin</p>
            <p className="mt-3 text-3xl font-semibold text-clinic-navy">{currency(marginCents / 100)}</p>
          </Card>
          <Card className="p-5">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Commission pool</p>
            <p className="mt-3 text-3xl font-semibold text-clinic-red">{currency(poolCents / 100)}</p>
          </Card>
        </div>
        <OrdersTable orders={rows} mode="admin" filters={filters} />
      </div>
    </SidebarShell>
  );
}
