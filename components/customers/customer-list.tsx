import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { CreateCustomerButton } from "@/components/customers/customer-crud";
import { formatPhoneForDisplay } from "@/lib/phone";
import { currency } from "@/lib/utils";

type CustomerRow = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  pipelineStage: string;
  consultantName: string;
  leaderName: string;
  partnerName: string;
  ordersCount: number;
  revenueCents: number;
  lastOrderAt: Date | null;
};

function dateLabel(date: Date | null) {
  if (!date) return "No orders yet";
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(date);
}

function basePathForMode(mode: "admin" | "partner" | "consultant") {
  if (mode === "admin") return "/admin";
  if (mode === "consultant") return "/consultant";
  return "/partner";
}

export function CustomerList({
  customers,
  mode
}: {
  customers: CustomerRow[];
  mode: "admin" | "partner" | "consultant";
}) {
  const basePath = basePathForMode(mode);
  const totalRevenueCents = customers.reduce((sum, customer) => sum + customer.revenueCents, 0);
  const activeCustomers = customers.filter((customer) => customer.ordersCount > 0).length;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="p-5">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Customers</p>
          <p className="mt-3 text-3xl font-semibold text-clinic-navy">{customers.length}</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Active buyers</p>
          <p className="mt-3 text-3xl font-semibold text-clinic-navy">{activeCustomers}</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Customer revenue</p>
          <p className="mt-3 text-3xl font-semibold text-clinic-red">{currency(totalRevenueCents / 100)}</p>
        </Card>
      </div>

      <Card className="overflow-hidden rounded-3xl">
        <div className="flex flex-col gap-5 border-b border-border bg-white p-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <Badge>Customer CRM</Badge>
            <h2 className="mt-3 text-3xl font-semibold text-clinic-ink">Customer records</h2>
            <p className="mt-2 max-w-2xl text-sm text-slate-500">
              Each profile stores order history, attribution, notes, and the future telehealth/prescription record.
            </p>
          </div>
          <CreateCustomerButton returnTo={`${basePath}/customers`} />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="bg-clinic-mist text-xs uppercase tracking-[0.14em] text-slate-500">
              <tr>
                <th className="px-6 py-4">Customer</th>
                <th className="px-6 py-4">Attribution</th>
                <th className="px-6 py-4">Pipeline</th>
                <th className="px-6 py-4">Orders</th>
                <th className="px-6 py-4">Revenue</th>
                <th className="px-6 py-4">Last order</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-white">
              {customers.map((customer) => (
                <tr key={customer.id} className="transition hover:bg-clinic-mist/60">
                  <td className="px-6 py-5">
                    <Link href={`${basePath}/customers/${customer.id}`} className="font-semibold text-clinic-navy transition hover:text-clinic-red">
                      {customer.name}
                    </Link>
                    <p className="mt-1 text-xs text-slate-500">{customer.email}</p>
                    <p className="mt-1 text-xs text-slate-500">{formatPhoneForDisplay(customer.phone) || "No phone"}</p>
                  </td>
                  <td className="px-6 py-5 text-slate-600">
                    <p className="font-semibold text-clinic-ink">{customer.consultantName}</p>
                    <p className="mt-1 text-xs">{customer.leaderName}</p>
                    {mode === "admin" ? <p className="mt-1 text-xs">{customer.partnerName}</p> : null}
                  </td>
                  <td className="px-6 py-5"><Badge>{customer.pipelineStage.replaceAll("_", " ")}</Badge></td>
                  <td className="px-6 py-5 font-semibold text-clinic-ink">{customer.ordersCount}</td>
                  <td className="px-6 py-5 font-semibold text-clinic-navy">{currency(customer.revenueCents / 100)}</td>
                  <td className="px-6 py-5 text-slate-600">{dateLabel(customer.lastOrderAt)}</td>
                </tr>
              ))}
              {customers.length === 0 ? (
                <tr>
                  <td className="px-6 py-12 text-center text-slate-500" colSpan={6}>No customer records yet.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
