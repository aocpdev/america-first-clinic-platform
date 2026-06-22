import { notFound } from "next/navigation";
import { BackNavigator } from "@/components/layout/back-navigator";
import { SidebarShell } from "@/components/layout/sidebar-shell";
import { OrderDocument } from "@/components/orders/order-document";
import { adminNav } from "@/lib/constants/navigation";
import { prisma } from "@/lib/db/prisma";
import { orderListInclude } from "@/lib/orders/queries";

export default async function AdminOrderDetailPage({
  params,
  searchParams
}: {
  params: Promise<{ orderId: string }>;
  searchParams?: Promise<{ payment?: string; receipt?: string; delete?: string }>;
}) {
  const { orderId } = await params;
  const query = await searchParams;
  const paymentStatus = query?.payment;
  const receiptStatus = query?.receipt;
  const deleteStatus = query?.delete;
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: orderListInclude
  });

  if (!order) notFound();

  return (
    <SidebarShell nav={adminNav} eyebrow="Admin" title="Order document">
      <div className="space-y-6">
        <BackNavigator />
        {paymentStatus === "success" ? (
          <div className="rounded-[24px] border border-emerald-200 bg-emerald-50 px-6 py-5 text-lg font-black text-emerald-900">
            Payment completed. Stripe will confirm the final order status through the webhook.
          </div>
        ) : null}
        {receiptStatus === "sent" ? (
          <div className="rounded-[24px] border border-blue-200 bg-blue-50 px-6 py-5 text-lg font-black text-clinic-navy">
            Receipt resend webhook was queued.
          </div>
        ) : null}
        {deleteStatus === "captured" ? (
          <div className="rounded-[24px] border border-red-200 bg-red-50 px-6 py-5 text-lg font-black text-red-800">
            Captured orders cannot be deleted here. Refund or void the payment before removing a real captured order.
          </div>
        ) : null}
        <OrderDocument order={order} mode="admin" variant="internal" />
        <OrderDocument order={order} mode="admin" variant="receipt" />
      </div>
    </SidebarShell>
  );
}
