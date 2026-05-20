import { CustomerList } from "@/components/customers/customer-list";
import { SidebarShell } from "@/components/layout/sidebar-shell";
import { requirePartner } from "@/lib/auth/current-user";
import { groupLeaderNav, partnerNav } from "@/lib/constants/navigation";
import { customerListInclude, mapCustomerRows } from "@/lib/customers/queries";
import { prisma } from "@/lib/db/prisma";

export default async function PartnerCustomersPage() {
  const user = await requirePartner();
  const isGroupLeader = user.role === "GROUP_LEADER";
  const [partnerProfile, groupLeaderProfile] = await Promise.all([
    prisma.partnerProfile.findUnique({ where: { userId: user.id } }),
    prisma.groupLeaderProfile.findUnique({ where: { userId: user.id } })
  ]);

  const customers = await prisma.customer.findMany({
    where: partnerProfile
      ? {
          companyId: user.companyId!,
          OR: [
            { partnerProfileId: partnerProfile.id },
            { consultantProfile: { partnerProfileId: partnerProfile.id } },
            { groupLeaderProfile: { partnerProfileId: partnerProfile.id } }
          ]
        }
      : groupLeaderProfile
        ? {
            companyId: user.companyId!,
            OR: [
              { groupLeaderProfileId: groupLeaderProfile.id },
              { consultantProfile: { groupLeaderProfileId: groupLeaderProfile.id } }
            ]
          }
        : { id: "__no_access__" },
    include: customerListInclude,
    orderBy: { updatedAt: "desc" },
    take: 250
  });

  return (
    <SidebarShell nav={isGroupLeader ? groupLeaderNav : partnerNav} eyebrow={isGroupLeader ? "Group leader" : "Partner"} title="Customers">
      <CustomerList customers={mapCustomerRows(customers)} mode="partner" />
    </SidebarShell>
  );
}
