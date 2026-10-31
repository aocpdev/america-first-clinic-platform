export default function AffiliateWorkspaceLoading() {
  return (
    <section role="status" aria-live="polite" aria-busy="true" className="space-y-6">
      <p className="text-sm text-slate-500">Loading your workspace…</p>
      <div aria-hidden="true" className="space-y-4 motion-safe:animate-pulse">
        <div className="h-8 w-48 rounded-lg bg-slate-100" />
        <div className="h-24 rounded-2xl border border-slate-100 bg-white" />
        <div className="h-24 rounded-2xl border border-slate-100 bg-white" />
      </div>
    </section>
  );
}
