export default function RxLoading() {
  return <div role="status" aria-busy="true" className="mx-auto max-w-6xl space-y-5 px-4 py-12"><p className="text-sm text-slate-500">Loading the catalog…</p><div aria-hidden="true" className="h-64 rounded-2xl bg-clinic-mist motion-safe:animate-pulse" /></div>;
}
