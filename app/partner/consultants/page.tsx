import { approveConsultant, rejectConsultant } from "@/app/(auth)/actions";
import { SidebarShell } from "@/components/layout/sidebar-shell";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { SubmitButton } from "@/components/ui/submit-button";
import { partnerNav } from "@/lib/constants/navigation";
import { requirePartner } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db/prisma";

export default async function PartnerConsultantsPage() {
  const user = await requirePartner();
  const partnerProfile = await prisma.partnerProfile.findUnique({ where: { userId: user.id } });
  const [pendingConsultants, consultants] = partnerProfile
    ? await Promise.all([
        prisma.user.findMany({
          where: {
            requestedRole: "CONSULTANT",
            status: "PENDING_APPROVAL",
            requestedPartnerProfileId: partnerProfile.id
          },
          orderBy: { createdAt: "desc" }
        }),
        prisma.consultantProfile.findMany({
          where: { partnerProfileId: partnerProfile.id },
          include: { user: true },
          orderBy: { createdAt: "desc" }
        })
      ])
    : [[], []];

  return (
    <SidebarShell nav={partnerNav} eyebrow="Partner" title="My consultants">
      <div className="space-y-6">
        <Card className="overflow-hidden">
          <div className="border-b border-border p-5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-clinic-ink">Pending consultant applications</h2>
                <p className="mt-1 text-sm text-slate-500">
                  These sellers selected {partnerProfile?.companyName ?? partnerProfile?.displayName ?? "your company"} during registration.
                </p>
              </div>
              <Badge className="w-fit border-amber-200 bg-amber-50 text-amber-700">{pendingConsultants.length} pending</Badge>
            </div>
          </div>
          <div className="divide-y divide-border bg-white">
            {pendingConsultants.map((applicant) => (
              <div key={applicant.id} className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="font-semibold text-clinic-ink">
                    {[applicant.firstName, applicant.lastName].filter(Boolean).join(" ") || "Unnamed applicant"}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">{applicant.email}</p>
                  <p className="mt-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                    Requested {new Intl.DateTimeFormat("en-US").format(applicant.createdAt)}
                  </p>
                </div>
                <div className="flex gap-2">
                  <form action={rejectConsultant}>
                    <input type="hidden" name="userId" value={applicant.id} />
                    <input type="hidden" name="reason" value="Application rejected by partner." />
                    <SubmitButton size="sm" variant="outline" pendingText="Rejecting...">Reject</SubmitButton>
                  </form>
                  <form action={approveConsultant}>
                    <input type="hidden" name="userId" value={applicant.id} />
                    <SubmitButton size="sm" variant="accent" pendingText="Approving...">Approve</SubmitButton>
                  </form>
                </div>
              </div>
            ))}
            {pendingConsultants.length === 0 && (
              <p className="p-5 text-sm text-slate-500">No consultant applications are waiting for your approval.</p>
            )}
          </div>
        </Card>

        <Card className="overflow-hidden">
          <div className="border-b border-border p-5">
            <h2 className="text-lg font-semibold text-clinic-ink">Assigned seller network</h2>
            <p className="mt-1 text-sm text-slate-500">These consultants roll up to your partner dashboard and payout queue.</p>
          </div>
          <div className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-3">
            {consultants.map((profile) => (
              <div key={profile.id} className="rounded-xl border border-border p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-clinic-ink">{[profile.user.firstName, profile.user.lastName].filter(Boolean).join(" ")}</p>
                    <p className="mt-1 text-sm text-slate-500">{profile.user.email}</p>
                  </div>
                  <Badge>Consultant</Badge>
                </div>
                <p className="mt-4 rounded-lg bg-clinic-mist p-3 text-sm font-semibold text-clinic-navy">/c/{profile.referralSlug}</p>
              </div>
            ))}
            {consultants.length === 0 && <p className="text-sm text-slate-500">No consultants are assigned to this partner yet.</p>}
          </div>
        </Card>
      </div>
    </SidebarShell>
  );
}
