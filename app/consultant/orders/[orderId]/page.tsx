import { notFound } from "next/navigation";
import { BackNavigator } from "@/components/layout/back-navigator";
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
  searchParams?: Promise<{ payment?: string; receipt?: string }>;
}) {
  const { orderId } = await params;
  const query = await searchParams;
  const paymentStatus = query?.payment;
  const receiptStatus = query?.receipt;
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
        <BackNavigator />
        {paymentStatus === "success" ? (
          <ConsultantPaymentCelebration
            orderId={order.id}
            customerName={personName(order.customer)}
            orderTotalCents={order.totalCents}
            commissionCents={consultantCommissionCents(order)}
          />
        ) : null}
        {receiptStatus === "sent" ? (
          <div className="rounded-[24px] border border-blue-200 bg-blue-50 px-6 py-5 text-lg font-black text-clinic-navy">
            Receipt resend webhook was queued.
          </div>
        ) : null}
        <OrderDocument order={order} mode="consultant" variant="internal" />
        <OrderDocument order={order} mode="consultant" variant="receipt" />
      </div>
    </SidebarShell>
  );
}
