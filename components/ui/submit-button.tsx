"use client";

import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import type { ButtonProps } from "@/components/ui/button";

export function SubmitButton({
  children,
  pendingText = "Saving...",
  disabled,
  ...props
}: ButtonProps & { pendingText?: string }) {
  const { pending } = useFormStatus();

  return (
    <Button disabled={pending || disabled} {...props}>
      {pending ? pendingText : children}
    </Button>
  );
}
