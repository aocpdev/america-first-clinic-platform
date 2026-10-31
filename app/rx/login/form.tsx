"use client";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { signInCustomer, type CustomerLoginState } from "./actions";

export function CustomerLoginForm() {
  const [state, action, pending] = useActionState(signInCustomer, {} as CustomerLoginState);
  return <form action={action} className="mt-6 space-y-5" data-clarity-mask="true">
    <label className="block space-y-2 text-sm font-medium">Email<Input name="email" type="email" autoComplete="username" required maxLength={254} /></label>
    <label className="block space-y-2 text-sm font-medium">Password<Input name="password" type="password" autoComplete="current-password" required maxLength={256} /></label>
    <Button className="w-full" size="lg" disabled={pending} type="submit">{pending ? "Signing in…" : "Sign in"}</Button>
    {state.error && <p className="text-sm text-red-700" role="alert">{state.error}</p>}
  </form>;
}
