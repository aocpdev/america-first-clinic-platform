"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { saveAffiliate, saveAffiliateDefault, connectAffiliateLogin, type AffiliateActionState } from "./actions";

const initialState: AffiliateActionState = {};
const selectClass = "h-11 w-full rounded-lg border border-input bg-white px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function AffiliateLoginConnectionForm({ id, revision }: { id: string; revision: number }) {
  const [state, action, pending] = useActionState(connectAffiliateLogin, initialState);
  return <form action={action} className="space-y-4">
    <input type="hidden" name="id" value={id} /><input type="hidden" name="revision" value={revision} />
    <p className="text-sm leading-6 text-slate-500">Connect the active account with this affiliate’s verified email. This does not create an account, send an invitation or change CRM permissions.</p>
    <Button type="submit" disabled={pending}>{pending ? "Connecting…" : "Connect existing account"}</Button>
    <Feedback state={state} />
  </form>;
}

function Feedback({ state }: { state: AffiliateActionState }) {
  return <div aria-live="polite">
    {state.error && <p role="alert" className="text-sm text-red-700">{state.error}</p>}
    {state.success && <p className="text-sm text-emerald-700">{state.success}</p>}
  </div>;
}

export function DefaultCommissionForm({ rateBps, revision }: { rateBps: number; revision: number }) {
  const [state, action, pending] = useActionState(saveAffiliateDefault, initialState);
  return <form action={action} className="space-y-3">
    <input type="hidden" name="revision" value={revision} />
    <label className="block space-y-2 text-sm font-medium">Default commission (%)
      <Input name="commissionPercent" type="number" min="0" max="100" step="0.01" required defaultValue={rateBps / 100} />
    </label>
    <p className="text-xs leading-5 text-slate-500">Of commissionable margin. Applies to future purchases for affiliates without an individual override.</p>
    <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save default"}</Button>
    <Feedback state={state} />
  </form>;
}

export type EditableAffiliate = {
  id: string; revision: number; displayName: string; email: string;
  category: string; status: string; commissionBps: number | null;
};

export function AffiliateForm({ affiliate }: { affiliate?: EditableAffiliate }) {
  const [state, action, pending] = useActionState(saveAffiliate, initialState);
  return <form action={action} className="space-y-4">
    <input type="hidden" name="id" value={affiliate?.id ?? ""} />
    <input type="hidden" name="revision" value={affiliate?.revision ?? 0} />
    <div className="grid gap-4 sm:grid-cols-2">
      <label className="block space-y-2 text-sm font-medium">Display name
        <Input name="displayName" required minLength={2} maxLength={100} autoComplete="name" defaultValue={affiliate?.displayName} />
      </label>
      <label className="block space-y-2 text-sm font-medium">Email
        <Input name="email" type="email" required maxLength={254} autoComplete="email" defaultValue={affiliate?.email} />
      </label>
      <label className="block space-y-2 text-sm font-medium">Affiliate type
        <select name="category" className={selectClass} defaultValue={affiliate?.category ?? "OTHER"}>
          <option value="INFLUENCER">Influencer</option><option value="GYM">Gym</option>
          <option value="TRAINER">Trainer</option><option value="ARTIST">Artist</option><option value="OTHER">Other</option>
        </select>
      </label>
      <label className="block space-y-2 text-sm font-medium">Status
        <select name="status" className={selectClass} defaultValue={affiliate?.status ?? "PENDING"}>
          <option value="PENDING">Pending approval</option><option value="APPROVED">Approved</option>
          <option value="SUSPENDED">Suspended</option><option value="ARCHIVED">Archived</option>
        </select>
      </label>
      <label className="block space-y-2 text-sm font-medium">Individual commission (%)
        <Input name="commissionPercent" type="number" min="0" max="100" step="0.01" placeholder="Use company default" defaultValue={affiliate?.commissionBps == null ? "" : affiliate.commissionBps / 100} />
      </label>
    </div>
    <p className="text-xs leading-5 text-slate-500">Leave commission blank to follow the company default. Zero explicitly disables earnings. Archive instead of deleting to preserve history. Approval does not yet send a login invitation.</p>
    <Button type="submit" disabled={pending}>{pending ? "Saving…" : affiliate ? "Save changes" : "Create affiliate"}</Button>
    <Feedback state={state} />
  </form>;
}
