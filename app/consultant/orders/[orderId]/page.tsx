import { notFound } from "next/navigation";
import { SidebarShell } from "@/components/layout/sidebar-shell";
import { ConsultantPaymentCelebration } from "@/components/orders/consultant-payment-celebration";
import { OrderDocument } from "@/components/orders/order-document";
import { requireApprovedConsultant } from "@/lib/auth/current-user";
import { consultantNav } from "@/lib/constants/navigation";
import { prisma } from "@/lib/db/prisma";
import { orderListInclude, type OrderListRecord } from "@/lib/orders/queries";

function personName(person: { firstName: string | null; lastName: string | null; email?: string }) {
  return [person.firstName, person.lastName].filter(Boolean).join(" ").trim() || person.email || "Customer";
}

function consultantCommissionCents(order: OrderListRecord) {
  return order.commissionSplits
    .filter((split) => split.participantRole === "CONSULTANT")
    .reduce((sum, split) => sum + split.amountCents, 0);
}

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
          <ConsultantPaymentCelebration
            orderId={order.id}
            customerName={personName(order.customer)}
            orderTotalCents={order.totalCents}
            commissionCents={consultantCommissionCents(order)}
          />
        ) : null}
        <OrderDocument order={order} mode="consultant" variant="internal" />
        <OrderDocument order={order} mode="consultant" variant="receipt" />
      </div>
    </SidebarShell>
  );
}
