import { notFound } from "next/navigation";
import { SidebarShell } from "@/components/layout/sidebar-shell";
import { OrderDocument } from "@/components/orders/order-document";
import { requirePartner } from "@/lib/auth/current-user";
import { groupLeaderNav, partnerNav } from "@/lib/constants/navigation";
import { prisma } from "@/lib/db/prisma";
import { orderListInclude } from "@/lib/orders/queries";

export default async function PartnerOrderDetailPage({
  params
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;
  const user = await requirePartner();
  const isGroupLeader = user.role === "GROUP_LEADER";
  const [partnerProfile, groupLeaderProfile] = await Promise.all([
    prisma.partnerProfile.findUnique({ where: { userId: user.id } }),
    prisma.groupLeaderProfile.findUnique({ where: { userId: user.id } })
  ]);
  const order = await prisma.order.findFirst({
    where: {
      id: orderId,
      ...(partnerProfile
        ? {
            OR: [
              { partnerProfileId: partnerProfile.id },
              { consultantProfile: { partnerProfileId: partnerProfile.id } }
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
    include: orderListInclude
  });

  if (!order) notFound();

  return (
    <SidebarShell nav={isGroupLeader ? groupLeaderNav : partnerNav} eyebrow={isGroupLeader ? "Group leader" : "Partner"} title="Order document">
      <div className="space-y-6">
        <OrderDocument order={order} mode={isGroupLeader ? "group_leader" : "partner"} variant="internal" />
        <OrderDocument order={order} mode={isGroupLeader ? "group_leader" : "partner"} variant="receipt" />
      </div>
    </SidebarShell>
  );
}
