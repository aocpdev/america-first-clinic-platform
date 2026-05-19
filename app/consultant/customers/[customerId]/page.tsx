import { notFound } from "next/navigation";
import { CustomerRecord } from "@/components/customers/customer-record";
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
      <CustomerRecord customer={mapCustomerRecord(customer)} mode="consultant" />
    </SidebarShell>
  );
}
