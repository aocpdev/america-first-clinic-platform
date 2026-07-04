import { PayoutCenter } from "@/components/payouts/payout-center";
import type { RecordFiltersState } from "@/components/filters/record-filters";
import { SidebarShell } from "@/components/layout/sidebar-shell";
import { requirePartner } from "@/lib/auth/current-user";
import { getPartnerCommissionLedger, type CommissionLedgerScope } from "@/lib/commissions/queries";
import { groupLeaderNav, managerNav, partnerNav } from "@/lib/constants/navigation";
import { prisma } from "@/lib/db/prisma";
import { getPartnerCashRewardPayouts } from "@/lib/rewards/reward-engine";

function navigationForRole(role: string) {
  if (role === "MANAGER") return managerNav;
  if (role === "GROUP_LEADER") return groupLeaderNav;
  return partnerNav;
}

function scopeForRole(role: string): CommissionLedgerScope {
  if (role === "MANAGER") return "manager";
  if (role === "GROUP_LEADER") return "group_leader";
  return "partner";
}

function eyebrowForRole(role: string) {
  if (role === "MANAGER") return "Manager";
  if (role === "GROUP_LEADER") return "Leader";
  return "Partner";
}

export default async function PartnerPayoutsPage({ searchParams }: { searchParams: Promise<RecordFiltersState> }) {
  const filters = await searchParams;
  const user = await requirePartner();
  const [entries, rewardPayouts, partnerPayouts] = await Promise.all([
    getPartnerCommissionLedger(user),
    user.role === "PARTNER" && user.companyId && user.partnerProfile?.id
      ? getPartnerCashRewardPayouts({ companyId: user.companyId, partnerProfileId: user.partnerProfile.id })
      : Promise.resolve([]),
    user.role === "PARTNER" && user.companyId && user.partnerProfile?.id
      ? prisma.partnerPayout.findMany({
          where: { companyId: user.companyId, partnerProfileId: user.partnerProfile.id },
          include: { lines: { orderBy: { createdAt: "asc" } } },
          orderBy: { createdAt: "desc" },
          take: 12
        })
      : Promise.resolve([])
  ]);
  const scope = scopeForRole(user.role);

  return (
    <SidebarShell nav={navigationForRole(user.role)} eyebrow={eyebrowForRole(user.role)} title="Payouts">
      <PayoutCenter entries={entries} scope={scope} filters={filters} rewardPayouts={rewardPayouts} partnerPayouts={partnerPayouts} />
    </SidebarShell>
  );
}
