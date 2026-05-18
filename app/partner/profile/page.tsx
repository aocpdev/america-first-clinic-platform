import { SidebarShell } from "@/components/layout/sidebar-shell";
import { ProfileSettings } from "@/components/profile/profile-settings";
import { Card } from "@/components/ui/card";
import { SubmitButton } from "@/components/ui/submit-button";
import { partnerNav } from "@/lib/constants/navigation";
import { requireUser } from "@/lib/auth/current-user";
import { updatePartnerCompany } from "@/app/profile/actions";
import { prisma } from "@/lib/db/prisma";

export default async function PartnerProfilePage({
  searchParams
}: {
  searchParams: Promise<{ error?: string; updated?: string }>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const partnerProfile = await prisma.partnerProfile.findUnique({ where: { userId: user.id } });

  return (
    <SidebarShell nav={partnerNav} eyebrow="Partner" title="Profile">
      <ProfileSettings
        user={user}
        title="Partner profile"
        description="Manage the partner identity used for assigned seller visibility, commission reporting, and internal activity."
        error={params.error}
        updated={params.updated}
      >
        <Card className="p-6 shadow-sm">
          <div>
            <h3 className="text-lg font-semibold text-clinic-ink">Partner company</h3>
            <p className="mt-1 text-sm text-slate-500">
              Consultants will select this company name when requesting access.
            </p>
          </div>
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
      </ProfileSettings>
    </SidebarShell>
  );
}
