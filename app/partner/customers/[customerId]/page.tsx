import { notFound } from "next/navigation";
import { CustomerRecord } from "@/components/customers/customer-record";
import { BackNavigator } from "@/components/layout/back-navigator";
import { SidebarShell } from "@/components/layout/sidebar-shell";
import { requirePartner } from "@/lib/auth/current-user";
import { groupLeaderNav, partnerNav } from "@/lib/constants/navigation";
import { customerRecordInclude, mapCustomerRecord } from "@/lib/customers/queries";
import { prisma } from "@/lib/db/prisma";

export default async function PartnerCustomerRecordPage({
  params
}: {
  params: Promise<{ customerId: string }>;
}) {
  const { customerId } = await params;
  const user = await requirePartner();
  const isGroupLeader = user.role === "GROUP_LEADER";
  const [partnerProfile, groupLeaderProfile] = await Promise.all([
    prisma.partnerProfile.findUnique({ where: { userId: user.id } }),
    prisma.groupLeaderProfile.findUnique({ where: { userId: user.id } })
  ]);

  const customer = await prisma.customer.findFirst({
    where: {
      id: customerId,
      companyId: user.companyId!,
      ...(partnerProfile
        ? {
            OR: [
              { partnerProfileId: partnerProfile.id },
              { consultantProfile: { partnerProfileId: partnerProfile.id } },
              { groupLeaderProfile: { partnerProfileId: partnerProfile.id } }
            ]
          }
        : groupLeaderProfile
          ? {
              OR: [
                { groupLeaderProfileId: groupLeaderProfile.id },
                { consultantProfile: { groupLeaderProfileId: groupLeaderProfile.id } }
              ]
            }
          : { id: "__no_access__" })
    },
    include: customerRecordInclude
  });

  if (!customer) notFound();

  return (
    <SidebarShell nav={isGroupLeader ? groupLeaderNav : partnerNav} eyebrow={isGroupLeader ? "Group leader" : "Partner"} title="Customer record">
      <div className="space-y-6">
        <BackNavigator />
        <CustomerRecord customer={mapCustomerRecord(customer)} mode="partner" />
      </div>
    </SidebarShell>
  );
}
