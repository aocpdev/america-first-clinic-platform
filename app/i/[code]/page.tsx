import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { prisma } from "@/lib/db/prisma";
import { paymentShortUrl } from "@/lib/payments/short-links";
import { formatPhoneForDisplay } from "@/lib/phone";
import { currency } from "@/lib/utils";

type InvoiceLookup = {
  id: string;
};

function personName(person: { firstName: string | null; lastName: string | null; email: string }) {
  return [person.firstName, person.lastName].filter(Boolean).join(" ").trim() || person.email;
}

function money(cents: number) {
  return currency(cents / 100);
}

function statusLabel(status: string) {
  if (status === "CAPTURED") return "Paid";
  if (status === "FAILED") return "Payment failed";
  return "Payment pending";
}

export default async function PublicInvoicePage({
  params
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const normalizedCode = code.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
  if (normalizedCode.length < 6) notFound();

  const matches = await prisma.$queryRaw<InvoiceLookup[]>`
    SELECT id::text
    FROM "Order"
    WHERE replace(id::text, '-', '') LIKE ${`${normalizedCode}%`}
    ORDER BY "createdAt" DESC
    LIMIT 2
  `;

  if (matches.length !== 1) notFound();

  const order = await prisma.order.findUnique({
    where: { id: matches[0].id },
    include: {
      customer: true,
      items: { include: { product: true } }
    }
  });

  if (!order) notFound();

  const isPaid = order.paymentStatus === "CAPTURED";

  return (
    <main className="min-h-screen bg-clinic-mist px-4 py-8 text-clinic-ink sm:px-6 lg:px-8">
      <Card className="mx-auto max-w-5xl overflow-hidden rounded-3xl bg-white shadow-line">
        <div className="border-b border-border bg-gradient-to-br from-white to-clinic-mist px-6 py-6 sm:px-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-center gap-4">
            <div className="rounded-2xl border border-border bg-white px-4 py-3 shadow-line">
              <img src="/go-virtual-health-logo.jpeg" alt="Go Virtual Health" className="h-12 w-auto object-contain" />
            </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-clinic-red">Go Virtual Health</p>
                <h1 className="mt-2 text-3xl font-semibold text-clinic-ink">Invoice</h1>
                <p className="mt-1 text-sm text-slate-500">Operated by ACV2 Investment Group LLC.</p>
              </div>
            </div>
            <div className="rounded-2xl border border-border bg-white px-4 py-3 text-left shadow-line sm:text-right">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Order</p>
              <p className="mt-1 text-lg font-semibold text-clinic-navy">#{order.id.slice(0, 8).toUpperCase()}</p>
              <p className="mt-1 text-xs text-slate-500">{new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(order.createdAt)}</p>
            </div>
          </div>
        </div>

        <div className="grid gap-6 p-6 sm:p-8 lg:grid-cols-[1fr_320px]">
          <section className="space-y-6">
            <div>
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-xl font-semibold text-clinic-ink">Customer</h2>
                <Badge>{statusLabel(order.paymentStatus)}</Badge>
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
                  <p className="mt-1">{formatPhoneForDisplay(order.customer.phone) || "Not provided"}</p>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Invoice status</p>
                  <p className="mt-1">{statusLabel(order.paymentStatus)}</p>
                </div>
              </div>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-clinic-ink">Items</h2>
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
            </div>
          </section>

          <aside className="space-y-4">
            <div className="rounded-3xl border border-border bg-clinic-mist p-5">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Invoice total</p>
              <p className="mt-3 text-5xl font-semibold text-clinic-navy">{money(order.totalCents)}</p>
            </div>

            <div className="rounded-3xl border border-blue-100 bg-blue-50 p-5">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-clinic-navy">Secure payment</p>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                {isPaid
                  ? "This invoice has already been paid. Please contact Go Virtual Health if you need support."
                  : "Pay securely through our encrypted payment provider. Card information is never stored inside the CRM."}
              </p>
              {isPaid ? (
                <Button className="mt-4 h-11 w-full rounded-xl" variant="outline" disabled>
                  Invoice paid
                </Button>
              ) : (
                <a
                  href={paymentShortUrl(order.id)}
                  className="mt-4 inline-flex h-11 w-full items-center justify-center rounded-xl bg-clinic-navy px-4 text-sm font-semibold text-white shadow-soft transition hover:bg-clinic-blue"
                >
                  Pay invoice
                </a>
              )}
            </div>

            <div className="rounded-3xl border border-border bg-white p-5 text-xs leading-5 text-slate-500">
              Payment completion may be subject to product availability, fulfillment review, and any healthcare eligibility requirements.
            </div>
          </aside>
        </div>
      </Card>
    </main>
  );
}
