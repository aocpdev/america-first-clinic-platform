import { notFound } from "next/navigation";
import { CustomerRecord } from "@/components/customers/customer-record";
import { BackNavigator } from "@/components/layout/back-navigator";
import { SidebarShell } from "@/components/layout/sidebar-shell";
import { requireApprovedConsultant } from "@/lib/auth/current-user";
import { consultantNav } from "@/lib/constants/navigation";
import { customerRecordInclude, mapCustomerRecord } from "@/lib/customers/queries";
import { prisma } from "@/lib/db/prisma";

export default async function ConsultantCustomerRecordPage({
  params
}: {
  params: Promise<{ customerId: string }>;
}) {
  const { customerId } = await params;
  const user = await requireApprovedConsultant();
  const customer = user.consultantProfile
    ? await prisma.customer.findFirst({
        where: {
          id: customerId,
          consultantProfileId: user.consultantProfile.id
        },
        include: customerRecordInclude
      })
    : null;

  if (!customer) notFound();

  return (
    <SidebarShell nav={consultantNav} eyebrow="Consultant" title="Customer record">
      <div className="space-y-6">
        <BackNavigator />
        <CustomerRecord customer={mapCustomerRecord(customer)} mode="consultant" />
      </div>
    </SidebarShell>
  );
}
