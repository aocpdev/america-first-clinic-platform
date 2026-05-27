"use client";

import { useMemo, useState } from "react";
import { Edit3, Link2, Plus, Power, Send, X } from "lucide-react";
import {
  createAdminWebhookEndpoint,
  createPartnerWebhookEndpoint,
  testWebhookEndpoint,
  toggleWebhookEndpoint,
  updateWebhookEndpoint
} from "@/app/settings/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type WebhookEndpointRow = {
  id: string;
  name: string;
  url: string;
  events: string[];
  isActive: boolean;
  createdAt: Date;
};

const events = [
  { value: "customer.created", label: "Customer created", group: "CRM", description: "A new customer profile is created." },
  { value: "order.created", label: "Order created", group: "CRM", description: "A new order or opportunity is created." },
  { value: "invoice.requested", label: "Invoice requested", group: "Payments", description: "A seller requests an invoice/payment link." },
  { value: "payment.succeeded", label: "Payment succeeded", group: "Payments", description: "Stripe or another provider confirms payment." },
  { value: "payment.failed", label: "Payment failed", group: "Payments", description: "A payment attempt fails or is declined." },
  { value: "receipt.ready", label: "Receipt ready", group: "Payments", description: "A paid order has a receipt available." },
  { value: "receipt.resend_requested", label: "Receipt resend requested", group: "Payments", description: "A CRM user asks to resend a receipt." },
  { value: "shipment.tracking_ready", label: "Tracking ready", group: "Fulfillment", description: "A carrier and tracking code are saved." },
  { value: "seller.registration.submitted", label: "Seller registration submitted", group: "Team access", description: "A seller applies under a partner or leader." },
  { value: "leader.registration.submitted", label: "Leader registration submitted", group: "Team access", description: "A group leader applies under a partner or manager." },
  { value: "manager.registration.submitted", label: "Manager registration submitted", group: "Team access", description: "Reserved for manager application workflows." },
  { value: "seller.approved", label: "Seller approved", group: "Team access", description: "A seller is approved and can access the CRM." },
  { value: "leader.approved", label: "Leader approved", group: "Team access", description: "A group leader is approved and can access the CRM." },
  { value: "manager.approved", label: "Manager approved", group: "Team access", description: "A manager is approved and can access the CRM." },
  { value: "seller.rejected", label: "Seller rejected", group: "Team access", description: "A seller application is rejected." },
  { value: "leader.rejected", label: "Leader rejected", group: "Team access", description: "A group leader application is rejected." },
  { value: "manager.rejected", label: "Manager rejected", group: "Team access", description: "A manager application is rejected." },
  { value: "password.reset.requested", label: "Password reset requested", group: "Account", description: "A user asks for password reset communication." },
  { value: "password.changed", label: "Password changed", group: "Account", description: "A user updates their CRM password." },
  { value: "consultant.approved", label: "Consultant approved legacy", group: "Legacy", description: "Legacy event kept for existing workflows." },
  { value: "consultant.rejected", label: "Consultant rejected legacy", group: "Legacy", description: "Legacy event kept for existing workflows." },
  { value: "commission.generated", label: "Commission generated", group: "Commissions", description: "Commission or partner payout math is generated." },
  { value: "subscription.created", label: "Subscription created", group: "Subscriptions", description: "A subscription starts." },
  { value: "subscription.payment_failed", label: "Subscription payment failed", group: "Subscriptions", description: "A recurring payment fails." }
] as const;

export function WebhookSettings({
  endpoints,
  scope
}: {
  endpoints: WebhookEndpointRow[];
  scope: "admin" | "partner";
}) {
  const createAction = scope === "admin" ? createAdminWebhookEndpoint : createPartnerWebhookEndpoint;
  const [editingEndpoint, setEditingEndpoint] = useState<WebhookEndpointRow | null>(null);

  return (
    <Card className="overflow-hidden rounded-3xl">
      <div className="border-b border-border bg-white p-6">
        <Badge>{scope === "admin" ? "Global" : "Partner"}</Badge>
        <h2 className="mt-3 text-3xl font-semibold text-clinic-ink">Webhook automations</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
          Connect CRM events to Go High Level or other systems for invoice SMS, receipts, password reset communication, approvals, and payment notifications.
        </p>
      </div>

      <div className="grid gap-6 p-6 xl:grid-cols-[420px_1fr]">
        <form action={createAction} className="space-y-4 rounded-3xl border border-border bg-clinic-mist p-5">
          <div className="flex items-center gap-3">
            <div className="grid size-11 place-items-center rounded-2xl bg-white text-clinic-navy shadow-line">
              <Link2 className="size-5" />
            </div>
            <div>
              <h3 className="text-xl font-semibold text-clinic-ink">Add endpoint</h3>
              <p className="text-sm text-slate-500">Use your GHL webhook URL here.</p>
            </div>
          </div>
          <Input name="name" placeholder="GHL invoice workflow" required />
          <Input name="url" placeholder="https://services.leadconnectorhq.com/hooks/..." type="url" required />
          <EventCheckboxGrid selectedEvents={[]} />
          <Button type="submit" variant="accent" className="w-full">
            <Plus className="size-4" />
            Create webhook
          </Button>
        </form>

        <section className="rounded-3xl border border-border bg-white p-5">
          <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <Badge>Connections</Badge>
              <h3 className="mt-3 text-2xl font-semibold text-clinic-ink">Connected workflows</h3>
              <p className="mt-1 text-sm text-slate-500">Edit endpoint details, event triggers, and connection status.</p>
            </div>
            <p className="text-sm font-semibold text-clinic-navy">{endpoints.length} connection{endpoints.length === 1 ? "" : "s"}</p>
          </div>

          <div className="space-y-3">
            {endpoints.map((endpoint) => (
              <ConnectionRow
                key={endpoint.id}
                endpoint={endpoint}
                onEdit={() => setEditingEndpoint(endpoint)}
              />
            ))}
            {endpoints.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-border bg-clinic-mist p-10 text-center">
                <div className="mx-auto grid size-12 place-items-center rounded-2xl bg-white text-clinic-navy shadow-line">
                  <Link2 className="size-5" />
                </div>
                <p className="mt-4 text-lg font-semibold text-clinic-ink">No connections yet</p>
                <p className="mt-1 text-sm text-slate-500">Create your first webhook endpoint to automate GHL communication.</p>
              </div>
            ) : null}
          </div>
        </section>
      </div>

      {editingEndpoint ? (
        <EditWebhookModal
          endpoint={editingEndpoint}
          scope={scope}
          onClose={() => setEditingEndpoint(null)}
        />
      ) : null}
    </Card>
  );
}

function ConnectionRow({
  endpoint,
  onEdit
}: {
  endpoint: WebhookEndpointRow;
  onEdit: () => void;
}) {
  return (
    <div className="rounded-3xl border border-border bg-white px-4 py-3 shadow-line transition hover:-translate-y-0.5 hover:shadow-soft">
      <div className="flex min-w-0 items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid size-10 shrink-0 place-items-center rounded-2xl bg-clinic-mist text-clinic-navy">
            <Link2 className="size-4" />
          </div>
          <h4 className="min-w-0 truncate text-lg font-semibold text-clinic-ink">{endpoint.name}</h4>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          <Badge>{endpoint.isActive ? "Active" : "Paused"}</Badge>
          <Button type="button" variant="outline" size="sm" onClick={onEdit}>
            <Edit3 className="size-4" />
            Edit
          </Button>
        </div>
      </div>
    </div>
  );
}

function EditWebhookModal({
  endpoint,
  scope,
  onClose
}: {
  endpoint: WebhookEndpointRow;
  scope: "admin" | "partner";
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/35 px-4 py-8 backdrop-blur-sm">
      <div className="w-full max-w-3xl overflow-hidden rounded-[2rem] border border-border bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-border p-6">
          <div>
            <Badge>Edit connection</Badge>
            <h3 className="mt-3 text-3xl font-semibold text-clinic-ink">Webhook endpoint</h3>
            <p className="mt-1 text-sm text-slate-500">Update the workflow name, destination URL, and event triggers.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid size-11 shrink-0 place-items-center rounded-full border border-border text-slate-500 transition hover:bg-clinic-mist hover:text-clinic-ink"
            aria-label="Close modal"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="max-h-[72vh] overflow-y-auto p-6">
          <form id={`edit-webhook-${endpoint.id}`} action={updateWebhookEndpoint} className="space-y-5">
            <input type="hidden" name="scope" value={scope} />
            <input type="hidden" name="endpointId" value={endpoint.id} />
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-2">
                <span className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Connection name</span>
                <Input name="name" defaultValue={endpoint.name} required />
              </label>
              <label className="space-y-2 sm:col-span-2">
                <span className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Endpoint URL</span>
                <Input name="url" defaultValue={endpoint.url} type="url" required />
              </label>
            </div>

            <EventCheckboxGrid selectedEvents={endpoint.events} />
          </form>

          <div className="mt-5 rounded-3xl border border-border bg-clinic-mist p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-clinic-ink">Connection tools</p>
                <p className="mt-1 text-sm text-slate-500">Send a sample payload or pause this connection without exposing the URL in the list.</p>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                <form action={testWebhookEndpoint}>
                  <input type="hidden" name="scope" value={scope} />
                  <input type="hidden" name="endpointId" value={endpoint.id} />
                  <Button type="submit" variant="outline">
                    <Send className="size-4" />
                    Send test
                  </Button>
                </form>
                <form action={toggleWebhookEndpoint}>
                  <input type="hidden" name="scope" value={scope} />
                  <input type="hidden" name="endpointId" value={endpoint.id} />
                  <input type="hidden" name="nextActive" value={endpoint.isActive ? "false" : "true"} />
                  <Button type="submit" variant="outline">
                    <Power className="size-4" />
                    {endpoint.isActive ? "Pause" : "Enable"}
                  </Button>
                </form>
              </div>
            </div>
          </div>

          <div className="mt-5 flex flex-col-reverse gap-3 border-t border-border pt-5 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" form={`edit-webhook-${endpoint.id}`} variant="accent">Save connection</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function EventCheckboxGrid({ selectedEvents }: { selectedEvents: string[] }) {
  const selected = useMemo(() => new Set(selectedEvents), [selectedEvents]);

  return (
    <div>
      <p className="mb-3 text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Events</p>
      <div className="grid gap-2 sm:grid-cols-2">
        {events.map((event) => (
          <label
            key={event.value}
            className="flex min-h-16 items-start gap-3 rounded-2xl bg-white px-3 py-3 text-sm font-medium text-slate-600 shadow-line"
          >
            <input name="events" value={event.value} type="checkbox" defaultChecked={selected.has(event.value)} className="mt-1 size-4 shrink-0" />
            <span className="min-w-0">
              <span className="block text-xs font-bold uppercase tracking-[0.14em] text-clinic-navy">{event.group}</span>
              <span className="mt-1 block font-semibold text-clinic-ink">{event.label}</span>
              <span className="mt-0.5 block text-xs leading-5 text-slate-500">{event.description}</span>
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}
