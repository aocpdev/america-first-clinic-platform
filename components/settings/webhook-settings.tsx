"use client";

import { useMemo, useState } from "react";
import { Edit3, Link2, Plus, Power, X } from "lucide-react";
import {
  createAdminWebhookEndpoint,
  createPartnerWebhookEndpoint,
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
  ["customer.created", "Customer created"],
  ["order.created", "Order created"],
  ["invoice.requested", "Invoice requested"],
  ["payment.succeeded", "Payment succeeded"],
  ["payment.failed", "Payment failed"],
  ["receipt.ready", "Receipt ready"],
  ["receipt.resend_requested", "Receipt resend"],
  ["password.reset.requested", "Password reset"],
  ["consultant.approved", "Consultant approved"],
  ["consultant.rejected", "Consultant rejected"],
  ["commission.generated", "Commission generated"],
  ["subscription.created", "Subscription created"],
  ["subscription.payment_failed", "Subscription failed"]
];

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
            <p className="text-sm font-semibold text-clinic-navy">{endpoints.length} active connection{endpoints.length === 1 ? "" : "s"}</p>
          </div>

          <div className="space-y-3">
            {endpoints.map((endpoint) => (
              <ConnectionRow
                key={endpoint.id}
                endpoint={endpoint}
                scope={scope}
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
  scope,
  onEdit
}: {
  endpoint: WebhookEndpointRow;
  scope: "admin" | "partner";
  onEdit: () => void;
}) {
  const visibleEvents = endpoint.events.slice(0, 3);
  const extraEvents = endpoint.events.length - visibleEvents.length;

  return (
    <div className="rounded-3xl border border-border bg-white p-4 shadow-line transition hover:-translate-y-0.5 hover:shadow-soft">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="truncate text-lg font-semibold text-clinic-ink">{endpoint.name}</h4>
            <Badge>{endpoint.isActive ? "Active" : "Paused"}</Badge>
          </div>
          <p className="mt-1 max-w-2xl truncate text-sm text-slate-500">{endpoint.url}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {visibleEvents.map((event) => <Badge key={event}>{event}</Badge>)}
          {extraEvents > 0 ? <Badge>+{extraEvents}</Badge> : null}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onEdit}>
            <Edit3 className="size-4" />
            Edit
          </Button>
          <form action={toggleWebhookEndpoint}>
            <input type="hidden" name="scope" value={scope} />
            <input type="hidden" name="endpointId" value={endpoint.id} />
            <input type="hidden" name="nextActive" value={endpoint.isActive ? "false" : "true"} />
            <Button type="submit" variant="outline" size="sm">
              <Power className="size-4" />
              {endpoint.isActive ? "Pause" : "Enable"}
            </Button>
          </form>
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

        <form action={updateWebhookEndpoint} className="space-y-5 p-6">
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

          <div className="flex flex-col-reverse gap-3 border-t border-border pt-5 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" variant="accent">Save connection</Button>
          </div>
        </form>
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
        {events.map(([value, label]) => (
          <label
            key={value}
            className="flex min-h-12 items-center gap-2 rounded-2xl bg-white px-3 py-2 text-sm font-medium text-slate-600 shadow-line"
          >
            <input name="events" value={value} type="checkbox" defaultChecked={selected.has(value)} className="size-4" />
            {label}
          </label>
        ))}
      </div>
    </div>
  );
}
