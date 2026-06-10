import { CustomerPipelineBoard } from "@/components/pipeline/customer-pipeline-board";
import { SidebarShell } from "@/components/layout/sidebar-shell";
import { Card } from "@/components/ui/card";
import { requireApprovedConsultant } from "@/lib/auth/current-user";
import { consultantNav } from "@/lib/constants/navigation";
import { prisma } from "@/lib/db/prisma";
import { orderListInclude, type OrderListRecord } from "@/lib/orders/queries";
import { CUSTOMER_PIPELINE_STAGES, type CustomerPipelineStage } from "@/lib/sales/pipeline";

function customerName(customer: { firstName: string | null; lastName: string | null; email: string }) {
  return [customer.firstName, customer.lastName].filter(Boolean).join(" ").trim() || customer.email;
}

function normalizeStage(stage: string): CustomerPipelineStage {
  return CUSTOMER_PIPELINE_STAGES.some((item) => item.value === stage)
    ? (stage as CustomerPipelineStage)
    : "AWAITING_PAYMENT";
}

function splitAmount(order: OrderListRecord, role: "CONSULTANT") {
  return order.commissionSplits
    .filter((split) => split.participantRole === role)
    .reduce((sum, split) => sum + split.amountCents, 0);
}

function orderProducts(order: OrderListRecord) {
  return order.items.map((item) => `${item.quantity}x ${item.product.title}`).join(", ");
}

export default async function ConsultantPipelinePage() {
  const user = await requireApprovedConsultant();
  const companyId = user.companyId;
  const consultantProfileId = user.consultantProfile?.id;

  if (!companyId || !consultantProfileId) {
    return (
      <SidebarShell nav={consultantNav} eyebrow="Consultant" title="Pipeline">
        <Card className="p-6">
          <h2 className="text-xl font-semibold text-clinic-ink">Consultant setup required</h2>
          <p className="mt-2 text-slate-600">Your account needs an active consultant profile before pipeline access is available.</p>
        </Card>
      </SidebarShell>
    );
  }

  const orders = await prisma.order.findMany({
    where: {
      companyId,
      consultantProfileId
    },
    include: orderListInclude,
    orderBy: [{ orderPipelineUpdatedAt: "desc" }, { createdAt: "desc" }]
  });

  return (
    <SidebarShell nav={consultantNav} eyebrow="Consultant" title="Sales pipeline">
      <CustomerPipelineBoard
        customers={orders.map((order) => ({
          id: order.id,
          customerId: order.customerId,
          name: customerName(order.customer),
          email: order.customer.email,
          phone: order.customer.phone,
          consultantName: [user.firstName, user.lastName].filter(Boolean).join(" ").trim() || user.email,
          consultantAvatarUrl: user.avatarUrl,
          pipelineStage: normalizeStage(order.orderPipelineStage),
          pipelineUpdatedAt: order.orderPipelineUpdatedAt?.toISOString() ?? null,
          orderTotalCents: order.totalCents,
          opportunityValueCents: splitAmount(order, "CONSULTANT"),
          adminMarginCents: order.grossMarginCents,
          createdAt: order.createdAt.toISOString(),
          notes: order.orderNotes,
          rxNotes: null,
          rxDocumentUrl: null,
          gfeNotes: null,
          gfeDocumentUrl: null,
          paymentStatus: order.paymentStatus,
          orderStatus: order.orderStatus,
          clinicalDocuments: [],
          orderHistory: orders
            .filter((historyOrder) => historyOrder.customerId === order.customerId)
            .map((historyOrder) => ({
              id: historyOrder.id,
              createdAt: historyOrder.createdAt.toISOString(),
              orderTotalCents: historyOrder.totalCents,
              opportunityValueCents: splitAmount(historyOrder, "CONSULTANT"),
              paymentStatus: historyOrder.paymentStatus,
              orderStatus: historyOrder.orderStatus,
              pipelineStage: historyOrder.orderPipelineStage,
              products: orderProducts(historyOrder)
            }))
        }))}
        mode="consultant"
        basePath="/consultant"
      />
    </SidebarShell>
  );
}
