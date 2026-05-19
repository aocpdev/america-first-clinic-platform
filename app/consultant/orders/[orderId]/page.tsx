import { notFound } from "next/navigation";
import { SidebarShell } from "@/components/layout/sidebar-shell";
import { OrderDocument } from "@/components/orders/order-document";
import { requireApprovedConsultant } from "@/lib/auth/current-user";
import { consultantNav } from "@/lib/constants/navigation";
import { prisma } from "@/lib/db/prisma";
import { orderListInclude } from "@/lib/orders/queries";

export default async function ConsultantOrderDetailPage({
  params,
  searchParams
}: {
  params: Promise<{ orderId: string }>;
  searchParams?: Promise<{ payment?: string }>;
}) {
  const { orderId } = await params;
  const paymentStatus = (await searchParams)?.payment;
  const user = await requireApprovedConsultant();
  const order = user.consultantProfile
    ? await prisma.order.findFirst({
        where: {
          id: orderId,
          consultantProfileId: user.consultantProfile.id
        },
        include: orderListInclude
      })
    : null;

  if (!order) notFound();

  return (
    <SidebarShell nav={consultantNav} eyebrow="Consultant" title="Order document">
      <div className="space-y-6">
        {paymentStatus === "success" ? (
          <div className="rounded-[24px] border border-emerald-200 bg-emerald-50 px-6 py-5 text-lg font-black text-emerald-900">
            Payment completed. Stripe will confirm the final order status through the webhook.
          </div>
        ) : null}
        <OrderDocument order={order} mode="consultant" variant="internal" />
        <OrderDocument order={order} mode="consultant" variant="receipt" />
      </div>
    </SidebarShell>
  );
}
