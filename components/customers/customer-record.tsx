import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { DeleteCustomerButton, EditCustomerButton } from "@/components/customers/customer-crud";
import { formatPhoneForDisplay } from "@/lib/phone";
import { currency } from "@/lib/utils";
import type { OrderListRecord } from "@/lib/orders/queries";

type CustomerRecordData = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
  phone: string | null;
  dateOfBirth: Date | null;
  birthSex: string | null;
  pipelineStage: string;
  tags: string[];
  notes: string | null;
  lifetimeValueCents: number;
  lastPurchaseAt: Date | null;
  consultantName: string | null;
  leaderName: string | null;
  partnerName: string | null;
  orders: OrderListRecord[];
};

function customerName(customer: CustomerRecordData) {
  return [customer.firstName, customer.lastName].filter(Boolean).join(" ").trim() || customer.email;
}

function orderTotal(orders: OrderListRecord[]) {
  return orders.reduce((sum, order) => sum + order.totalCents, 0);
}

function dateLabel(date: Date | null) {
  if (!date) return "Not provided";
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "UTC" }).format(date);
}

function birthSexLabel(value: string | null) {
  if (value === "MALE") return "Male";
  if (value === "FEMALE") return "Female";
  if (value === "PREFER_NOT_TO_SAY") return "Prefer not to say";
  return "Not provided";
}

function basePathForMode(mode: "admin" | "partner" | "consultant") {
  if (mode === "admin") return "/admin";
  if (mode === "consultant") return "/consultant";
  return "/partner";
}

export function CustomerRecord({
  customer,
  mode
}: {
  customer: CustomerRecordData;
  mode: "admin" | "partner" | "consultant";
}) {
  const basePath = basePathForMode(mode);
  const displayName = customerName(customer);

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden rounded-3xl">
        <div className="border-b border-border bg-gradient-to-br from-white to-clinic-mist p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex items-center gap-4">
              <div className="grid size-16 place-items-center rounded-2xl border border-border bg-white shadow-line">
                <img src="/go-virtual-health-emblem.png" alt="Go Virtual Health" className="h-12 w-12 object-contain" />
              </div>
              <div>
                <Badge>Customer record</Badge>
                <h2 className="mt-3 text-3xl font-semibold text-clinic-ink">{displayName}</h2>
                <p className="mt-1 text-sm text-slate-500">{customer.email}</p>
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex flex-wrap justify-start gap-2 lg:justify-end">
                <EditCustomerButton customer={customer} returnTo={`${basePath}/customers/${customer.id}`} />
                <DeleteCustomerButton customerId={customer.id} customerName={displayName} />
              </div>
              <div className="grid grid-cols-2 gap-3 text-center sm:grid-cols-3">
                <div className="rounded-2xl bg-white px-4 py-3 shadow-line">
                  <p className="text-2xl font-semibold text-clinic-navy">{currency(customer.lifetimeValueCents / 100 || orderTotal(customer.orders) / 100)}</p>
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Lifetime value</p>
                </div>
                <div className="rounded-2xl bg-white px-4 py-3 shadow-line">
                  <p className="text-2xl font-semibold text-clinic-navy">{customer.orders.length}</p>
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Orders</p>
                </div>
                <div className="rounded-2xl bg-white px-4 py-3 shadow-line">
                  <p className="text-2xl font-semibold text-clinic-red">{customer.pipelineStage.replaceAll("_", " ")}</p>
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Pipeline</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-6 p-6 lg:grid-cols-[1fr_360px]">
          <section className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-clinic-ink">Profile</h3>
              <div className="mt-3 grid gap-3 rounded-2xl border border-border bg-white p-4 text-sm text-slate-600 sm:grid-cols-2">
                <div><p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Phone</p><p className="mt-1">{formatPhoneForDisplay(customer.phone) || "Not provided"}</p></div>
                <div><p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Last purchase</p><p className="mt-1">{customer.lastPurchaseAt ? new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(customer.lastPurchaseAt) : "No purchases yet"}</p></div>
                <div><p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Date of birth</p><p className="mt-1">{dateLabel(customer.dateOfBirth)}</p></div>
                <div><p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Birth sex</p><p className="mt-1">{birthSexLabel(customer.birthSex)}</p></div>
                <div><p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Consultant</p><p className="mt-1">{customer.consultantName ?? "Unassigned"}</p></div>
                <div><p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Leader / Partner</p><p className="mt-1">{customer.leaderName ?? "No leader"} · {customer.partnerName ?? "No partner"}</p></div>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-clinic-ink">Order history</h3>
              <div className="mt-3 overflow-hidden rounded-2xl border border-border">
                <table className="w-full text-left text-sm">
                  <thead className="bg-clinic-mist text-xs uppercase tracking-[0.14em] text-slate-500">
                    <tr>
                      <th className="px-4 py-3">Order</th>
                      <th className="px-4 py-3">Products</th>
                      <th className="px-4 py-3">Total</th>
                      <th className="px-4 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border bg-white">
                    {customer.orders.map((order) => (
                      <tr key={order.id}>
                        <td className="px-4 py-3">
                          <Link href={`${basePath}/orders/${order.id}`} className="font-semibold text-clinic-navy transition hover:text-clinic-red">#{order.id.slice(0, 8).toUpperCase()}</Link>
                        </td>
                        <td className="px-4 py-3 text-slate-600">{order.items.map((item) => `${item.quantity}x ${item.product.title}`).join(", ")}</td>
                        <td className="px-4 py-3 font-semibold text-clinic-ink">{currency(order.totalCents / 100)}</td>
                        <td className="px-4 py-3"><Badge>{order.orderStatus}</Badge></td>
                      </tr>
                    ))}
                    {customer.orders.length === 0 ? (
                      <tr><td className="px-4 py-8 text-center text-slate-500" colSpan={4}>No orders yet.</td></tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          <aside className="space-y-4">
            <div className="rounded-3xl border border-border bg-white p-5">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Internal notes</p>
              <p className="mt-3 text-sm leading-6 text-slate-600">{customer.notes || "No internal notes yet."}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {customer.tags.length > 0 ? customer.tags.map((tag) => <Badge key={tag}>{tag}</Badge>) : <Badge>No tags</Badge>}
              </div>
            </div>

            <div className="rounded-3xl border border-blue-100 bg-blue-50 p-5">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-clinic-navy">Telehealth readiness</p>
              <div className="mt-4 space-y-3 text-sm text-slate-700">
                <div className="rounded-2xl bg-white p-3 shadow-line">Medical intake: Not started</div>
                <div className="rounded-2xl bg-white p-3 shadow-line">Provider review: Not started</div>
                <div className="rounded-2xl bg-white p-3 shadow-line">Prescription workflow: Not generated</div>
              </div>
              <p className="mt-4 text-xs leading-5 text-slate-500">This area is a placeholder for future compliant telehealth, prescription, and provider documentation workflows.</p>
            </div>
          </aside>
        </div>
      </Card>
    </div>
  );
}
