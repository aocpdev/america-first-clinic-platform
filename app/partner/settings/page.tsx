import { SidebarShell } from "@/components/layout/sidebar-shell";
import { requirePartner } from "@/lib/auth/current-user";
import { groupLeaderNav, partnerNav } from "@/lib/constants/navigation";
import { prisma } from "@/lib/db/prisma";
import { WebhookSettings } from "@/components/settings/webhook-settings";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default async function PartnerSettingsPage() {
  const user = await requirePartner();
  const isGroupLeader = user.role === "GROUP_LEADER";
  const endpoints = user.partnerProfile
    ? await prisma.webhookEndpoint.findMany({
        where: {
          companyId: user.companyId ?? undefined,
          partnerProfileId: user.partnerProfile.id
        },
        orderBy: { createdAt: "desc" }
      })
    : [];

  return (
    <SidebarShell nav={isGroupLeader ? groupLeaderNav : partnerNav} eyebrow={isGroupLeader ? "Group leader" : "Partner"} title="Settings">
      <div className="space-y-6">
        {isGroupLeader ? (
          <Card className="rounded-3xl p-6">
            <Badge>Leader</Badge>
            <h2 className="mt-3 text-3xl font-semibold text-clinic-ink">Leader settings</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Leaders can manage profile and reporting preferences. Payment and automation webhooks are controlled by the partner or admin.
            </p>
          </Card>
        ) : (
          <WebhookSettings endpoints={endpoints} scope="partner" />
        )}
      </div>
    </SidebarShell>
  );
}
