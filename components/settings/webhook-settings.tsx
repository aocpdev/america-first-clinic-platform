import { Link2, Power } from "lucide-react";
import { createAdminWebhookEndpoint, createPartnerWebhookEndpoint, toggleWebhookEndpoint } from "@/app/settings/actions";
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
          <div>
            <p className="mb-3 text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Events</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {events.map(([value, label]) => (
                <label key={value} className="flex items-center gap-2 rounded-2xl bg-white px-3 py-2 text-sm font-medium text-slate-600 shadow-line">
                  <input name="events" value={value} type="checkbox" className="size-4" />
                  {label}
                </label>
              ))}
            </div>
          </div>
          <Button type="submit" variant="accent" className="w-full">Create webhook</Button>
        </form>

        <div className="overflow-hidden rounded-3xl border border-border">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-clinic-mist text-xs uppercase tracking-[0.14em] text-slate-500">
              <tr>
                <th className="px-5 py-4">Endpoint</th>
                <th className="px-5 py-4">Events</th>
                <th className="px-5 py-4">Status</th>
                <th className="px-5 py-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-white">
              {endpoints.map((endpoint) => (
                <tr key={endpoint.id}>
                  <td className="px-5 py-4">
                    <p className="font-semibold text-clinic-ink">{endpoint.name}</p>
                    <p className="mt-1 max-w-xs truncate text-xs text-slate-500">{endpoint.url}</p>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex max-w-sm flex-wrap gap-2">
                      {endpoint.events.slice(0, 4).map((event) => <Badge key={event}>{event}</Badge>)}
                      {endpoint.events.length > 4 ? <Badge>+{endpoint.events.length - 4}</Badge> : null}
                    </div>
                  </td>
                  <td className="px-5 py-4"><Badge>{endpoint.isActive ? "Active" : "Paused"}</Badge></td>
                  <td className="px-5 py-4 text-right">
                    <form action={toggleWebhookEndpoint}>
                      <input type="hidden" name="scope" value={scope} />
                      <input type="hidden" name="endpointId" value={endpoint.id} />
                      <input type="hidden" name="nextActive" value={endpoint.isActive ? "false" : "true"} />
                      <Button type="submit" variant="outline" size="sm">
                        <Power className="size-4" />
                        {endpoint.isActive ? "Pause" : "Enable"}
                      </Button>
                    </form>
                  </td>
                </tr>
              ))}
              {endpoints.length === 0 ? (
                <tr>
                  <td className="px-5 py-12 text-center text-slate-500" colSpan={4}>No webhook endpoints configured yet.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </Card>
  );
}
