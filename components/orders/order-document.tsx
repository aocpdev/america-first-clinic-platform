import { resendReceiptWebhook } from "@/app/orders/actions";
import { BadgePercent, Download, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { AdminDeleteTestOrderButton } from "@/components/orders/admin-delete-test-order-button";
import { OrderStageForm } from "@/components/orders/order-stage-form";
import { OrderTrackingForm } from "@/components/orders/order-tracking-form";
import { ORDER_PROGRESS_STAGES, orderPipelineDescription, orderPipelineLabel } from "@/lib/sales/pipeline";
import { carrierLabel, carrierTrackingUrl } from "@/lib/orders/tracking";
import { currency } from "@/lib/utils";
import type { OrderListRecord } from "@/lib/orders/queries";
import { normalizeDiscountFundingStrategy, type DiscountFundingStrategy } from "@/lib/discounts/calculations";

type DocumentMode = "admin" | "partner" | "manager" | "group_leader" | "consultant";

function money(cents: number) {
  return currency(cents / 100);
}

function personName(person: { firstName: string | null; lastName: string | null; email?: string }) {
  return [person.firstName, person.lastName].filter(Boolean).join(" ").trim() || person.email || "Unassigned";
}

function splitAmount(order: OrderListRecord, role: "PARTNER" | "MANAGER" | "GROUP_LEADER" | "CONSULTANT") {
  return order.commissionSplits
    .filter((split) => split.participantRole === role)
    .reduce((sum, split) => sum + split.amountCents, 0);
}

function shortId(id: string) {
  return id.slice(0, 8).toUpperCase();
}

function birthDateLabel(value: Date | null) {
  if (!value) return "Not provided";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(value);
}

function documentDateLabel(value: Date) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(value);
}

function documentLabel(type: string) {
  return type === "RX" ? "RX" : "Exam";
}

function fileSizeLabel(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function paymentProviderMetadata(order: OrderListRecord) {
  const metadata = order.referralMetadata;
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const paymentProvider = (metadata as Record<string, unknown>).paymentProvider;
  if (!paymentProvider || typeof paymentProvider !== "object" || Array.isArray(paymentProvider)) return null;
  return paymentProvider as Record<string, unknown>;
}

function referralMetadata(order: OrderListRecord) {
  const metadata = order.referralMetadata;
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  return metadata as Record<string, unknown>;
}

function metadataRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function stringValue(record: Record<string, unknown> | null, key: string) {
  const value = record?.[key];
  return typeof value === "string" ? value : "";
}

function numberValue(record: Record<string, unknown> | null, key: string) {
  const value = record?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function booleanValue(record: Record<string, unknown> | null, key: string) {
  const value = record?.[key];
  return typeof value === "boolean" ? value : null;
}

function discountFundingLabel(value: unknown, affectsCommissions: boolean | null) {
  const labels: Record<DiscountFundingStrategy, string> = {
    ORIGINATOR_FUNDED: "Originator funded first",
    PARTNER_FUNDED: "Partner funded first",
    COMPANY_FUNDED: "Company funded promotion",
    SHARED_POOL: "Shared margin pool"
  };
  return labels[normalizeDiscountFundingStrategy(value, affectsCommissions ?? true)];
}

function discountDetails(order: OrderListRecord) {
  const metadata = referralMetadata(order);
  const discount = metadataRecord(metadata?.discount);
  const discountCents = numberValue(discount, "discountCents") ?? order.discountCents;
  const hasDiscount = Boolean(discount) || discountCents > 0;

  if (!hasDiscount) {
    return null;
  }

  return {
    name: stringValue(discount, "name") || "Discount applied",
    code: stringValue(discount, "code") || "No code recorded",
    type: stringValue(discount, "discountType"),
    discountCents,
    subtotalCents: numberValue(discount, "subtotalCents") ?? order.subtotalCents,
    totalCents: numberValue(discount, "totalCents") ?? order.totalCents,
    requestedDiscountCents: numberValue(discount, "requestedDiscountCents"),
    affectsCommissions: booleanValue(discount, "affectsCommissions"),
    fundingStrategy: discountFundingLabel(stringValue(discount, "fundingStrategy"), booleanValue(discount, "affectsCommissions")),
    ownerProtectedProfitCents: numberValue(discount, "ownerProtectedProfitCents"),
    commissionableMarginCents: numberValue(discount, "commissionableMarginCents")
  };
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
  const managerProfitCents = splitAmount(order, "MANAGER");
  const leaderProfitCents = splitAmount(order, "GROUP_LEADER");
  const consultantCommissionCents = splitAmount(order, "CONSULTANT");
  const canSeePartnerProfit = mode === "admin" || mode === "partner";
  const canSeeManagerProfit = mode === "admin" || mode === "partner" || mode === "manager";
  const canSeeLeaderProfit = mode === "admin" || mode === "partner" || mode === "manager" || mode === "group_leader";
  const canSeeConsultantCommission = !isReceipt;
  const paymentMetadata = paymentProviderMetadata(order);
  const metadata = referralMetadata(order);
  const commissionMode = typeof metadata?.commissionMode === "string" ? metadata.commissionMode : null;
  const isAdminDirectSale = commissionMode === "ADMIN_DIRECT" || (!order.partnerProfileId && !order.groupLeaderProfileId && !order.consultantProfileId);
  const paymentUrl = typeof paymentMetadata?.paymentUrl === "string" ? paymentMetadata.paymentUrl : null;
  const providerSessionId = typeof paymentMetadata?.providerSessionId === "string" ? paymentMetadata.providerSessionId : null;
  const isCaptured = order.paymentStatus === "CAPTURED";
  const currentStage = order.orderPipelineStage || "AWAITING_PAYMENT";
  const currentStageLabel = orderPipelineLabel(currentStage);
  const currentProgressIndex = ORDER_PROGRESS_STAGES.findIndex((stage) => stage.value === currentStage);
  const isDeferred = currentStage === "DEFERRED";
  const canManageOrderStage = mode === "admin" && !isReceipt;
  const trackingUrl = carrierTrackingUrl(order.shippingCarrier, order.shippingTrackingCode);
  const discount = discountDetails(order);

  return (
    <Card id={isReceipt ? "customer-receipt" : undefined} className="overflow-hidden rounded-3xl bg-white shadow-line">
      <div className="border-b border-border bg-gradient-to-br from-white to-clinic-mist px-6 py-6">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="rounded-2xl border border-border bg-white px-4 py-3 shadow-line">
              <img src="/go-virtual-health-logo.jpeg" alt="Go Virtual Health" className="h-12 w-auto object-contain" />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-clinic-red">Go Virtual Health</p>
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

      {!isReceipt ? (
        <div className="border-b border-border bg-white px-6 py-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Order pipeline</p>
              <h3 className="mt-2 text-xl font-semibold text-clinic-ink">{currentStageLabel}</h3>
              <p className="mt-1 text-sm text-slate-500">{orderPipelineDescription(currentStage)}</p>
            </div>
            <Badge className={isDeferred ? "border-red-100 bg-red-50 text-clinic-red" : "border-blue-100 bg-blue-50 text-clinic-navy"}>
              {isDeferred ? "Deferred" : `${Math.max(currentProgressIndex + 1, 1)} of ${ORDER_PROGRESS_STAGES.length}`}
            </Badge>
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-5">
            {ORDER_PROGRESS_STAGES.map((stage, index) => {
              const isComplete = !isDeferred && currentProgressIndex >= index;
              const isActive = !isDeferred && currentStage === stage.value;
              return (
                <div
                  key={stage.value}
                  className={[
                    "rounded-2xl border p-3 transition",
                    isActive
                      ? "border-clinic-blue bg-blue-50 shadow-line"
                      : isComplete
                        ? "border-emerald-100 bg-emerald-50"
                        : "border-border bg-clinic-mist"
                  ].join(" ")}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={[
                        "grid size-6 place-items-center rounded-full text-xs font-bold",
                        isComplete ? "bg-clinic-navy text-white" : "bg-white text-slate-500"
                      ].join(" ")}
                    >
                      {index + 1}
                    </span>
                    <p className="text-sm font-semibold text-clinic-ink">{stage.label}</p>
                  </div>
                </div>
              );
            })}
          </div>
          {isDeferred ? (
            <div className="mt-4 rounded-2xl border border-red-100 bg-red-50 p-4 text-sm font-semibold text-red-700">
              This order was deferred. Captured payment should be refunded and commissions remain rejected.
            </div>
          ) : null}
        </div>
      ) : null}

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
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Date of birth</p>
                <p className="mt-1">{birthDateLabel(order.customer.dateOfBirth)}</p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Status</p>
                <p className="mt-1">{currentStageLabel}</p>
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

          <section>
            <h3 className="text-lg font-semibold text-clinic-ink">Coupon / Discount</h3>
            <div className={`mt-3 rounded-2xl border p-4 text-sm ${discount ? "border-emerald-100 bg-emerald-50 text-slate-700" : "border-border bg-white text-slate-600"}`}>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex items-start gap-3">
                  <span className={`grid size-10 shrink-0 place-items-center rounded-2xl ${discount ? "bg-white text-emerald-700" : "bg-clinic-mist text-slate-500"}`}>
                    <BadgePercent className="size-5" />
                  </span>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">{discount ? "Coupon applied" : "No coupon applied"}</p>
                    <p className="mt-1 font-semibold text-clinic-ink">{discount ? discount.name : "This order did not use a discount code."}</p>
                    {discount ? <p className="mt-1 text-sm text-slate-600">Code: <span className="font-semibold text-clinic-navy">{discount.code}</span></p> : null}
                  </div>
                </div>
                {discount ? (
                  <div className="grid gap-2 sm:min-w-56">
                    <div className="flex justify-between gap-4">
                      <span className="text-slate-500">Subtotal</span>
                      <span className="font-semibold text-clinic-ink">{money(discount.subtotalCents)}</span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span className="text-slate-500">Discount</span>
                      <span className="font-semibold text-emerald-700">-{money(discount.discountCents)}</span>
                    </div>
                    <div className="flex justify-between gap-4 border-t border-emerald-100 pt-2">
                      <span className="font-semibold text-clinic-ink">Final total</span>
                      <span className="font-semibold text-clinic-navy">{money(discount.totalCents)}</span>
                    </div>
                  </div>
                ) : null}
              </div>
              {discount && !isReceipt && mode === "admin" ? (
                <div className="mt-4 grid gap-3 rounded-2xl bg-white/80 p-3 sm:grid-cols-3">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">Commission impact</p>
                    <p className="mt-1 font-semibold text-clinic-ink">{discount.fundingStrategy}</p>
                  </div>
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">Protected profit</p>
                    <p className="mt-1 font-semibold text-clinic-ink">{money(discount.ownerProtectedProfitCents ?? 0)}</p>
                  </div>
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">Commissionable margin</p>
                    <p className="mt-1 font-semibold text-clinic-ink">{money(discount.commissionableMarginCents ?? order.grossMarginCents)}</p>
                  </div>
                </div>
              ) : null}
            </div>
          </section>

          <section>
            <h3 className="text-lg font-semibold text-clinic-ink">Shipping</h3>
            <div className="mt-3 rounded-2xl border border-border bg-white p-4 text-sm text-slate-600">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Carrier</p>
                  <p className="mt-1 font-semibold text-clinic-ink">{carrierLabel(order.shippingCarrier)}</p>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Tracking code</p>
                  {order.shippingTrackingCode ? (
                    trackingUrl ? (
                      <a href={trackingUrl} target="_blank" rel="noreferrer" className="mt-1 inline-flex break-all font-semibold text-clinic-navy underline decoration-blue-200 underline-offset-4 transition hover:text-clinic-red">
                        {order.shippingTrackingCode}
                      </a>
                    ) : (
                      <p className="mt-1 break-all font-semibold text-clinic-ink">{order.shippingTrackingCode}</p>
                    )
                  ) : (
                    <p className="mt-1">Tracking pending</p>
                  )}
                </div>
              </div>
              {trackingUrl ? <p className="mt-3 text-xs text-slate-500">Opens the carrier tracking page in a new tab.</p> : null}
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
            <div className="mt-4 space-y-2 border-t border-border pt-3 text-sm">
              <div className="flex justify-between gap-3">
                <span className="text-slate-500">Subtotal</span>
                <span className="font-semibold text-clinic-ink">{money(order.subtotalCents)}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-slate-500">Coupon</span>
                <span className={discount ? "font-semibold text-emerald-700" : "font-semibold text-slate-400"}>
                  {discount ? `-${money(discount.discountCents)}` : "No coupon"}
                </span>
              </div>
            </div>
          </div>

          {!isReceipt && paymentUrl ? (
            <div className="rounded-3xl border border-blue-100 bg-blue-50 p-5">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-clinic-navy">{isCaptured ? "Receipt" : "Payment link"}</p>
              {isCaptured ? (
                <>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    Payment has been captured. View the customer receipt below or resend it through your configured receipt webhook.
                  </p>
                  <a
                    href="#customer-receipt"
                    className="mt-4 inline-flex h-11 w-full items-center justify-center rounded-xl bg-clinic-navy px-4 text-sm font-semibold text-white shadow-soft transition hover:bg-clinic-blue"
                  >
                    View customer receipt
                  </a>
                  <form action={resendReceiptWebhook} className="mt-3">
                    <input type="hidden" name="orderId" value={order.id} />
                    <Button type="submit" variant="outline" className="h-11 w-full rounded-xl bg-white">
                      Resend receipt
                    </Button>
                  </form>
                </>
              ) : (
                <>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    Use this secure provider-hosted link to complete or resend payment.
                  </p>
                  <a
                    href={paymentUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-4 inline-flex h-11 w-full items-center justify-center rounded-xl bg-clinic-navy px-4 text-sm font-semibold text-white shadow-soft transition hover:bg-clinic-blue"
                  >
                    Open payment link
                  </a>
                </>
              )}
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
                    {isAdminDirectSale ? (
                      <div className="flex justify-between"><span className="text-slate-500">Admin direct profit</span><span className="font-semibold text-emerald-700">{money(order.grossMarginCents)}</span></div>
                    ) : (
                      <div className="flex justify-between"><span className="text-slate-500">Commission pool</span><span className="font-semibold text-clinic-ink">{money(order.commissionPoolCents)}</span></div>
                    )}
                  </>
                ) : null}
                {!isAdminDirectSale && canSeePartnerProfit ? <div className="flex justify-between"><span className="text-slate-500">Partner profit</span><span className="font-semibold text-clinic-navy">{money(partnerProfitCents)}</span></div> : null}
                {!isAdminDirectSale && canSeeManagerProfit ? <div className="flex justify-between"><span className="text-slate-500">Manager earnings</span><span className="font-semibold text-clinic-navy">{money(managerProfitCents)}</span></div> : null}
                {!isAdminDirectSale && canSeeLeaderProfit ? <div className="flex justify-between"><span className="text-slate-500">Leader profit</span><span className="font-semibold text-clinic-navy">{money(leaderProfitCents)}</span></div> : null}
                {!isAdminDirectSale && canSeeConsultantCommission ? <div className="flex justify-between"><span className="text-slate-500">Consultant commission</span><span className="font-semibold text-clinic-red">{money(consultantCommissionCents)}</span></div> : null}
                <div className="border-t border-border pt-3">
                  <div className="flex justify-between"><span className="text-slate-500">Commission status</span><span className="font-semibold text-clinic-ink">{order.commissionStatus}</span></div>
                  <p className="mt-2 text-xs leading-5 text-slate-500">Seller commissions stay pending until the order is shipped.</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-3xl border border-border bg-white p-5 text-sm leading-6 text-slate-600">
              <p className="font-semibold text-clinic-ink">Receipt note</p>
              <p className="mt-2">This receipt confirms the order amount and items. Clinical eligibility, fulfillment, prescriptions, or telehealth requirements may require additional review.</p>
            </div>
          )}

          {canManageOrderStage ? (
            <div className="rounded-3xl border border-border bg-white p-5">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Admin workflow</p>
              <h3 className="mt-2 text-lg font-semibold text-clinic-ink">Manage order step</h3>
              <p className="mt-1 text-sm leading-6 text-slate-500">Prescription details are admin-only and hidden from partners, leaders, and consultants.</p>
              <div className="mt-4">
                <OrderStageForm
                  orderId={order.id}
                  currentStage={currentStage}
                  paymentStatus={order.paymentStatus}
                  prescriptionDocumentUrl={order.prescriptionDocumentUrl}
                  prescriptionNotes={order.prescriptionNotes}
                  shippingCarrier={order.shippingCarrier}
                  shippingTrackingCode={order.shippingTrackingCode}
                />
              </div>
            </div>
          ) : null}

          {canManageOrderStage ? (
            <OrderTrackingForm
              orderId={order.id}
              shippingCarrier={order.shippingCarrier}
              shippingTrackingCode={order.shippingTrackingCode}
            />
          ) : null}

          {mode === "admin" && !isReceipt && (order.prescriptionDocumentUrl || order.prescriptionNotes) ? (
            <div className="rounded-3xl border border-blue-100 bg-blue-50 p-5">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-clinic-navy">Admin-only prescription</p>
              {order.prescriptionDocumentUrl ? (
                <a href={order.prescriptionDocumentUrl} target="_blank" rel="noreferrer" className="mt-3 block break-all text-sm font-semibold text-clinic-navy underline">
                  {order.prescriptionDocumentUrl}
                </a>
              ) : null}
              {order.prescriptionNotes ? <p className="mt-3 text-sm leading-6 text-slate-600">{order.prescriptionNotes}</p> : null}
            </div>
          ) : null}

          {mode === "admin" && !isReceipt ? (
            <div className="rounded-3xl border border-blue-100 bg-blue-50 p-5">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-clinic-navy">Admin-only clinical files</p>
              <h3 className="mt-2 text-lg font-semibold text-clinic-ink">Exam / RX documents</h3>
              <p className="mt-1 text-sm leading-6 text-slate-600">Protected patient files. Only admins can open or download these links.</p>
              <div className="mt-4 space-y-3">
                {order.clinicalDocuments.length ? (
                  order.clinicalDocuments.map((document) => (
                    <div key={document.id} className="rounded-2xl border border-blue-100 bg-white p-3 shadow-line">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-clinic-mist px-3 py-1 text-xs font-bold text-clinic-navy">{documentLabel(document.type)}</span>
                        <p className="min-w-0 flex-1 truncate text-sm font-semibold text-clinic-ink">{document.title}</p>
                      </div>
                      <p className="mt-2 truncate text-xs text-slate-500">{document.fileName}</p>
                      <p className="mt-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                        {documentDateLabel(document.createdAt)} · {fileSizeLabel(document.sizeBytes)}
                      </p>
                      <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        <a
                          href={`/api/customer-documents/${document.id}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-border px-3 text-sm font-semibold text-clinic-navy transition hover:bg-clinic-mist"
                        >
                          <ExternalLink className="size-4" />
                          Open
                        </a>
                        <a
                          href={`/api/customer-documents/${document.id}?download=1`}
                          className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-border bg-clinic-mist px-3 text-sm font-semibold text-clinic-navy transition hover:bg-white"
                        >
                          <Download className="size-4" />
                          Download
                        </a>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl border border-dashed border-blue-100 bg-white/70 p-4 text-sm text-slate-500">
                    No Exam or RX documents have been uploaded for this order yet.
                  </div>
                )}
              </div>
            </div>
          ) : null}

          {mode === "admin" && !isReceipt ? (
            <div className="rounded-3xl border border-red-100 bg-red-50 p-5">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-red-700">Admin cleanup</p>
              <h3 className="mt-2 text-lg font-semibold text-clinic-ink">Test order removal</h3>
              {isCaptured ? (
                <p className="mt-2 text-sm leading-6 text-red-700">
                  This order has a captured payment. Refund or void the payment before deleting it from the system.
                </p>
              ) : (
                <>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    Use this only for unpaid, failed, or internal test orders.
                  </p>
                  <div className="mt-4">
                    <AdminDeleteTestOrderButton orderId={order.id} />
                  </div>
                </>
              )}
            </div>
          ) : null}
        </aside>
      </div>
    </Card>
  );
}
