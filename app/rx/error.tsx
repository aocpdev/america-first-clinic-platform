"use client";
export default function RxError({ reset }: { reset: () => void }) {
  return <div className="mx-auto max-w-lg px-4 py-16 text-center"><h2 className="text-2xl font-semibold text-clinic-navy">The catalog is temporarily unavailable</h2><p className="mt-4 text-sm leading-6 text-slate-500">Please try again. No order or payment has been created.</p><button onClick={reset} className="mt-6 min-h-11 rounded-xl bg-clinic-navy px-5 text-sm font-medium text-white">Try again</button></div>;
}
