import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { currency } from "@/lib/utils";

export type OrdersTableMode = "admin" | "partner" | "group_leader" | "consultant";

export type OrderRow = {
  id: string;
  customerName: string;
  customerEmail: string;
  consultantName: string | null;
  leaderName: string | null;
  partnerName: string | null;
  products: string;
  totalCents: number;
  grossMarginCents: number;
  commissionPoolCents: number;
  partnerProfitCents: number;
  leaderProfitCents: number;
  consultantCommissionCents: number;
  paymentStatus: string;
  orderStatus: string;
  createdAt: string;
};

function money(cents: number) {
  return currency(cents / 100);
}

function shortId(id: string) {
  return id.slice(0, 8).toUpperCase();
}

export function OrdersTable({
  orders,
  mode
}: {
  orders: OrderRow[];
  mode: OrdersTableMode;
}) {
  const showAdminFinancials = mode === "admin";
  const showPartnerFinancials = mode === "partner";
  const showLeaderFinancials = mode === "group_leader";
  const showConsultantFinancials = mode === "consultant";

  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1100px] text-left text-sm">
          <thead className="bg-clinic-mist text-xs uppercase tracking-[0.14em] text-slate-500">
            <tr>
              <th className="px-5 py-3">Order</th>
              <th className="px-5 py-3">Customer</th>
              {mode !== "consultant" ? <th className="px-5 py-3">Consultant</th> : null}
              {showAdminFinancials || showPartnerFinancials ? <th className="px-5 py-3">Leader</th> : null}
              {showAdminFinancials ? <th className="px-5 py-3">Partner</th> : null}
              <th className="px-5 py-3">Products</th>
              <th className="px-5 py-3">Total</th>
              {showAdminFinancials ? <th className="px-5 py-3">Margin</th> : null}
              {showAdminFinancials ? <th className="px-5 py-3">Pool</th> : null}
              {showAdminFinancials || showPartnerFinancials ? <th className="px-5 py-3">Partner profit</th> : null}
              {showAdminFinancials || showPartnerFinancials || showLeaderFinancials ? <th className="px-5 py-3">Leader profit</th> : null}
              {(showAdminFinancials || showPartnerFinancials || showLeaderFinancials || showConsultantFinancials) ? <th className="px-5 py-3">Consultant commission</th> : null}
              <th className="px-5 py-3">Payment</th>
              <th className="px-5 py-3">Status</th>
              <th className="px-5 py-3">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border bg-white">
            {orders.map((order) => (
              <tr key={order.id}>
                <td className="px-5 py-4">
                  <p className="font-semibold text-clinic-ink">#{shortId(order.id)}</p>
                </td>
                <td className="px-5 py-4">
                  <p className="font-semibold text-clinic-ink">{order.customerName}</p>
                  <p className="mt-1 text-xs text-slate-500">{order.customerEmail}</p>
                </td>
                {mode !== "consultant" ? <td className="px-5 py-4 text-slate-600">{order.consultantName ?? "Direct sale"}</td> : null}
                {showAdminFinancials || showPartnerFinancials ? <td className="px-5 py-4 text-slate-600">{order.leaderName ?? "No leader"}</td> : null}
                {showAdminFinancials ? <td className="px-5 py-4 text-slate-600">{order.partnerName ?? "Company"}</td> : null}
                <td className="px-5 py-4 text-slate-600">
                  <p className="line-clamp-2">{order.products}</p>
                </td>
                <td className="px-5 py-4 font-semibold text-clinic-ink">{money(order.totalCents)}</td>
                {showAdminFinancials ? <td className="px-5 py-4 font-semibold text-clinic-navy">{money(order.grossMarginCents)}</td> : null}
                {showAdminFinancials ? <td className="px-5 py-4 text-slate-600">{money(order.commissionPoolCents)}</td> : null}
                {showAdminFinancials || showPartnerFinancials ? <td className="px-5 py-4 font-semibold text-clinic-navy">{money(order.partnerProfitCents)}</td> : null}
                {showAdminFinancials || showPartnerFinancials || showLeaderFinancials ? <td className="px-5 py-4 font-semibold text-clinic-navy">{money(order.leaderProfitCents)}</td> : null}
                <td className="px-5 py-4 font-semibold text-clinic-red">{money(order.consultantCommissionCents)}</td>
                <td className="px-5 py-4"><Badge>{order.paymentStatus}</Badge></td>
                <td className="px-5 py-4"><Badge className="border-blue-100 bg-blue-50 text-clinic-navy">{order.orderStatus}</Badge></td>
                <td className="px-5 py-4 text-slate-600">{order.createdAt}</td>
              </tr>
            ))}
            {orders.length === 0 ? (
              <tr>
                <td className="px-5 py-10 text-center text-slate-500" colSpan={15}>No orders found for this workspace yet.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
