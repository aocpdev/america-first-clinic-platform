import { CustomerPipelineBoard } from "@/components/pipeline/customer-pipeline-board";
import { SidebarShell } from "@/components/layout/sidebar-shell";
import { Card } from "@/components/ui/card";
import { requirePartner } from "@/lib/auth/current-user";
import { groupLeaderNav, partnerNav } from "@/lib/constants/navigation";
import { prisma } from "@/lib/db/prisma";
import { orderListInclude, type OrderListRecord } from "@/lib/orders/queries";
import { formatOrderShippingAddress, orderShippingAddress } from "@/lib/orders/shipping-address";
import { CUSTOMER_PIPELINE_STAGES, type CustomerPipelineStage } from "@/lib/sales/pipeline";

function customerName(customer: { firstName: string | null; lastName: string | null; email: string }) {
  return [customer.firstName, customer.lastName].filter(Boolean).join(" ").trim() || customer.email;
}

function personName(person: { firstName: string | null; lastName: string | null; email: string }) {
  return [person.firstName, person.lastName].filter(Boolean).join(" ").trim() || person.email;
}

function orderMetadata(order: OrderListRecord) {
  const metadata = order.referralMetadata;
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  return metadata as Record<string, unknown>;
}

function orderOriginator(order: OrderListRecord) {
  const commissionMode = orderMetadata(order)?.commissionMode;

  if (commissionMode === "CONSULTANT_PARTNER_SPLIT") return order.consultantProfile?.user ?? null;
  if (commissionMode === "GROUP_LEADER_DIRECT") return order.groupLeaderProfile?.user ?? null;
  if (commissionMode === "MANAGER_DIRECT") return order.managerProfile?.user ?? null;
  if (commissionMode === "PARTNER_DIRECT") return order.partnerProfile?.user ?? null;

  return order.consultantProfile?.user ?? order.groupLeaderProfile?.user ?? order.managerProfile?.user ?? order.partnerProfile?.user ?? null;
}

function normalizeStage(stage: string): CustomerPipelineStage {
  return CUSTOMER_PIPELINE_STAGES.some((item) => item.value === stage)
    ? (stage as CustomerPipelineStage)
    : "AWAITING_PAYMENT";
}

function splitAmount(order: OrderListRecord, role: "PARTNER" | "GROUP_LEADER") {
  return order.commissionSplits
    .filter((split) => split.participantRole === role)
    .reduce((sum, split) => sum + split.amountCents, 0);
}

function orderProducts(order: OrderListRecord) {
  return order.items.map((item) => `${item.quantity}x ${item.product.title}`).join(", ");
}

export default async function PartnerPipelinePage() {
  const user = await requirePartner();
  const isGroupLeader = user.role === "GROUP_LEADER";
  const nav = isGroupLeader ? groupLeaderNav : partnerNav;
  const partnerProfile = await prisma.partnerProfile.findUnique({ where: { userId: user.id } });
  const groupLeaderProfile = await prisma.groupLeaderProfile.findUnique({ where: { userId: user.id } });

  if (user.role === "PARTNER" && !partnerProfile) {
    return (
      <SidebarShell nav={nav} eyebrow="Partner" title="Pipeline">
        <Card className="p-6">
          <h2 className="text-xl font-semibold text-clinic-ink">Partner profile not configured</h2>
          <p className="mt-2 text-slate-600">An owner must create and assign your partner profile before pipeline visibility is available.</p>
        </Card>
      </SidebarShell>
    );
  }

  if (isGroupLeader && !groupLeaderProfile) {
    return (
      <SidebarShell nav={nav} eyebrow="Group leader" title="Pipeline">
        <Card className="p-6">
          <h2 className="text-xl font-semibold text-clinic-ink">Leader profile not configured</h2>
          <p className="mt-2 text-slate-600">An owner or partner must assign your leader profile before pipeline visibility is available.</p>
        </Card>
      </SidebarShell>
    );
  }

  const orders = await prisma.order.findMany({
    where: {
      companyId: user.companyId ?? undefined,
      OR: isGroupLeader
        ? [
            { groupLeaderProfileId: groupLeaderProfile!.id },
            { consultantProfile: { groupLeaderProfileId: groupLeaderProfile!.id } }
          ]
        : [
            { partnerProfileId: partnerProfile!.id },
            { consultantProfile: { partnerProfileId: partnerProfile!.id } }
          ]
    },
    include: orderListInclude,
    orderBy: [{ orderPipelineUpdatedAt: "desc" }, { createdAt: "desc" }]
  });

  return (
    <SidebarShell nav={nav} eyebrow={isGroupLeader ? "Group leader" : "Partner"} title="Sales pipeline">
      <div>
        <CustomerPipelineBoard
          customers={orders.map((order) => {
            const originator = orderOriginator(order);

            return {
              id: order.id,
              customerId: order.customerId,
              name: customerName(order.customer),
              email: order.customer.email,
              phone: order.customer.phone,
              dateOfBirth: order.customer.dateOfBirth?.toISOString() ?? null,
              consultantName: originator ? personName(originator) : null,
              consultantAvatarUrl: originator?.avatarUrl ?? null,
              pipelineStage: normalizeStage(order.orderPipelineStage),
              pipelineUpdatedAt: order.orderPipelineUpdatedAt?.toISOString() ?? null,
              orderTotalCents: order.totalCents,
              opportunityValueCents: isGroupLeader ? splitAmount(order, "GROUP_LEADER") : splitAmount(order, "PARTNER"),
              adminMarginCents: order.grossMarginCents,
              shippingAddress: formatOrderShippingAddress(orderShippingAddress(order.referralMetadata)),
              shippingCarrier: order.shippingCarrier,
              shippingTrackingCode: order.shippingTrackingCode,
              createdAt: order.createdAt.toISOString(),
              notes: order.orderNotes,
              rxNotes: null,
              rxDocumentUrl: null,
              gfeNotes: null,
              gfeDocumentUrl: null,
              paymentStatus: order.paymentStatus,
              orderStatus: order.orderStatus,
              qualiphy: null,
              clinicalDocuments: [],
              orderHistory: orders
                .filter((historyOrder) => historyOrder.customerId === order.customerId)
                .map((historyOrder) => ({
                  id: historyOrder.id,
                  createdAt: historyOrder.createdAt.toISOString(),
                  customerDateOfBirth: historyOrder.customer.dateOfBirth?.toISOString() ?? null,
                  orderTotalCents: historyOrder.totalCents,
                  opportunityValueCents: isGroupLeader ? splitAmount(historyOrder, "GROUP_LEADER") : splitAmount(historyOrder, "PARTNER"),
                  paymentStatus: historyOrder.paymentStatus,
                  orderStatus: historyOrder.orderStatus,
                  pipelineStage: historyOrder.orderPipelineStage,
                  shippingAddress: formatOrderShippingAddress(orderShippingAddress(historyOrder.referralMetadata)),
                  shippingCarrier: historyOrder.shippingCarrier,
                  shippingTrackingCode: historyOrder.shippingTrackingCode,
                  products: orderProducts(historyOrder)
                }))
            };
          })}
          showConsultant
          mode={isGroupLeader ? "group_leader" : "partner"}
          basePath="/partner"
        />
      </div>
    </SidebarShell>
  );
}
