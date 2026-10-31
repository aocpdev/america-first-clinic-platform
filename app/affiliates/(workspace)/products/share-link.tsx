"use client";
import { useState } from "react";

export function AffiliateShareLink({ url, label, enabled, local }: { url: string; label: string; enabled: boolean; local: boolean }) {
  const [message, setMessage] = useState("");
  async function copy() {
    try { await navigator.clipboard.writeText(url); setMessage("Link copied"); }
    catch { setMessage("Select and copy the link below."); }
  }
  return <div className="space-y-3">
    <p className="text-xs text-slate-500">{local ? "Local test link · not for customers" : "Your referral link"}</p>
    <div className="flex flex-wrap gap-2">
      <button type="button" disabled={!enabled} onClick={copy} aria-label={`Copy link for ${label}`} className="min-h-11 rounded-xl bg-clinic-navy px-4 text-sm font-semibold text-white disabled:opacity-40">Copy link</button>
      {enabled && <a href={url} target="_blank" rel="noopener noreferrer nofollow" aria-label={`Open referral link for ${label}`} className="inline-flex min-h-11 items-center rounded-xl border px-4 text-sm font-medium text-clinic-navy">Open link ↗</a>}
    </div>
    <details><summary className="cursor-pointer text-xs text-slate-500">View link</summary><input aria-label={`Referral URL for ${label}`} readOnly value={url} className="mt-2 h-11 w-full min-w-0 rounded-lg border bg-slate-50 px-3 text-xs" /></details>
    <p role="status" className="text-xs text-slate-500">{message || (!enabled ? "Available after launch configuration." : "")}</p>
  </div>;
}
