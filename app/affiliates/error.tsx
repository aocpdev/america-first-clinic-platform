"use client";
export default function AffiliatePortalError({ reset }: { reset: () => void }) {
  return <main className="mx-auto max-w-md space-y-4 px-5 py-12"><h1 className="text-xl font-semibold">Workspace temporarily unavailable</h1><p className="text-sm text-slate-500">Please try again or contact your program administrator.</p><button onClick={reset} className="rounded-lg bg-clinic-navy px-5 py-3 text-white">Try again</button></main>;
}
