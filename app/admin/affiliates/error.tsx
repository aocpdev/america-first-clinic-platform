"use client";

export default function AffiliateError({ reset }: { reset: () => void }) {
  return <div className="mx-auto max-w-xl space-y-4 p-8"><h2 className="text-xl font-semibold">Affiliate setup is temporarily unavailable</h2>
    <p className="text-sm text-slate-500">Please try again. If this continues, ask your administrator to verify that the affiliate database setup is complete.</p>
    <button onClick={reset} className="rounded-lg bg-clinic-navy px-5 py-3 text-sm text-white">Try again</button></div>;
}
