import { SidebarShell } from "@/components/layout/sidebar-shell";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { groupLeaderNav, partnerNav } from "@/lib/constants/navigation";
import { requirePartner } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db/prisma";
import { currency } from "@/lib/utils";

export default async function PartnerPayoutsPage() {
  const user = await requirePartner();
  const isGroupLeader = user.role === "GROUP_LEADER";
  const nav = isGroupLeader ? groupLeaderNav : partnerNav;
  const partnerProfile = await prisma.partnerProfile.findUnique({ where: { userId: user.id } });
  const payouts = partnerProfile
    ? await prisma.commissionSplit.findMany({
        where: {
          partnerProfileId: partnerProfile.id,
          participantRole: "CONSULTANT"
        },
        include: { consultantProfile: { include: { user: true } } },
        orderBy: { createdAt: "desc" }
      })
    : [];

  return (
    <SidebarShell nav={nav} eyebrow={isGroupLeader ? "Group leader" : "Partner"} title="Consultant payouts">
      {isGroupLeader ? (
        <Card className="p-6">
          <h2 className="text-xl font-semibold text-clinic-ink">Payouts are managed by the partner</h2>
          <p className="mt-2 text-slate-600">Leaders can review their own commission ledger, but consultant payout management belongs to the partner.</p>
        </Card>
      ) : null}
      {!isGroupLeader ? (
      <>
      <Card className="p-6">
        <h2 className="text-2xl font-semibold text-clinic-ink">Partner-paid seller payouts</h2>
        <p className="mt-2 text-slate-600">These are the consultant commission amounts the partner is responsible for paying.</p>
      </Card>
      <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {payouts.map((payout) => (
          <Card key={payout.id} className="p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-clinic-ink">
                  {[payout.consultantProfile?.user.firstName, payout.consultantProfile?.user.lastName].filter(Boolean).join(" ")}
                </p>
                <p className="mt-2 text-2xl font-semibold text-clinic-navy">{currency(payout.amountCents / 100)}</p>
              </div>
              <Badge>{payout.status}</Badge>
            </div>
            <p className="mt-4 text-sm text-slate-500">Responsibility: {payout.payoutResponsibility}</p>
          </Card>
        ))}
        {payouts.length === 0 && <p className="text-sm text-slate-500">No consultant payouts yet.</p>}
      </div>
      </>
      ) : null}
    </SidebarShell>
  );
}
