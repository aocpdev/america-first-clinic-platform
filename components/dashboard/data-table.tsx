import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { consultants } from "@/lib/mock-data";
import { currency } from "@/lib/utils";

export function ConsultantTable() {
  return (
    <Card className="overflow-hidden">
      <div className="border-b border-border p-5">
        <h2 className="text-lg font-semibold text-clinic-ink">Top consultants</h2>
        <p className="mt-1 text-sm text-slate-500">Ranked by attributed revenue this month.</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[680px] text-left text-sm">
          <thead className="bg-clinic-mist text-xs uppercase tracking-[0.14em] text-slate-500">
            <tr>
              <th className="px-5 py-3">Rank</th>
              <th className="px-5 py-3">Consultant</th>
              <th className="px-5 py-3">Revenue</th>
              <th className="px-5 py-3">Commissions</th>
              <th className="px-5 py-3">Conversion</th>
              <th className="px-5 py-3">Level</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border bg-white">
            {consultants.map((consultant) => (
              <tr key={consultant.name} className="hover:bg-clinic-mist/70">
                <td className="px-5 py-4 font-semibold text-clinic-navy">#{consultant.rank}</td>
                <td className="px-5 py-4 font-semibold text-clinic-ink">{consultant.name}</td>
                <td className="px-5 py-4 text-slate-600">{currency(consultant.revenue)}</td>
                <td className="px-5 py-4 text-slate-600">{currency(consultant.commissions)}</td>
                <td className="px-5 py-4 text-slate-600">{consultant.conversion}</td>
                <td className="px-5 py-4">
                  <Badge>{consultant.status}</Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
