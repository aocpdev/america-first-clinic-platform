import { CreditCard, ShieldCheck } from "lucide-react";
import { updatePaymentSettings } from "@/app/settings/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { StripeEnvironmentStatus } from "@/lib/payments/stripe-config";

type ProviderSettings = {
  code: string;
  label: string;
  active: boolean;
  mode: string;
  config: unknown;
} | null;

const providers = [
  { code: "stripe", label: "Stripe", description: "Best for demo, card vaulting, checkout links, saved cards, and receipts." },
  { code: "authorize_net", label: "Authorize.net", description: "Gateway-ready for merchant account processing and healthcare underwriting." },
  { code: "nmi", label: "NMI", description: "Prepared for high-risk merchant processors and future gateway routing." },
  { code: "ach", label: "ACH", description: "Prepared for bank debit workflows, Plaid, Dwolla, and recurring payments." }
];

function configValue(config: unknown, key: "saveCards" | "collectInsideCrm" | "sendInvoiceLinks", fallback: boolean) {
  if (!config || typeof config !== "object" || Array.isArray(config)) return fallback;
  const value = (config as Record<string, unknown>)[key];
  return typeof value === "boolean" ? value : fallback;
}

function statusPill(ready: boolean) {
  return ready ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-amber-200 bg-amber-50 text-amber-800";
}

function statusLabel(ready: boolean) {
  return ready ? "Ready" : "Missing";
}

export function PaymentProviderSettings({
  activeProvider,
  stripeStatus
}: {
  activeProvider: ProviderSettings;
  stripeStatus: StripeEnvironmentStatus;
}) {
  const selectedCode = activeProvider?.code ?? "stripe";
  const mode = activeProvider?.mode ?? "test";
  const activeStripeReady =
    mode === "live"
      ? stripeStatus.liveConfigured && stripeStatus.liveWebhookConfigured
      : stripeStatus.testConfigured && stripeStatus.testWebhookConfigured;

  return (
    <Card className="overflow-hidden rounded-3xl">
      <div className="border-b border-border bg-white p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <Badge>Go Virtual Health only</Badge>
            <h2 className="mt-3 text-3xl font-semibold text-clinic-ink">Payment provider</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
              Select the active payment rail without coupling orders, commissions, customers, or dashboards to one processor.
            </p>
          </div>
          <div className={`rounded-2xl border px-4 py-3 text-sm font-semibold ${statusPill(activeStripeReady)}`}>
            Stripe {mode === "live" ? "Live" : "Test"}: {activeStripeReady ? "Ready" : "Needs setup"}
          </div>
        </div>
      </div>

      <form action={updatePaymentSettings} className="space-y-6 p-6">
        <div className="grid gap-4 lg:grid-cols-4">
          {providers.map((provider) => (
            <label key={provider.code} className="relative block cursor-pointer rounded-3xl border border-border bg-white p-5 shadow-line transition hover:-translate-y-0.5 hover:border-clinic-blue">
              <input className="peer sr-only" type="radio" name="providerCode" value={provider.code} defaultChecked={selectedCode === provider.code} />
              <div className="flex items-start justify-between gap-3">
                <div className="grid size-11 place-items-center rounded-2xl bg-clinic-mist text-clinic-navy">
                  <CreditCard className="size-5" />
                </div>
                <span className="rounded-full border border-border px-3 py-1 text-xs font-bold text-slate-500 peer-checked:border-clinic-red peer-checked:text-clinic-red">
                  {selectedCode === provider.code ? "Active" : "Ready"}
                </span>
              </div>
              <h3 className="mt-5 text-xl font-semibold text-clinic-ink">{provider.label}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-500">{provider.description}</p>
              <div className="pointer-events-none absolute inset-0 rounded-3xl ring-0 ring-clinic-blue transition peer-checked:ring-2" />
            </label>
          ))}
        </div>

        <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
          <div className="rounded-3xl border border-border bg-clinic-mist p-5">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Mode</p>
            <select name="mode" defaultValue={mode} className="mt-3 h-12 w-full rounded-2xl border border-border bg-white px-4 text-sm font-semibold text-clinic-ink outline-none">
              <option value="test">Test mode</option>
              <option value="live">Live mode</option>
            </select>
            <div className="mt-4 grid gap-2">
              <div className="rounded-2xl border border-border bg-white p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-clinic-ink">Test mode</p>
                  <span className={`rounded-full border px-3 py-1 text-xs font-bold ${statusPill(stripeStatus.testConfigured && stripeStatus.testWebhookConfigured)}`}>
                    {statusLabel(stripeStatus.testConfigured && stripeStatus.testWebhookConfigured)}
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className={`rounded-full border px-3 py-1 text-xs font-bold ${statusPill(stripeStatus.testConfigured)}`}>
                    Keys {statusLabel(stripeStatus.testConfigured)}
                  </span>
                  <span className={`rounded-full border px-3 py-1 text-xs font-bold ${statusPill(stripeStatus.testWebhookConfigured)}`}>
                    Webhook {statusLabel(stripeStatus.testWebhookConfigured)}
                  </span>
                </div>
              </div>
              <div className="rounded-2xl border border-border bg-white p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-clinic-ink">Live mode</p>
                  <span className={`rounded-full border px-3 py-1 text-xs font-bold ${statusPill(stripeStatus.liveConfigured && stripeStatus.liveWebhookConfigured)}`}>
                    {statusLabel(stripeStatus.liveConfigured && stripeStatus.liveWebhookConfigured)}
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className={`rounded-full border px-3 py-1 text-xs font-bold ${statusPill(stripeStatus.liveConfigured)}`}>
                    Keys {statusLabel(stripeStatus.liveConfigured)}
                  </span>
                  <span className={`rounded-full border px-3 py-1 text-xs font-bold ${statusPill(stripeStatus.liveWebhookConfigured)}`}>
                    Webhook {statusLabel(stripeStatus.liveWebhookConfigured)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-3 rounded-3xl border border-border bg-white p-5 md:grid-cols-3">
            <label className="flex items-start gap-3 rounded-2xl bg-clinic-mist p-4">
              <input name="saveCards" type="checkbox" defaultChecked={configValue(activeProvider?.config, "saveCards", true)} className="mt-1 size-4" />
              <span><span className="block font-semibold text-clinic-ink">Save tokenized cards</span><span className="text-sm text-slate-500">Store provider tokens only, never raw card data.</span></span>
            </label>
            <label className="flex items-start gap-3 rounded-2xl bg-clinic-mist p-4">
              <input name="collectInsideCrm" type="checkbox" defaultChecked={configValue(activeProvider?.config, "collectInsideCrm", true)} className="mt-1 size-4" />
              <span><span className="block font-semibold text-clinic-ink">Collect in CRM</span><span className="text-sm text-slate-500">Use secure provider elements for card entry.</span></span>
            </label>
            <label className="flex items-start gap-3 rounded-2xl bg-clinic-mist p-4">
              <input name="sendInvoiceLinks" type="checkbox" defaultChecked={configValue(activeProvider?.config, "sendInvoiceLinks", true)} className="mt-1 size-4" />
              <span><span className="block font-semibold text-clinic-ink">Invoice links</span><span className="text-sm text-slate-500">Send payment links through GHL webhooks.</span></span>
            </label>
          </div>
        </div>

        <div className="flex flex-col gap-3 rounded-3xl border border-emerald-100 bg-emerald-50 p-5 text-sm text-emerald-900 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 size-5" />
            <p>Card numbers and CVV must stay inside Stripe/Authorize.net/NMI hosted fields. The CRM stores only tokenized references.</p>
          </div>
          <Button type="submit" variant="accent">Save payment settings</Button>
        </div>
      </form>
    </Card>
  );
}
