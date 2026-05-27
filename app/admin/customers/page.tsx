import { CustomerList } from "@/components/customers/customer-list";
import type { RecordFiltersState } from "@/components/filters/record-filters";
import { SidebarShell } from "@/components/layout/sidebar-shell";
import { adminNav } from "@/lib/constants/navigation";
import { customerListInclude, mapCustomerRows } from "@/lib/customers/queries";
import { prisma } from "@/lib/db/prisma";

export default async function AdminCustomersPage({ searchParams }: { searchParams: Promise<RecordFiltersState> }) {
  const filters = await searchParams;
  const customers = await prisma.customer.findMany({
    include: customerListInclude,
    orderBy: { updatedAt: "desc" },
    take: 250
  });

  return (
    <SidebarShell nav={adminNav} eyebrow="Admin" title="Customers">
      <CustomerList customers={mapCustomerRows(customers)} mode="admin" filters={filters} />
    </SidebarShell>
  );
}
