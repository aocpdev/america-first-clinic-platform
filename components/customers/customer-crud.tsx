"use client";

import { useState } from "react";
import { Pencil, Plus, Trash2, X } from "lucide-react";
import { createCustomer, deleteCustomer, updateCustomer } from "@/app/customers/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PhoneInput } from "@/components/ui/phone-input";
import { SubmitButton } from "@/components/ui/submit-button";
import { US_STATE_OPTIONS } from "@/lib/locations/us-states";
import { CUSTOMER_PIPELINE_STAGES } from "@/lib/sales/pipeline";

export type EditableCustomer = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
  phone: string | null;
  dateOfBirth?: Date | null;
  birthSex?: string | null;
  pipelineStage: string;
  tags: string[];
  notes: string | null;
  addresses?: {
    id: string;
    line1: string;
    line2: string | null;
    city: string;
    state: string;
    postalCode: string;
    country: string;
    isDefault: boolean;
  }[];
};

function dateInputValue(date?: Date | null) {
  if (!date) return "";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "UTC",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);
}

function Field({
  label,
  children
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="space-y-2">
      <span className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">{label}</span>
      {children}
    </label>
  );
}

export function CreateCustomerButton({ returnTo }: { returnTo: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button type="button" variant="accent" size="lg" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" />
        Create customer
      </Button>
      {open ? (
        <CustomerModal
          title="Create customer"
          description="Add a customer record to your CRM workspace."
          action={createCustomer}
          returnTo={returnTo}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}

export function EditCustomerButton({
  customer,
  returnTo
}: {
  customer: EditableCustomer;
  returnTo: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button type="button" variant="outline" onClick={() => setOpen(true)}>
        <Pencil className="h-4 w-4" />
        Edit customer
      </Button>
      {open ? (
        <CustomerModal
          title="Edit customer"
          description="Update contact details, CRM status, notes, and telehealth-ready demographics."
          action={updateCustomer}
          customer={customer}
          returnTo={returnTo}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}

export function DeleteCustomerButton({
  customerId,
  customerName
}: {
  customerId: string;
  customerName: string;
}) {
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <Button type="button" variant="outline" onClick={() => setConfirming(true)}>
        <Trash2 className="h-4 w-4" />
        Delete
      </Button>
    );
  }

  return (
    <form action={deleteCustomer} className="rounded-2xl border border-red-200 bg-red-50 p-3">
      <input type="hidden" name="customerId" value={customerId} />
      <p className="text-sm font-semibold text-red-700">Delete {customerName}? This also removes their orders and payment records.</p>
      <div className="mt-3 flex gap-2">
        <Button type="button" variant="outline" onClick={() => setConfirming(false)}>Cancel</Button>
        <SubmitButton variant="accent" pendingText="Deleting...">Confirm delete</SubmitButton>
      </div>
    </form>
  );
}

function CustomerModal({
  title,
  description,
  action,
  customer,
  returnTo,
  onClose
}: {
  title: string;
  description: string;
  action: (formData: FormData) => Promise<void>;
  customer?: EditableCustomer;
  returnTo: string;
  onClose: () => void;
}) {
  const address = customer?.addresses?.find((item) => item.isDefault) ?? customer?.addresses?.[0] ?? null;

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-clinic-navy/30 p-0 backdrop-blur-sm sm:items-center sm:p-6">
      <div className="mx-auto max-h-[92vh] w-full max-w-4xl overflow-hidden rounded-t-3xl border border-white/70 bg-white shadow-[0_24px_80px_rgba(7,55,99,0.18)] sm:rounded-3xl">
        <div className="flex items-start justify-between gap-4 border-b border-border px-6 py-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Customer CRM</p>
            <h3 className="mt-2 text-2xl font-semibold text-clinic-ink">{title}</h3>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">{description}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border bg-white text-slate-500 transition hover:bg-clinic-mist hover:text-clinic-ink"
            aria-label="Close customer modal"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form action={action} className="grid max-h-[calc(92vh-120px)] gap-5 overflow-y-auto p-6">
          {customer ? <input type="hidden" name="customerId" value={customer.id} /> : null}
          <input type="hidden" name="returnTo" value={returnTo} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="First name">
              <Input name="firstName" defaultValue={customer?.firstName ?? ""} placeholder="First name" required />
            </Field>
            <Field label="Last name">
              <Input name="lastName" defaultValue={customer?.lastName ?? ""} placeholder="Last name" required />
            </Field>
            <Field label="Email">
              <Input name="email" type="email" defaultValue={customer?.email ?? ""} placeholder="customer@email.com" required />
            </Field>
            <Field label="Phone">
              <PhoneInput name="phone" defaultValue={customer?.phone ?? ""} required />
            </Field>
            <Field label="Date of birth">
              <Input name="dateOfBirth" type="date" defaultValue={dateInputValue(customer?.dateOfBirth)} required />
            </Field>
            <Field label="Birth sex">
              <select
                name="birthSex"
                defaultValue={customer?.birthSex ?? ""}
                className="h-11 w-full rounded-lg border border-input bg-white px-3 text-sm font-semibold text-clinic-ink shadow-line transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                required
              >
                <option value="" disabled>Select birth sex</option>
                <option value="MALE">Male</option>
                <option value="FEMALE">Female</option>
                <option value="PREFER_NOT_TO_SAY">Prefer not to say</option>
              </select>
            </Field>
            <div className="sm:col-span-2">
              <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-clinic-navy">Telehealth address</p>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  Required for Qualiphy exams. The state is saved as a two-letter code for telehealth routing.
                </p>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <Field label="Address line 1">
                    <Input name="addressLine1" defaultValue={address?.line1 ?? ""} placeholder="Street address" required />
                  </Field>
                  <Field label="Address line 2">
                    <Input name="addressLine2" defaultValue={address?.line2 ?? ""} placeholder="Apt, suite, unit, optional" />
                  </Field>
                  <Field label="City">
                    <Input name="city" defaultValue={address?.city ?? ""} placeholder="City" required />
                  </Field>
                  <Field label="State">
                    <select
                      name="state"
                      defaultValue={address?.state ?? ""}
                      className="h-11 w-full rounded-lg border border-input bg-white px-3 text-sm font-semibold text-clinic-ink shadow-line transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      required
                    >
                      <option value="" disabled>Select state</option>
                      {US_STATE_OPTIONS.map((state) => (
                        <option key={state.value} value={state.value}>{state.label}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="ZIP code">
                    <Input name="postalCode" defaultValue={address?.postalCode ?? ""} placeholder="ZIP code" required />
                  </Field>
                  <Field label="Country">
                    <Input name="country" defaultValue={address?.country ?? "US"} placeholder="Country" required />
                  </Field>
                </div>
              </div>
            </div>
            <Field label="Pipeline">
              <select
                name="pipelineStage"
                defaultValue={customer?.pipelineStage ?? "AWAITING_PAYMENT"}
                className="h-11 w-full rounded-lg border border-input bg-white px-3 text-sm font-semibold text-clinic-ink shadow-line transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {CUSTOMER_PIPELINE_STAGES.map((stage) => (
                  <option key={stage.value} value={stage.value}>{stage.label}</option>
                ))}
              </select>
            </Field>
            <Field label="Tags">
              <Input name="tags" defaultValue={customer?.tags.join(", ") ?? ""} placeholder="weight loss, follow-up, VIP" />
            </Field>
            <label className="space-y-2 sm:col-span-2">
              <span className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Internal notes</span>
              <textarea
                name="notes"
                defaultValue={customer?.notes ?? ""}
                rows={4}
                className="w-full rounded-2xl border border-input bg-white px-3 py-3 text-sm text-clinic-ink shadow-line transition placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                placeholder="Call context, preferences, medical workflow notes..."
              />
            </label>
          </div>

          <div className="flex flex-col-reverse gap-3 border-t border-border pt-5 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <SubmitButton variant="accent" pendingText="Saving customer...">Save customer</SubmitButton>
          </div>
        </form>
      </div>
    </div>
  );
}
