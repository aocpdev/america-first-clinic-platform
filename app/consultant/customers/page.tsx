import { CustomerList } from "@/components/customers/customer-list";
import type { RecordFiltersState } from "@/components/filters/record-filters";
import { SidebarShell } from "@/components/layout/sidebar-shell";
import { requireApprovedConsultant } from "@/lib/auth/current-user";
import { consultantNav } from "@/lib/constants/navigation";
import { customerListInclude, mapCustomerRows } from "@/lib/customers/queries";
import { prisma } from "@/lib/db/prisma";

export default async function ConsultantCustomersPage({ searchParams }: { searchParams: Promise<RecordFiltersState> }) {
  const filters = await searchParams;
  const user = await requireApprovedConsultant();
  const customers = user.consultantProfile
    ? await prisma.customer.findMany({
        where: { consultantProfileId: user.consultantProfile.id },
        include: customerListInclude,
        orderBy: { updatedAt: "desc" },
        take: 250
      })
    : [];

  return (
    <SidebarShell nav={consultantNav} eyebrow="Consultant" title="Customers">
      <CustomerList customers={mapCustomerRows(customers)} mode="consultant" filters={filters} />
    </SidebarShell>
  );
}
