import { notFound } from "next/navigation";
import { SidebarShell } from "@/components/layout/sidebar-shell";
import { OrderDocument } from "@/components/orders/order-document";
import { adminNav } from "@/lib/constants/navigation";
import { prisma } from "@/lib/db/prisma";
import { orderListInclude } from "@/lib/orders/queries";

export default async function AdminOrderDetailPage({
  params
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: orderListInclude
  });

  if (!order) notFound();

  return (
    <SidebarShell nav={adminNav} eyebrow="Admin" title="Order document">
      <div className="space-y-6">
        <OrderDocument order={order} mode="admin" variant="internal" />
        <OrderDocument order={order} mode="admin" variant="receipt" />
      </div>
    </SidebarShell>
  );
}
