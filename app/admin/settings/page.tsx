import { SidebarShell } from "@/components/layout/sidebar-shell";
import { AgencyFeeSettings } from "@/components/settings/agency-fee-settings";
import { PaymentProviderSettings } from "@/components/settings/payment-provider-settings";
import { WebhookSettings } from "@/components/settings/webhook-settings";
import { requireRole } from "@/lib/auth/current-user";
import { adminNav } from "@/lib/constants/navigation";
import { prisma } from "@/lib/db/prisma";
import { stripeEnvironmentStatus } from "@/lib/payments/stripe-config";
import { publicSiteBaseUrl } from "@/lib/urls";

export default async function AdminSettingsPage() {
  const user = await requireRole("COMPANY_ADMIN");
  const [activeProvider, endpoints, agencyFeeSetting] = user.companyId
    ? await Promise.all([
        prisma.paymentProvider.findFirst({
          where: { companyId: user.companyId, isDefault: true },
          orderBy: { updatedAt: "desc" }
        }),
        prisma.webhookEndpoint.findMany({
          where: { companyId: user.companyId, partnerProfileId: null },
          orderBy: { createdAt: "desc" }
        }),
        prisma.agencyFeeSetting.findUnique({
          where: { companyId: user.companyId }
        })
      ])
    : [null, [], null];

  return (
    <SidebarShell nav={adminNav} eyebrow="Admin" title="Settings">
      <div className="space-y-6">
        <PaymentProviderSettings
          activeProvider={activeProvider}
          stripeStatus={stripeEnvironmentStatus()}
        />
        <AgencyFeeSettings setting={agencyFeeSetting} />
        <WebhookSettings
          endpoints={endpoints}
          scope="admin"
          qualiphyWebhookUrl={`${publicSiteBaseUrl()}/api/webhooks/qualiphy`}
        />
      </div>
    </SidebarShell>
  );
}
