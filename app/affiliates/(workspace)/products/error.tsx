"use client";

export default function CatalogError({ reset }: { reset: () => void }) {
  return <section role="alert" className="rounded-2xl border bg-white p-8">
    <h1 className="text-xl font-semibold text-clinic-navy">The catalog is temporarily unavailable</h1>
    <p className="mt-3 text-sm leading-6 text-slate-500">We could not load current product information. Please try again; outdated prices and earnings will not be substituted.</p>
    <button onClick={reset} className="mt-5 min-h-11 rounded-xl bg-clinic-navy px-5 text-sm font-semibold text-white">Try again</button>
  </section>;
}
