"use client";

import * as React from "react";
import { Input, type InputProps } from "@/components/ui/input";
import { maskPhoneInput } from "@/lib/phone";

export interface PhoneInputProps extends Omit<InputProps, "type" | "onChange"> {
  onChange?: React.ChangeEventHandler<HTMLInputElement>;
}

const PhoneInput = React.forwardRef<HTMLInputElement, PhoneInputProps>(
  ({ defaultValue, value, onChange, placeholder = "+1 (555) 123-4567", ...props }, ref) => {
    const controlled = value !== undefined;
    const [innerValue, setInnerValue] = React.useState(() => maskPhoneInput(String(defaultValue ?? "")));
    const displayValue = controlled ? maskPhoneInput(String(value ?? "")) : innerValue;

    return (
      <Input
        {...props}
        ref={ref}
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        placeholder={placeholder}
        value={displayValue}
        onChange={(event) => {
          const nextValue = maskPhoneInput(event.target.value);
          event.target.value = nextValue;
          if (!controlled) setInnerValue(nextValue);
          onChange?.(event);
        }}
      />
    );
  }
);

PhoneInput.displayName = "PhoneInput";

export { PhoneInput };
