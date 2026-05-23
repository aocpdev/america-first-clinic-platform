import { CustomerPipelineBoard } from "@/components/pipeline/customer-pipeline-board";
import { SidebarShell } from "@/components/layout/sidebar-shell";
import { Card } from "@/components/ui/card";
import { requireRole } from "@/lib/auth/current-user";
import { adminNav } from "@/lib/constants/navigation";
import { prisma } from "@/lib/db/prisma";
import { orderListInclude } from "@/lib/orders/queries";
import { CUSTOMER_PIPELINE_STAGES, type CustomerPipelineStage } from "@/lib/sales/pipeline";

function normalizeStage(stage: string): CustomerPipelineStage {
  return CUSTOMER_PIPELINE_STAGES.some((item) => item.value === stage) ? (stage as CustomerPipelineStage) : "AWAITING_PAYMENT";
}

function personName(person: { firstName: string | null; lastName: string | null; email?: string }) {
  const name = [person.firstName, person.lastName].filter(Boolean).join(" ").trim();
  return name || person.email || "Unassigned";
}

export default async function AdminPipelinePage() {
  const user = await requireRole("COMPANY_ADMIN");

  if (!user.companyId) {
    return (
      <SidebarShell nav={adminNav} eyebrow="Company admin" title="Pipeline">
        <Card className="p-6">
          <h2 className="text-xl font-semibold text-clinic-ink">Company setup required</h2>
          <p className="mt-2 text-slate-600">Your admin account must be connected to a company before viewing the pipeline.</p>
        </Card>
      </SidebarShell>
    );
  }

  const orders = await prisma.order.findMany({
    where: { companyId: user.companyId },
    include: orderListInclude,
    orderBy: [{ orderPipelineUpdatedAt: "desc" }, { createdAt: "desc" }]
  });

  return (
    <SidebarShell nav={adminNav} eyebrow="Company admin" title="Pipeline">
      <CustomerPipelineBoard
        customers={orders.map((order) => {
          const ownerUser = order.consultantProfile?.user ?? order.partnerProfile?.user ?? null;
          return {
            id: order.id,
            customerId: order.customerId,
            name: personName(order.customer),
            email: order.customer.email,
            phone: order.customer.phone,
            notes: order.orderNotes,
            pipelineStage: normalizeStage(order.orderPipelineStage),
            pipelineUpdatedAt: order.orderPipelineUpdatedAt?.toISOString() ?? null,
            orderTotalCents: order.totalCents,
            opportunityValueCents: order.grossMarginCents,
            adminMarginCents: order.grossMarginCents,
            createdAt: order.createdAt.toISOString(),
            consultantName: ownerUser ? personName(ownerUser) : "Admin",
            consultantAvatarUrl: ownerUser?.avatarUrl ?? null,
            rxNotes: order.rxNotes,
            rxDocumentUrl: order.rxDocumentUrl,
            gfeNotes: order.gfeNotes,
            gfeDocumentUrl: order.gfeDocumentUrl,
            paymentStatus: order.paymentStatus
          };
        })}
        mode="admin"
        basePath="/admin"
        showConsultant
      />
    </SidebarShell>
  );
}
