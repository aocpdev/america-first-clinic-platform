"use client";

import * as React from "react";
import { Input, type InputProps } from "@/components/ui/input";
import { maskPhoneInput, phoneCountryInfo } from "@/lib/phone";
import { cn } from "@/lib/utils";

export interface PhoneInputProps extends Omit<InputProps, "type" | "onChange"> {
  onChange?: React.ChangeEventHandler<HTMLInputElement>;
}

const PhoneInput = React.forwardRef<HTMLInputElement, PhoneInputProps>(
  ({ defaultValue, value, onChange, placeholder = "(555) 123-4567", className, ...props }, ref) => {
    const controlled = value !== undefined;
    const [innerValue, setInnerValue] = React.useState(() => maskPhoneInput(String(defaultValue ?? "")));
    const displayValue = controlled ? maskPhoneInput(String(value ?? "")) : innerValue;
    const country = phoneCountryInfo(displayValue);

    return (
      <div className="relative">
        <div
          className="pointer-events-none absolute left-3 top-1/2 z-10 flex -translate-y-1/2 items-center gap-1 rounded-md bg-clinic-mist px-1.5 py-1 text-xs font-semibold text-slate-600"
          aria-hidden="true"
          title={country.label}
        >
          <span className="text-base leading-none">{country.flag}</span>
          <span>{country.callingCode || "+1"}</span>
        </div>
        <Input
          {...props}
          ref={ref}
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder={placeholder}
          value={displayValue}
          className={cn(className, "pl-[4.5rem]")}
          onChange={(event) => {
            const nextValue = maskPhoneInput(event.target.value);
            event.target.value = nextValue;
            if (!controlled) setInnerValue(nextValue);
            onChange?.(event);
          }}
        />
      </div>
    );
  }
);

PhoneInput.displayName = "PhoneInput";

export { PhoneInput };
