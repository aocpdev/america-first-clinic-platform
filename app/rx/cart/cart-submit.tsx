"use client";

import { useFormStatus } from "react-dom";

export function CartSubmit({ children, pendingText = "Updating…", className = "rx-home-primary" }: { children: React.ReactNode; pendingText?: string; className?: string }) {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending} aria-disabled={pending} className={className}>{pending ? pendingText : children}</button>;
}
