import { SidebarShell } from "@/components/layout/sidebar-shell";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { partnerNav } from "@/lib/constants/navigation";
import { requirePartner } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db/prisma";

export default async function PartnerConsultantsPage() {
  const user = await requirePartner();
  const partnerProfile = await prisma.partnerProfile.findUnique({ where: { userId: user.id } });
  const consultants = partnerProfile
    ? await prisma.consultantProfile.findMany({
        where: { partnerProfileId: partnerProfile.id },
        include: { user: true },
        orderBy: { createdAt: "desc" }
      })
    : [];

  return (
    <SidebarShell nav={partnerNav} eyebrow="Partner" title="My consultants">
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
    </SidebarShell>
  );
}
