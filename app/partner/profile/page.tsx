import { updatePartnerCompany } from "@/app/profile/actions";
import { SidebarShell } from "@/components/layout/sidebar-shell";
import { ProfileSettings } from "@/components/profile/profile-settings";
import { TaxPayoutSetup } from "@/components/profile/tax-payout-setup";
import { Card } from "@/components/ui/card";
import { SubmitButton } from "@/components/ui/submit-button";
import { requireUser } from "@/lib/auth/current-user";
import { groupLeaderNav, partnerNav } from "@/lib/constants/navigation";
import { prisma } from "@/lib/db/prisma";
import { getPayoutSetup } from "@/lib/payments/payout-accounts";

export default async function PartnerProfilePage({
  searchParams
}: {
  searchParams: Promise<{ error?: string; updated?: string; stripe?: string }>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const isGroupLeader = user.role === "GROUP_LEADER";
  const partnerProfile = isGroupLeader ? null : await prisma.partnerProfile.findUnique({ where: { userId: user.id } });
  const payoutSetup = await getPayoutSetup(user, params.updated === "payout_setup" || params.stripe === "refresh");

  return (
    <SidebarShell nav={isGroupLeader ? groupLeaderNav : partnerNav} eyebrow={isGroupLeader ? "Group leader" : "Partner"} title="Profile">
      <ProfileSettings
        user={user}
        title={isGroupLeader ? "Leader profile" : "Partner profile"}
        description="Manage your personal information, tax setup, and verified destination for Go Virtual Health payments."
        error={params.error}
        updated={params.updated}
      >
        <TaxPayoutSetup setup={payoutSetup} />

        {!isGroupLeader ? (
          <Card className="p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-clinic-ink">Partner company</h3>
            <p className="mt-1 text-sm text-slate-500">Agents will select this company name when requesting access.</p>
            <form action={updatePartnerCompany} className="mt-5 flex flex-col gap-3 sm:flex-row">
              <input
                name="companyName"
                defaultValue={partnerProfile?.companyName ?? partnerProfile?.displayName ?? ""}
                placeholder="Company name"
                className="h-11 flex-1 rounded-xl border border-border bg-white px-3 text-sm outline-none transition focus:border-clinic-navy focus:ring-4 focus:ring-clinic-navy/10"
                required
              />
              <SubmitButton>Save company</SubmitButton>
            </form>
          </Card>
        ) : null}
      </ProfileSettings>
    </SidebarShell>
  );
}
