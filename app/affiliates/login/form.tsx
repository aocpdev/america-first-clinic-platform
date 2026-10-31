"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { signInAffiliate, type AffiliateLoginState } from "./actions";

export function AffiliateLoginForm() {
  const [state, action, pending] = useActionState(signInAffiliate, {} as AffiliateLoginState);
  return <form action={action} className="space-y-5" data-clarity-mask="true">
    <label className="block space-y-2 text-sm font-medium">Email<Input name="email" type="email" autoComplete="username" required /></label>
    <label className="block space-y-2 text-sm font-medium">Password<Input name="password" type="password" autoComplete="current-password" required maxLength={256} /></label>
    <Button className="w-full" size="lg" type="submit" disabled={pending}>{pending ? "Signing in…" : "Sign in"}</Button>
    {state.error && <p role="alert" className="text-sm text-red-700">{state.error}</p>}
  </form>;
}
