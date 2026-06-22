import { notFound } from "next/navigation";
import { CustomerRecord } from "@/components/customers/customer-record";
import { BackNavigator } from "@/components/layout/back-navigator";
import { SidebarShell } from "@/components/layout/sidebar-shell";
import { requireManager } from "@/lib/auth/current-user";
import { managerNav } from "@/lib/constants/navigation";
import { customerRecordInclude, mapCustomerRecord } from "@/lib/customers/queries";
import { prisma } from "@/lib/db/prisma";

export default async function ManagerCustomerRecordPage({
  params
}: {
  params: Promise<{ customerId: string }>;
}) {
  const { customerId } = await params;
  const user = await requireManager();
  const managerProfile = await prisma.managerProfile.findUnique({ where: { userId: user.id } });

  const customer = await prisma.customer.findFirst({
    where: {
      id: customerId,
      companyId: user.companyId ?? undefined,
      ...(managerProfile
        ? {
            OR: [
              { managerProfileId: managerProfile.id },
              { groupLeaderProfile: { managerProfileId: managerProfile.id } },
              { consultantProfile: { managerProfileId: managerProfile.id } },
              { consultantProfile: { groupLeaderProfile: { managerProfileId: managerProfile.id } } }
            ]
          }
        : { id: "__no_access__" })
    },
    include: customerRecordInclude
  });

  if (!customer) notFound();

  return (
    <SidebarShell nav={managerNav} eyebrow="Manager" title="Customer record">
      <div className="space-y-6">
        <BackNavigator />
        <CustomerRecord customer={mapCustomerRecord(customer)} mode="partner" />
      </div>
    </SidebarShell>
  );
}
