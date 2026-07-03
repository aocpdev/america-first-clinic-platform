import { SidebarShell } from "@/components/layout/sidebar-shell";
import { OrdersTable } from "@/components/orders/orders-table";
import type { RecordFiltersState } from "@/components/filters/record-filters";
import { Card } from "@/components/ui/card";
import { adminNav } from "@/lib/constants/navigation";
import { prisma } from "@/lib/db/prisma";
import { mapOrderRows, orderListInclude } from "@/lib/orders/queries";
import { currency } from "@/lib/utils";

type AdminOrdersSearchParams = RecordFiltersState & {
  deleted?: string;
  delete?: string;
};

function deleteMessage(code?: string) {
  if (code === "captured") return "Captured orders cannot be deleted here. Refund or void the payment before removing a real captured order.";
  if (code === "not_found") return "That order was not found or is no longer available.";
  if (code === "not_allowed") return "Only admins can delete test orders.";
  return null;
}

export default async function AdminOrdersPage({ searchParams }: { searchParams: Promise<AdminOrdersSearchParams> }) {
  const filters = await searchParams;
  const deleteError = deleteMessage(filters.delete);
  const orders = await prisma.order.findMany({
    include: orderListInclude,
    orderBy: { createdAt: "desc" },
    take: 200
  });
  const rows = mapOrderRows(orders);
  const totalRevenueCents = rows.reduce((sum, order) => sum + order.totalCents, 0);
  const marginCents = rows.reduce((sum, order) => sum + order.grossMarginCents, 0);
  const poolCents = rows.reduce((sum, order) => sum + order.commissionPoolCents, 0);
  const agencyFeeCents = rows.reduce((sum, order) => sum + order.agencyFeeCents, 0);

  return (
    <SidebarShell nav={adminNav} eyebrow="Admin" title="Orders">
      <div className="space-y-6">
        {filters.deleted ? (
          <Card className="border-emerald-100 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">
            Test order #{filters.deleted} was deleted successfully.
          </Card>
        ) : null}
        {deleteError ? (
          <Card className="border-red-100 bg-red-50 p-4 text-sm font-semibold text-red-700">
            {deleteError}
          </Card>
        ) : null}
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
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
          <Card className="p-5">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Agency fee</p>
            <p className="mt-3 text-3xl font-semibold text-clinic-navy">{currency(agencyFeeCents / 100)}</p>
          </Card>
        </div>
        <OrdersTable orders={rows} mode="admin" filters={filters} />
      </div>
    </SidebarShell>
  );
}
