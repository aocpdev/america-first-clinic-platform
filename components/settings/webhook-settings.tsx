"use client";

import { useMemo, useState } from "react";
import { Edit3, Link2, Plus, Power, Send, X } from "lucide-react";
import {
  createAdminWebhookEndpoint,
  createPartnerWebhookEndpoint,
  testWebhookConfiguration,
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
  const [creatingEndpoint, setCreatingEndpoint] = useState(false);

  return (
    <Card className="overflow-hidden rounded-3xl">
      <div className="border-b border-border bg-white p-6">
        <Badge>{scope === "admin" ? "Global" : "Partner"}</Badge>
        <h2 className="mt-3 text-3xl font-semibold text-clinic-ink">Webhook automations</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
          Connect CRM events to Go High Level or other systems for invoice SMS, receipts, password reset communication, approvals, and payment notifications.
        </p>
      </div>

      <div className="grid gap-6 p-6 xl:grid-cols-[360px_1fr]">
        <div className="rounded-3xl border border-border bg-clinic-mist p-5">
          <div className="flex items-center gap-3">
            <div className="grid size-11 place-items-center rounded-2xl bg-white text-clinic-navy shadow-line">
              <Link2 className="size-5" />
            </div>
            <div>
              <h3 className="text-xl font-semibold text-clinic-ink">Add endpoint</h3>
              <p className="text-sm text-slate-500">Create, test, and preview a workflow payload.</p>
            </div>
          </div>
          <Button type="button" variant="accent" className="mt-5 w-full" onClick={() => setCreatingEndpoint(true)}>
            <Plus className="size-4" />
            Create webhook
          </Button>
        </div>

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

      {creatingEndpoint ? (
        <WebhookConfigurationModal
          mode="create"
          action={createAction}
          scope={scope}
          onClose={() => setCreatingEndpoint(false)}
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

function WebhookConfigurationModal({
  mode,
  action,
  endpoint,
  scope,
  onClose
}: {
  mode: "create" | "edit";
  action: (formData: FormData) => void | Promise<void>;
  endpoint?: WebhookEndpointRow;
  scope: "admin" | "partner";
  onClose: () => void;
}) {
  const [selectedEvents, setSelectedEvents] = useState<string[]>(endpoint?.events ?? ["invoice.requested"]);
  const [previewEvent, setPreviewEvent] = useState(selectedEvents[0] || "invoice.requested");
  const formId = `${mode}-webhook-${endpoint?.id || "new"}`;
  const currentPreviewEvent = selectedEvents.includes(previewEvent) ? previewEvent : selectedEvents[0] || "webhook.test";
  const payloadPreview = useMemo(() => sampleWebhookPayload(currentPreviewEvent, selectedEvents), [currentPreviewEvent, selectedEvents]);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/35 px-4 py-8 backdrop-blur-sm">
      <div className="w-full max-w-5xl overflow-hidden rounded-[2rem] border border-border bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-border p-6">
          <div>
            <Badge>{mode === "create" ? "New connection" : "Edit connection"}</Badge>
            <h3 className="mt-3 text-3xl font-semibold text-clinic-ink">Webhook endpoint</h3>
            <p className="mt-1 text-sm text-slate-500">Configure the destination, test the connection, and inspect the JSON payload.</p>
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
          <form id={formId} action={action} className="space-y-5">
            <input type="hidden" name="scope" value={scope} />
            {endpoint ? <input type="hidden" name="endpointId" value={endpoint.id} /> : null}
            <div className="grid gap-6 lg:grid-cols-[1fr_420px]">
              <div className="space-y-5">
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="space-y-2">
                    <span className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Connection name</span>
                    <Input name="name" defaultValue={endpoint?.name ?? ""} placeholder="GHL invoice workflow" required />
                  </label>
                  <label className="space-y-2 sm:col-span-2">
                    <span className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Endpoint URL</span>
                    <Input name="url" defaultValue={endpoint?.url ?? ""} placeholder="https://services.leadconnectorhq.com/hooks/..." type="url" required />
                  </label>
                </div>

                <EventCheckboxGrid selectedEvents={selectedEvents} onSelectedEventsChange={setSelectedEvents} />
              </div>

              <div className="space-y-4">
                <div className="rounded-3xl border border-border bg-clinic-mist p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-clinic-ink">Test payload</p>
                      <p className="mt-1 text-xs leading-5 text-slate-500">This is the JSON format GHL will receive.</p>
                    </div>
                    <select
                      className="h-11 rounded-2xl border border-border bg-white px-3 text-sm font-semibold text-clinic-ink shadow-line"
                      value={currentPreviewEvent}
                      onChange={(event) => setPreviewEvent(event.target.value)}
                    >
                      {(selectedEvents.length ? selectedEvents : ["webhook.test"]).map((event) => (
                        <option key={event} value={event}>{event}</option>
                      ))}
                    </select>
                  </div>
                  <pre className="mt-4 max-h-96 overflow-auto rounded-2xl bg-slate-950 p-4 text-xs leading-5 text-slate-100">
                    {JSON.stringify(payloadPreview, null, 2)}
                  </pre>
                </div>
              </div>
            </div>
          </form>

          <div className="mt-5 rounded-3xl border border-border bg-clinic-mist p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-clinic-ink">Connection tools</p>
                <p className="mt-1 text-sm text-slate-500">Send a sample payload or pause this connection without exposing the URL in the list.</p>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                <Button type="submit" form={formId} formAction={testWebhookConfiguration} variant="outline">
                  <Send className="size-4" />
                  Send URL test
                </Button>
                {endpoint ? (
                  <form action={testWebhookEndpoint}>
                    <input type="hidden" name="scope" value={scope} />
                    <input type="hidden" name="endpointId" value={endpoint.id} />
                    <Button type="submit" variant="outline">
                      <Send className="size-4" />
                      Send saved test
                    </Button>
                  </form>
                ) : null}
                {endpoint ? (
                  <form action={toggleWebhookEndpoint}>
                    <input type="hidden" name="scope" value={scope} />
                    <input type="hidden" name="endpointId" value={endpoint.id} />
                    <input type="hidden" name="nextActive" value={endpoint.isActive ? "false" : "true"} />
                    <Button type="submit" variant="outline">
                      <Power className="size-4" />
                      {endpoint.isActive ? "Pause" : "Enable"}
                    </Button>
                  </form>
                ) : null}
              </div>
            </div>
          </div>

          <div className="mt-5 flex flex-col-reverse gap-3 border-t border-border pt-5 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" form={formId} variant="accent">{mode === "create" ? "Create connection" : "Save connection"}</Button>
          </div>
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
    <WebhookConfigurationModal
      mode="edit"
      action={updateWebhookEndpoint}
      endpoint={endpoint}
      scope={scope}
      onClose={onClose}
    />
  );
}

function EventCheckboxGrid({
  selectedEvents,
  onSelectedEventsChange
}: {
  selectedEvents: string[];
  onSelectedEventsChange: (events: string[]) => void;
}) {
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
            <input
              name="events"
              value={event.value}
              type="checkbox"
              checked={selected.has(event.value)}
              onChange={(inputEvent) => {
                const nextEvents = inputEvent.target.checked
                  ? Array.from(new Set([...selectedEvents, event.value]))
                  : selectedEvents.filter((selectedEvent) => selectedEvent !== event.value);
                onSelectedEventsChange(nextEvents.length ? nextEvents : ["invoice.requested"]);
              }}
              className="mt-1 size-4 shrink-0"
            />
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

function sampleWebhookPayload(eventType: string, configuredEvents: string[]) {
  const base = {
    source: "america_first_clinic_crm",
    environment: "test",
    configuredEvents,
    phoneE164: "14076246747",
    customer: {
      id: "cus_demo_1024",
      firstName: "Mariana",
      lastName: "Rivera",
      email: "mariana@example.com",
      phone: "14076246747"
    }
  };

  const samples: Record<string, Record<string, unknown>> = {
    "customer.created": {
      ...base,
      customer: {
        ...base.customer,
        birthDate: "1988-04-12",
        birthSex: "Female",
        pipelineStage: "New Sale"
      }
    },
    "order.created": {
      ...base,
      order: {
        id: "ord_demo_2048",
        orderNumber: "AF-2048",
        total: 397,
        margin: 229,
        status: "AWAITING_PAYMENT"
      },
      items: [
        { name: "Methylene Blue Capsules (30 Day Supply)", quantity: 1, unitPrice: 229 },
        { name: "Low Dose Naltrexone (LDN) - 30 Day Supply", quantity: 1, unitPrice: 149 }
      ]
    },
    "invoice.requested": {
      ...base,
      order: {
        id: "ord_demo_2048",
        orderNumber: "AF-2048",
        total: 397,
        paymentStatus: "PENDING"
      },
      invoice: {
        shortUrl: "https://www.americafirstclinic.com/i/af2048",
        provider: "stripe",
        expiresAt: "2026-06-03T14:30:00.000Z"
      }
    },
    "payment.succeeded": {
      ...base,
      order: {
        id: "ord_demo_2048",
        orderNumber: "AF-2048",
        total: 397,
        paymentStatus: "CAPTURED"
      },
      receipt: {
        shortUrl: "https://www.americafirstclinic.com/receipts/af2048"
      }
    },
    "payment.failed": {
      ...base,
      order: {
        id: "ord_demo_2048",
        orderNumber: "AF-2048",
        total: 397,
        paymentStatus: "FAILED"
      },
      failure: {
        reason: "Card declined"
      }
    },
    "receipt.ready": {
      ...base,
      order: {
        id: "ord_demo_2048",
        orderNumber: "AF-2048",
        total: 397
      },
      receipt: {
        shortUrl: "https://www.americafirstclinic.com/receipts/af2048"
      }
    },
    "receipt.resend_requested": {
      ...base,
      order: {
        id: "ord_demo_2048",
        orderNumber: "AF-2048"
      },
      receipt: {
        shortUrl: "https://www.americafirstclinic.com/receipts/af2048"
      }
    },
    "shipment.tracking_ready": {
      ...base,
      order: {
        id: "ord_demo_2048",
        orderNumber: "AF-2048"
      },
      shipment: {
        carrier: "UPS",
        trackingCode: "1Z999AA10123456784",
        trackingUrl: "https://www.ups.com/track?tracknum=1Z999AA10123456784"
      }
    },
    "commission.generated": {
      ...base,
      order: {
        id: "ord_demo_2048",
        orderNumber: "AF-2048",
        margin: 229
      },
      commission: {
        status: "PENDING",
        consultantAmount: 28.63,
        partnerAmount: 28.62
      }
    },
    "password.reset.requested": {
      ...base,
      reset: {
        requestedBy: "consultant",
        resetUrl: "https://www.americafirstclinic.com/reset-password/demo"
      }
    }
  };

  const registrationPayload = {
    ...base,
    applicant: {
      id: "usr_demo_512",
      name: "Rashad Abdul Hamid",
      email: "rashad@example.com",
      requestedRole: eventType.includes("manager") ? "MANAGER" : eventType.includes("leader") ? "GROUP_LEADER" : "CONSULTANT",
      partner: "Go Virtual Health"
    }
  };

  const accessDecisionPayload = {
    ...registrationPayload,
    decision: {
      status: eventType.includes("rejected") ? "REJECTED" : "APPROVED",
      decidedAt: "2026-05-27T14:30:00.000Z"
    }
  };

  const data =
    samples[eventType] ??
    (eventType.includes("registration.submitted")
      ? registrationPayload
      : eventType.includes("approved") || eventType.includes("rejected")
        ? accessDecisionPayload
        : {
            ...base,
            message: "Sample CRM event payload."
          });

  return {
    id: "preview_delivery_123",
    event: eventType,
    createdAt: "2026-05-27T14:30:00.000Z",
    data
  };
}
