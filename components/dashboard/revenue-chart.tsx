"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { revenueSeries } from "@/lib/mock-data";

export function RevenueChart() {
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={revenueSeries} margin={{ left: -18, right: 8, top: 12, bottom: 0 }}>
          <defs>
            <linearGradient id="revenue" x1="0" x2="0" y1="0" y2="1">
              <stop offset="5%" stopColor="#0B4F8A" stopOpacity={0.28} />
              <stop offset="95%" stopColor="#0B4F8A" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#E5EEF6" vertical={false} />
          <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: "#64748B", fontSize: 12 }} />
          <YAxis axisLine={false} tickLine={false} tick={{ fill: "#64748B", fontSize: 12 }} />
          <Tooltip
            contentStyle={{ borderRadius: 12, border: "1px solid #DDE8F2", boxShadow: "0 16px 40px rgba(7,55,99,.12)" }}
          />
          <Area type="monotone" dataKey="revenue" stroke="#073763" strokeWidth={3} fill="url(#revenue)" />
          <Area type="monotone" dataKey="commissions" stroke="#DC1F2A" strokeWidth={2} fill="transparent" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
