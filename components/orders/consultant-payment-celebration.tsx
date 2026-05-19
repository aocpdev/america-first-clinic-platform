"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { CheckCircle2, ClipboardList, Sparkles } from "lucide-react";
import { currency } from "@/lib/utils";

type ConsultantPaymentCelebrationProps = {
  orderId: string;
  customerName: string;
  orderTotalCents: number;
  commissionCents: number;
};

const confettiPieces = [
  { left: "7%", delay: 0, color: "#DC1F2A", size: 8 },
  { left: "15%", delay: 0.12, color: "#0B3F75", size: 10 },
  { left: "24%", delay: 0.24, color: "#10B981", size: 7 },
  { left: "34%", delay: 0.04, color: "#DC1F2A", size: 11 },
  { left: "45%", delay: 0.18, color: "#0B3F75", size: 8 },
  { left: "56%", delay: 0.28, color: "#10B981", size: 10 },
  { left: "67%", delay: 0.08, color: "#DC1F2A", size: 7 },
  { left: "78%", delay: 0.2, color: "#0B3F75", size: 11 },
  { left: "88%", delay: 0.32, color: "#10B981", size: 8 },
  { left: "95%", delay: 0.14, color: "#DC1F2A", size: 9 }
];

function shortId(id: string) {
  return id.slice(0, 8).toUpperCase();
}

export function ConsultantPaymentCelebration({
  orderId,
  customerName,
  orderTotalCents,
  commissionCents
}: ConsultantPaymentCelebrationProps) {
  return (
    <section className="relative overflow-hidden rounded-[32px] border border-emerald-200 bg-[radial-gradient(circle_at_top_left,_#ECFDF5,_#FFFFFF_48%,_#F8FBFF)] px-6 py-7 shadow-line sm:px-8">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {confettiPieces.map((piece, index) => (
          <motion.span
            key={`${piece.left}-${index}`}
            initial={{ y: -40, opacity: 0, rotate: 0 }}
            animate={{ y: 210, opacity: [0, 1, 1, 0], rotate: 180 }}
            transition={{ duration: 2.8, delay: piece.delay, ease: "easeOut", repeat: 1, repeatDelay: 1.5 }}
            className="absolute top-0 rounded-sm"
            style={{
              left: piece.left,
              width: piece.size,
              height: piece.size * 1.8,
              backgroundColor: piece.color
            }}
          />
        ))}
      </div>

      <div className="relative grid gap-6 lg:grid-cols-[1fr_360px] lg:items-center">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white px-4 py-2 text-sm font-black text-emerald-800 shadow-line">
            <CheckCircle2 className="size-4" />
            Payment collected
          </div>
          <h2 className="mt-5 max-w-3xl text-4xl font-black leading-tight text-clinic-ink sm:text-5xl">
            Great work. This order is paid.
          </h2>
          <p className="mt-4 max-w-2xl text-lg leading-8 text-slate-600">
            {customerName} has completed payment for order #{shortId(orderId)}. The commission below is your estimated earnings for this sale and will move through the approval workflow.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/consultant/sales"
              className="inline-flex h-12 items-center justify-center rounded-2xl bg-clinic-navy px-5 text-sm font-black text-white shadow-soft transition hover:bg-clinic-blue"
            >
              Create another order
            </Link>
            <Link
              href="/consultant/orders"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-border bg-white px-5 text-sm font-black text-clinic-navy shadow-line transition hover:border-clinic-blue"
            >
              <ClipboardList className="size-4" />
              View my orders
            </Link>
          </div>
        </div>

        <motion.div
          initial={{ y: 18, opacity: 0, scale: 0.98 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          transition={{ duration: 0.45, ease: "easeOut" }}
          className="rounded-[28px] border border-emerald-200 bg-white p-5 shadow-soft"
        >
          <div className="rounded-[24px] bg-emerald-50 p-5">
            <div className="flex items-center gap-2 text-sm font-black uppercase tracking-[0.16em] text-emerald-800">
              <Sparkles className="size-4" />
              Your commission
            </div>
            <p className="mt-4 text-5xl font-black tracking-normal text-emerald-900">{currency(commissionCents / 100)}</p>
            <p className="mt-3 text-sm leading-6 text-emerald-800">Estimated commission pending approval.</p>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-clinic-mist p-4">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Order total</p>
              <p className="mt-2 text-2xl font-black text-clinic-navy">{currency(orderTotalCents / 100)}</p>
            </div>
            <div className="rounded-2xl bg-clinic-mist p-4">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Status</p>
              <p className="mt-2 text-2xl font-black text-clinic-navy">Paid</p>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
