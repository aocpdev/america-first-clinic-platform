import { notFound } from "next/navigation";
import { BackNavigator } from "@/components/layout/back-navigator";
import { SidebarShell } from "@/components/layout/sidebar-shell";
import { OrderDocument } from "@/components/orders/order-document";
import { requireManager } from "@/lib/auth/current-user";
import { managerNav } from "@/lib/constants/navigation";
import { prisma } from "@/lib/db/prisma";
import { orderListInclude } from "@/lib/orders/queries";

export default async function ManagerOrderDetailPage({
  params,
  searchParams
}: {
  params: Promise<{ orderId: string }>;
  searchParams?: Promise<{ payment?: string; receipt?: string }>;
}) {
  const { orderId } = await params;
  const query = await searchParams;
  const user = await requireManager();
  const managerProfile = await prisma.managerProfile.findUnique({ where: { userId: user.id } });
  const order = await prisma.order.findFirst({
    where: {
      id: orderId,
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
    include: orderListInclude
  });

  if (!order) notFound();

  return (
    <SidebarShell nav={managerNav} eyebrow="Manager" title="Order document">
      <div className="space-y-6">
        <BackNavigator />
        {query?.payment === "success" ? (
          <div className="rounded-[24px] border border-emerald-200 bg-emerald-50 px-6 py-5 text-lg font-black text-emerald-900">
            Payment completed. Stripe will confirm the final order status through the webhook.
          </div>
        ) : null}
        {query?.receipt === "sent" ? (
          <div className="rounded-[24px] border border-blue-200 bg-blue-50 px-6 py-5 text-lg font-black text-clinic-navy">
            Receipt resend webhook was queued.
          </div>
        ) : null}
        <OrderDocument order={order} mode="manager" variant="internal" />
        <OrderDocument order={order} mode="manager" variant="receipt" />
      </div>
    </SidebarShell>
  );
}
