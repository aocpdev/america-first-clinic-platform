import { CustomerPipelineBoard } from "@/components/pipeline/customer-pipeline-board";
import { SidebarShell } from "@/components/layout/sidebar-shell";
import { Card } from "@/components/ui/card";
import { requireRole } from "@/lib/auth/current-user";
import { adminNav } from "@/lib/constants/navigation";
import { prisma } from "@/lib/db/prisma";
import { orderListInclude, type OrderListRecord } from "@/lib/orders/queries";
import { formatOrderShippingAddress, orderShippingAddress } from "@/lib/orders/shipping-address";
import { getQualiphyExamList } from "@/lib/qualiphy/exams";
import { CUSTOMER_PIPELINE_STAGES, type CustomerPipelineStage } from "@/lib/sales/pipeline";

function normalizeStage(stage: string): CustomerPipelineStage {
  return CUSTOMER_PIPELINE_STAGES.some((item) => item.value === stage) ? (stage as CustomerPipelineStage) : "AWAITING_PAYMENT";
}

function personName(person: { firstName: string | null; lastName: string | null; email?: string }) {
  const name = [person.firstName, person.lastName].filter(Boolean).join(" ").trim();
  return name || person.email || "Unassigned";
}

function orderProducts(order: OrderListRecord) {
  return order.items.map((item) => `${item.quantity}x ${item.product.title}`).join(", ");
}

function orderMetadata(order: OrderListRecord) {
  const metadata = order.referralMetadata;
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  return metadata as Record<string, unknown>;
}

function metadataRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function numberOrStringValue(value: unknown) {
  return typeof value === "string" || typeof value === "number" ? value : null;
}

function qualiphyWorkflow(order: OrderListRecord) {
  const qualiphy = metadataRecord(orderMetadata(order)?.qualiphy);
  if (!qualiphy) return null;

  const exam = metadataRecord(qualiphy.exam);
  const invite = metadataRecord(qualiphy.invite);
  const events = Array.isArray(qualiphy.events) ? qualiphy.events : [];

  return {
    mode: stringValue(qualiphy.mode) ?? "SEND",
    isTest: qualiphy.isTest === true || stringValue(qualiphy.environment) === "test",
    examTitle: stringValue(exam?.title),
    examId: numberOrStringValue(exam?.id),
    meetingUrl: stringValue(invite?.meetingUrl),
    meetingUuid: stringValue(invite?.meetingUuid),
    patientExamId: numberOrStringValue(qualiphy.patientExamId) ?? numberOrStringValue(invite?.patientExamId),
    status: stringValue(invite?.status),
    sentAt: stringValue(invite?.sentAt),
    lastEvent: numberOrStringValue(qualiphy.lastEvent),
    lastStatus: stringValue(qualiphy.lastStatus),
    lastWebhookAt: stringValue(qualiphy.lastWebhookAt),
    eventCount: events.length
  };
}

function orderOriginator(order: OrderListRecord) {
  const commissionMode = orderMetadata(order)?.commissionMode;

  if (commissionMode === "CONSULTANT_PARTNER_SPLIT") return order.consultantProfile?.user ?? null;
  if (commissionMode === "GROUP_LEADER_DIRECT") return order.groupLeaderProfile?.user ?? null;
  if (commissionMode === "MANAGER_DIRECT") return order.managerProfile?.user ?? null;
  if (commissionMode === "PARTNER_DIRECT") return order.partnerProfile?.user ?? null;
  if (commissionMode === "ADMIN_DIRECT") return null;

  return order.consultantProfile?.user ?? order.groupLeaderProfile?.user ?? order.managerProfile?.user ?? order.partnerProfile?.user ?? null;
}

export default async function AdminPipelinePage() {
  const user = await requireRole("COMPANY_ADMIN");

  if (!user.companyId) {
    return (
      <SidebarShell nav={adminNav} eyebrow="Go Virtual Health" title="Pipeline">
        <Card className="p-6">
          <h2 className="text-xl font-semibold text-clinic-ink">Company setup required</h2>
          <p className="mt-2 text-slate-600">Your Go Virtual Health account must be connected to a company before viewing the pipeline.</p>
        </Card>
      </SidebarShell>
    );
  }

  const orders = await prisma.order.findMany({
    where: { companyId: user.companyId },
    include: orderListInclude,
    orderBy: [{ orderPipelineUpdatedAt: "desc" }, { createdAt: "desc" }]
  });
  const qualiphyExamList = await getQualiphyExamList();

  return (
    <SidebarShell nav={adminNav} eyebrow="Go Virtual Health" title="Pipeline">
      <CustomerPipelineBoard
        customers={orders.map((order) => {
          const ownerUser = orderOriginator(order);
          return {
            id: order.id,
            customerId: order.customerId,
            name: personName(order.customer),
            email: order.customer.email,
            phone: order.customer.phone,
            dateOfBirth: order.customer.dateOfBirth?.toISOString() ?? null,
            notes: order.orderNotes,
            pipelineStage: normalizeStage(order.orderPipelineStage),
            pipelineUpdatedAt: order.orderPipelineUpdatedAt?.toISOString() ?? null,
            orderTotalCents: order.totalCents,
            opportunityValueCents: order.grossMarginCents,
            adminMarginCents: order.grossMarginCents,
            shippingAddress: formatOrderShippingAddress(orderShippingAddress(order.referralMetadata)),
            shippingCarrier: order.shippingCarrier,
            shippingTrackingCode: order.shippingTrackingCode,
            createdAt: order.createdAt.toISOString(),
            consultantName: ownerUser ? personName(ownerUser) : "Go Virtual Health",
            consultantAvatarUrl: ownerUser?.avatarUrl ?? null,
            rxNotes: order.rxNotes,
            rxDocumentUrl: order.rxDocumentUrl,
            gfeNotes: order.gfeNotes,
            gfeDocumentUrl: order.gfeDocumentUrl,
            paymentStatus: order.paymentStatus,
            orderStatus: order.orderStatus,
            qualiphy: qualiphyWorkflow(order),
            clinicalDocuments: order.clinicalDocuments.map((document) => ({
              id: document.id,
              type: document.type,
              title: document.title,
              notes: document.notes,
              fileName: document.fileName,
              mimeType: document.mimeType,
              sizeBytes: document.sizeBytes,
              createdAt: document.createdAt.toISOString()
            })),
            orderHistory: orders
              .filter((historyOrder) => historyOrder.customerId === order.customerId)
              .map((historyOrder) => ({
                id: historyOrder.id,
                createdAt: historyOrder.createdAt.toISOString(),
                customerDateOfBirth: historyOrder.customer.dateOfBirth?.toISOString() ?? null,
                orderTotalCents: historyOrder.totalCents,
                opportunityValueCents: historyOrder.grossMarginCents,
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
        mode="admin"
        basePath="/admin"
        showConsultant
        qualiphyExams={qualiphyExamList.exams}
        qualiphyExamsError={qualiphyExamList.error}
      />
    </SidebarShell>
  );
}
