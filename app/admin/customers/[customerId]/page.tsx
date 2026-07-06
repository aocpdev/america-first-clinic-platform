import { notFound } from "next/navigation";
import { CustomerRecord } from "@/components/customers/customer-record";
import { BackNavigator } from "@/components/layout/back-navigator";
import { SidebarShell } from "@/components/layout/sidebar-shell";
import { adminNav } from "@/lib/constants/navigation";
import { customerRecordInclude, mapCustomerRecord } from "@/lib/customers/queries";
import { prisma } from "@/lib/db/prisma";

export default async function AdminCustomerRecordPage({
  params
}: {
  params: Promise<{ customerId: string }>;
}) {
  const { customerId } = await params;
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    include: customerRecordInclude
  });

  if (!customer) notFound();

  return (
    <SidebarShell nav={adminNav} eyebrow="Go Virtual Health" title="Customer record">
      <div className="space-y-6">
        <BackNavigator />
        <CustomerRecord customer={mapCustomerRecord(customer)} mode="admin" />
      </div>
    </SidebarShell>
  );
}
