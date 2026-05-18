import { CustomerPipelineBoard } from "@/components/pipeline/customer-pipeline-board";
import { SidebarShell } from "@/components/layout/sidebar-shell";
import { Card } from "@/components/ui/card";
import { requireApprovedConsultant } from "@/lib/auth/current-user";
import { consultantNav } from "@/lib/constants/navigation";
import { prisma } from "@/lib/db/prisma";
import { CUSTOMER_PIPELINE_STAGES, type CustomerPipelineStage } from "@/lib/sales/pipeline";

function customerName(customer: { firstName: string | null; lastName: string | null; email: string }) {
  return [customer.firstName, customer.lastName].filter(Boolean).join(" ").trim() || customer.email;
}

function normalizeStage(stage: string): CustomerPipelineStage {
  return CUSTOMER_PIPELINE_STAGES.some((item) => item.value === stage)
    ? (stage as CustomerPipelineStage)
    : "NEW_LEAD";
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

  const customers = await prisma.customer.findMany({
    where: {
      companyId,
      consultantProfileId
    },
    include: {
      orders: {
        orderBy: { createdAt: "desc" },
        take: 1
      }
    },
    orderBy: [{ pipelineUpdatedAt: "desc" }, { updatedAt: "desc" }]
  });

  return (
    <SidebarShell nav={consultantNav} eyebrow="Consultant" title="Sales pipeline">
      <div className="space-y-6">
        <Card className="p-6">
          <h2 className="text-2xl font-semibold text-clinic-ink">My customer pipeline</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            Track every assigned customer from lead to follow-up. This view only includes customers assigned to your consultant profile.
          </p>
        </Card>
        <CustomerPipelineBoard
          customers={customers.map((customer) => ({
            id: customer.id,
            name: customerName(customer),
            email: customer.email,
            phone: customer.phone,
            consultantName: null,
            pipelineStage: normalizeStage(customer.pipelineStage),
            pipelineUpdatedAt: customer.pipelineUpdatedAt?.toISOString() ?? null,
            lifetimeValueCents: customer.lifetimeValueCents,
            latestOrderTotalCents: customer.orders[0]?.totalCents ?? null,
            latestOrderCreatedAt: customer.orders[0]?.createdAt.toISOString() ?? null,
            notes: customer.notes
          }))}
        />
      </div>
    </SidebarShell>
  );
}
