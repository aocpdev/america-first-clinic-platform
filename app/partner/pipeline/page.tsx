import { CustomerPipelineBoard } from "@/components/pipeline/customer-pipeline-board";
import { SidebarShell } from "@/components/layout/sidebar-shell";
import { Card } from "@/components/ui/card";
import { requirePartner } from "@/lib/auth/current-user";
import { partnerNav } from "@/lib/constants/navigation";
import { prisma } from "@/lib/db/prisma";
import { CUSTOMER_PIPELINE_STAGES, type CustomerPipelineStage } from "@/lib/sales/pipeline";

function customerName(customer: { firstName: string | null; lastName: string | null; email: string }) {
  return [customer.firstName, customer.lastName].filter(Boolean).join(" ").trim() || customer.email;
}

function consultantName(profile: { user: { firstName: string | null; lastName: string | null; email: string } } | null) {
  if (!profile) return null;
  return [profile.user.firstName, profile.user.lastName].filter(Boolean).join(" ").trim() || profile.user.email;
}

function normalizeStage(stage: string): CustomerPipelineStage {
  return CUSTOMER_PIPELINE_STAGES.some((item) => item.value === stage)
    ? (stage as CustomerPipelineStage)
    : "NEW_LEAD";
}

export default async function PartnerPipelinePage() {
  const user = await requirePartner();
  const partnerProfile = await prisma.partnerProfile.findUnique({ where: { userId: user.id } });

  if (user.role === "PARTNER" && !partnerProfile) {
    return (
      <SidebarShell nav={partnerNav} eyebrow="Partner" title="Pipeline">
        <Card className="p-6">
          <h2 className="text-xl font-semibold text-clinic-ink">Partner profile not configured</h2>
          <p className="mt-2 text-slate-600">An owner must create and assign your partner profile before pipeline visibility is available.</p>
        </Card>
      </SidebarShell>
    );
  }

  const customers = await prisma.customer.findMany({
    where: {
      companyId: user.companyId ?? undefined,
      OR: partnerProfile
        ? [
            { partnerProfileId: partnerProfile.id },
            { consultantProfile: { partnerProfileId: partnerProfile.id } }
          ]
        : undefined
    },
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
    <SidebarShell nav={partnerNav} eyebrow="Partner" title="Sales pipeline">
      <div className="space-y-6">
        <Card className="p-6">
          <h2 className="text-2xl font-semibold text-clinic-ink">Partner customer pipeline</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            Monitor direct partner customers and customers owned by consultants assigned to {partnerProfile?.companyName ?? partnerProfile?.displayName ?? "your partner profile"}.
          </p>
        </Card>
        <CustomerPipelineBoard
          customers={customers.map((customer) => ({
            id: customer.id,
            name: customerName(customer),
            email: customer.email,
            phone: customer.phone,
            consultantName: consultantName(customer.consultantProfile) ?? (customer.partnerProfile ? consultantName(customer.partnerProfile) : null),
            consultantAvatarUrl: customer.consultantProfile?.user.avatarUrl ?? customer.partnerProfile?.user.avatarUrl ?? null,
            pipelineStage: normalizeStage(customer.pipelineStage),
            pipelineUpdatedAt: customer.pipelineUpdatedAt?.toISOString() ?? null,
            lifetimeValueCents: customer.lifetimeValueCents,
            latestOrderTotalCents: customer.orders[0]?.totalCents ?? null,
            latestOrderCreatedAt: customer.orders[0]?.createdAt.toISOString() ?? null,
            notes: customer.notes
          }))}
          showConsultant
        />
      </div>
    </SidebarShell>
  );
}
