import { CustomerList } from "@/components/customers/customer-list";
import type { RecordFiltersState } from "@/components/filters/record-filters";
import { SidebarShell } from "@/components/layout/sidebar-shell";
import { requireManager } from "@/lib/auth/current-user";
import { managerNav } from "@/lib/constants/navigation";
import { customerListInclude, mapCustomerRows } from "@/lib/customers/queries";
import { prisma } from "@/lib/db/prisma";

export default async function ManagerCustomersPage({ searchParams }: { searchParams: Promise<RecordFiltersState> }) {
  const filters = await searchParams;
  const user = await requireManager();
  const managerProfile = await prisma.managerProfile.findUnique({ where: { userId: user.id } });

  const customers = await prisma.customer.findMany({
    where: managerProfile && user.companyId
      ? {
          companyId: user.companyId,
          OR: [
            { managerProfileId: managerProfile.id },
            { groupLeaderProfile: { managerProfileId: managerProfile.id } },
            { consultantProfile: { managerProfileId: managerProfile.id } },
            { consultantProfile: { groupLeaderProfile: { managerProfileId: managerProfile.id } } }
          ]
        }
      : { id: "__no_access__" },
    include: customerListInclude,
    orderBy: { updatedAt: "desc" },
    take: 250
  });

  return (
    <SidebarShell nav={managerNav} eyebrow="Manager" title="Customers">
      <CustomerList customers={mapCustomerRows(customers)} mode="partner" filters={filters} />
    </SidebarShell>
  );
}
