import { CustomerPipelineBoard } from "@/components/pipeline/customer-pipeline-board";
import { SidebarShell } from "@/components/layout/sidebar-shell";
import { Card } from "@/components/ui/card";
import { requireRole } from "@/lib/auth/current-user";
import { adminNav } from "@/lib/constants/navigation";
import { prisma } from "@/lib/db/prisma";
import { CUSTOMER_PIPELINE_STAGES, type CustomerPipelineStage } from "@/lib/sales/pipeline";

function normalizeStage(stage: string): CustomerPipelineStage {
  return CUSTOMER_PIPELINE_STAGES.some((item) => item.value === stage) ? (stage as CustomerPipelineStage) : "NEW_SALE";
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

  const customers = await prisma.customer.findMany({
    where: { companyId: user.companyId },
    include: {
      consultantProfile: {
        include: { user: true }
      },
      partnerProfile: {
        include: { user: true }
      },
      orders: {
        orderBy: { createdAt: "desc" },
        take: 1
      }
    },
    orderBy: [{ pipelineUpdatedAt: "desc" }, { updatedAt: "desc" }]
  });

  return (
    <SidebarShell nav={adminNav} eyebrow="Company admin" title="Pipeline">
      <div className="space-y-6">
        <Card className="p-5">
          <h2 className="text-2xl font-semibold text-clinic-ink">Company sales pipeline</h2>
          <p className="mt-2 text-slate-600">
            Admin view across direct admin customers, partner-owned customers, and consultant-owned customers.
          </p>
        </Card>
        <CustomerPipelineBoard
          customers={customers.map((customer) => {
            const ownerUser = customer.consultantProfile?.user ?? customer.partnerProfile?.user ?? null;
            return {
              id: customer.id,
              name: personName(customer),
              email: customer.email,
              phone: customer.phone,
              notes: customer.notes,
              pipelineStage: normalizeStage(customer.pipelineStage),
              pipelineUpdatedAt: customer.pipelineUpdatedAt?.toISOString() ?? null,
              lifetimeValueCents: customer.lifetimeValueCents,
              latestOrderTotalCents: customer.orders[0]?.totalCents ?? null,
              latestOrderCreatedAt: customer.orders[0]?.createdAt.toISOString() ?? null,
              consultantName: ownerUser ? personName(ownerUser) : "Admin",
              consultantAvatarUrl: ownerUser?.avatarUrl ?? null
            };
          })}
        />
      </div>
    </SidebarShell>
  );
}
