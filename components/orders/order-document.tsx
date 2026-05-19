import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { currency } from "@/lib/utils";
import type { OrderListRecord } from "@/lib/orders/queries";

type DocumentMode = "admin" | "partner" | "group_leader" | "consultant";

function money(cents: number) {
  return currency(cents / 100);
}

function personName(person: { firstName: string | null; lastName: string | null; email?: string }) {
  return [person.firstName, person.lastName].filter(Boolean).join(" ").trim() || person.email || "Unassigned";
}

function splitAmount(order: OrderListRecord, role: "PARTNER" | "GROUP_LEADER" | "CONSULTANT") {
  return order.commissionSplits
    .filter((split) => split.participantRole === role)
    .reduce((sum, split) => sum + split.amountCents, 0);
}

function shortId(id: string) {
  return id.slice(0, 8).toUpperCase();
}

function paymentProviderMetadata(order: OrderListRecord) {
  const metadata = order.referralMetadata;
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const paymentProvider = (metadata as Record<string, unknown>).paymentProvider;
  if (!paymentProvider || typeof paymentProvider !== "object" || Array.isArray(paymentProvider)) return null;
  return paymentProvider as Record<string, unknown>;
}

export function OrderDocument({
  order,
  mode,
  variant
}: {
  order: OrderListRecord;
  mode: DocumentMode;
  variant: "internal" | "receipt";
}) {
  const isReceipt = variant === "receipt";
  const partner = order.partnerProfile ?? order.consultantProfile?.partnerProfile ?? null;
  const leader = order.groupLeaderProfile ?? order.consultantProfile?.groupLeaderProfile ?? null;
  const partnerProfitCents = splitAmount(order, "PARTNER");
  const leaderProfitCents = splitAmount(order, "GROUP_LEADER");
  const consultantCommissionCents = splitAmount(order, "CONSULTANT");
  const canSeePartnerProfit = mode === "admin" || mode === "partner";
  const canSeeLeaderProfit = mode === "admin" || mode === "partner" || mode === "group_leader";
  const canSeeConsultantCommission = !isReceipt;
  const paymentMetadata = paymentProviderMetadata(order);
  const paymentUrl = typeof paymentMetadata?.paymentUrl === "string" ? paymentMetadata.paymentUrl : null;
  const providerSessionId = typeof paymentMetadata?.providerSessionId === "string" ? paymentMetadata.providerSessionId : null;

  return (
    <Card className="overflow-hidden rounded-3xl bg-white shadow-line">
      <div className="border-b border-border bg-gradient-to-br from-white to-clinic-mist px-6 py-6">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="grid size-16 place-items-center rounded-2xl border border-border bg-white shadow-line">
              <img src="/america-first-clinic-logo.jpeg" alt="America First Clinic" className="h-12 w-12 object-contain" />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-clinic-red">America First Clinic</p>
              <h2 className="mt-2 text-2xl font-semibold text-clinic-ink">
                {isReceipt ? "Customer receipt" : "Internal order document"}
              </h2>
              <p className="mt-1 text-sm text-slate-500">Operated by ACV2 Investment Group LLC.</p>
            </div>
          </div>
          <div className="rounded-2xl border border-border bg-white px-4 py-3 text-right shadow-line">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Order</p>
            <p className="mt-1 text-lg font-semibold text-clinic-navy">#{shortId(order.id)}</p>
            <p className="mt-1 text-xs text-slate-500">{new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(order.createdAt)}</p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 p-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <section>
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-lg font-semibold text-clinic-ink">Customer</h3>
              <Badge>{order.paymentStatus}</Badge>
            </div>
            <div className="mt-3 grid gap-3 rounded-2xl border border-border bg-white p-4 text-sm text-slate-600 sm:grid-cols-2">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Name</p>
                <p className="mt-1 font-semibold text-clinic-ink">{personName(order.customer)}</p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Email</p>
                <p className="mt-1">{order.customer.email}</p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Phone</p>
                <p className="mt-1">{order.customer.phone ?? "Not provided"}</p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Status</p>
                <p className="mt-1">{order.orderStatus}</p>
              </div>
            </div>
          </section>

          <section>
            <h3 className="text-lg font-semibold text-clinic-ink">Items</h3>
            <div className="mt-3 overflow-hidden rounded-2xl border border-border">
              <table className="w-full text-left text-sm">
                <thead className="bg-clinic-mist text-xs uppercase tracking-[0.14em] text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Product</th>
                    <th className="px-4 py-3">Qty</th>
                    <th className="px-4 py-3">Unit</th>
                    <th className="px-4 py-3 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border bg-white">
                  {order.items.map((item) => (
                    <tr key={item.id}>
                      <td className="px-4 py-3 font-semibold text-clinic-ink">{item.product.title}</td>
                      <td className="px-4 py-3 text-slate-600">{item.quantity}</td>
                      <td className="px-4 py-3 text-slate-600">{money(item.unitPriceCents)}</td>
                      <td className="px-4 py-3 text-right font-semibold text-clinic-ink">{money(item.totalCents)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {!isReceipt ? (
            <section>
              <h3 className="text-lg font-semibold text-clinic-ink">Attribution</h3>
              <div className="mt-3 grid gap-3 rounded-2xl border border-border bg-white p-4 text-sm text-slate-600 sm:grid-cols-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Consultant</p>
                  <p className="mt-1 font-semibold text-clinic-ink">{order.consultantProfile ? personName(order.consultantProfile.user) : "Direct sale"}</p>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Leader</p>
                  <p className="mt-1 font-semibold text-clinic-ink">{leader?.displayName ?? "No leader"}</p>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Partner</p>
                  <p className="mt-1 font-semibold text-clinic-ink">{partner?.companyName ?? partner?.displayName ?? "Company"}</p>
                </div>
              </div>
            </section>
          ) : null}
        </div>

        <aside className="space-y-4">
          <div className="rounded-3xl border border-border bg-clinic-mist p-5">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Order total</p>
            <p className="mt-3 text-4xl font-semibold text-clinic-navy">{money(order.totalCents)}</p>
          </div>

          {!isReceipt && paymentUrl ? (
            <div className="rounded-3xl border border-blue-100 bg-blue-50 p-5">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-clinic-navy">Payment link</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                {order.paymentStatus === "CAPTURED" ? "Payment has been captured." : "Use this secure provider-hosted link to complete or resend payment."}
              </p>
              <a
                href={paymentUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-4 inline-flex h-11 w-full items-center justify-center rounded-xl bg-clinic-navy px-4 text-sm font-semibold text-white shadow-soft transition hover:bg-clinic-blue"
              >
                Open payment link
              </a>
              {providerSessionId ? <p className="mt-3 break-all text-xs text-slate-500">Session: {providerSessionId}</p> : null}
            </div>
          ) : null}

          {!isReceipt ? (
            <div className="rounded-3xl border border-border bg-white p-5">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Internal financials</p>
              <div className="mt-4 space-y-3 text-sm">
                {mode === "admin" ? (
                  <>
                    <div className="flex justify-between"><span className="text-slate-500">Gross margin</span><span className="font-semibold text-clinic-ink">{money(order.grossMarginCents)}</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">Commission pool</span><span className="font-semibold text-clinic-ink">{money(order.commissionPoolCents)}</span></div>
                  </>
                ) : null}
                {canSeePartnerProfit ? <div className="flex justify-between"><span className="text-slate-500">Partner profit</span><span className="font-semibold text-clinic-navy">{money(partnerProfitCents)}</span></div> : null}
                {canSeeLeaderProfit ? <div className="flex justify-between"><span className="text-slate-500">Leader profit</span><span className="font-semibold text-clinic-navy">{money(leaderProfitCents)}</span></div> : null}
                {canSeeConsultantCommission ? <div className="flex justify-between"><span className="text-slate-500">Consultant commission</span><span className="font-semibold text-clinic-red">{money(consultantCommissionCents)}</span></div> : null}
              </div>
            </div>
          ) : (
            <div className="rounded-3xl border border-border bg-white p-5 text-sm leading-6 text-slate-600">
              <p className="font-semibold text-clinic-ink">Receipt note</p>
              <p className="mt-2">This receipt confirms the order amount and items. Clinical eligibility, fulfillment, prescriptions, or telehealth requirements may require additional review.</p>
            </div>
          )}
        </aside>
      </div>
    </Card>
  );
}
