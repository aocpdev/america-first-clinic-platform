import { SidebarShell } from "@/components/layout/sidebar-shell";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { groupLeaderNav, partnerNav } from "@/lib/constants/navigation";
import { requirePartner } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db/prisma";
import { currency } from "@/lib/utils";

export default async function PartnerCommissionsPage() {
  const user = await requirePartner();
  const isGroupLeader = user.role === "GROUP_LEADER";
  const nav = isGroupLeader ? groupLeaderNav : partnerNav;
  const partnerProfile = await prisma.partnerProfile.findUnique({ where: { userId: user.id } });
  const groupLeaderProfile = await prisma.groupLeaderProfile.findUnique({ where: { userId: user.id } });
  const splits = partnerProfile || groupLeaderProfile
    ? await prisma.commissionSplit.findMany({
        where: partnerProfile
          ? { partnerProfileId: partnerProfile.id }
          : { groupLeaderProfileId: groupLeaderProfile!.id },
        include: {
          consultantProfile: { include: { user: true } },
          order: true
        },
        orderBy: { createdAt: "desc" },
        take: 50
      })
    : [];

  return (
    <SidebarShell nav={nav} eyebrow={isGroupLeader ? "Group leader" : "Partner"} title="Commission ledger">
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[840px] text-left text-sm">
            <thead className="bg-clinic-mist text-xs uppercase tracking-[0.14em] text-slate-500">
              <tr>
                <th className="px-5 py-3">Role</th>
                <th className="px-5 py-3">Consultant</th>
                <th className="px-5 py-3">Margin</th>
                <th className="px-5 py-3">Pool</th>
                <th className="px-5 py-3">Amount</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Paid by</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-white">
              {splits.map((split) => (
                <tr key={split.id}>
                  <td className="px-5 py-4 font-semibold text-clinic-ink">{split.participantRole}</td>
                  <td className="px-5 py-4 text-slate-600">
                    {[split.consultantProfile?.user.firstName, split.consultantProfile?.user.lastName].filter(Boolean).join(" ") || "Unassigned"}
                  </td>
                  <td className="px-5 py-4 text-slate-600">{currency(split.grossMarginCents / 100)}</td>
                  <td className="px-5 py-4 text-slate-600">{currency(split.commissionPoolCents / 100)}</td>
                  <td className="px-5 py-4 font-semibold text-clinic-navy">{currency(split.amountCents / 100)}</td>
                  <td className="px-5 py-4"><Badge>{split.status}</Badge></td>
                  <td className="px-5 py-4 text-slate-600">{split.payoutResponsibility}</td>
                </tr>
              ))}
              {splits.length === 0 && (
                <tr><td className="px-5 py-8 text-center text-slate-500" colSpan={7}>No commission ledger entries yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </SidebarShell>
  );
}
