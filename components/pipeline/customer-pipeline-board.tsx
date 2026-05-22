"use client";

import { useMemo } from "react";
import Image from "next/image";
import { CalendarDays, CheckSquare, FileText, Mail, MessageCircle, Phone, Tag } from "lucide-react";
import { updateCustomerPipelineStage } from "@/app/pipeline/actions";
import { SubmitButton } from "@/components/ui/submit-button";
import { CUSTOMER_PIPELINE_STAGES, type CustomerPipelineStage } from "@/lib/sales/pipeline";
import { formatCurrency } from "@/lib/products/catalog";

type PipelineCustomer = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  consultantName: string | null;
  consultantAvatarUrl: string | null;
  pipelineStage: CustomerPipelineStage;
  pipelineUpdatedAt: string | null;
  lifetimeValueCents: number;
  latestOrderTotalCents: number | null;
  latestOrderCreatedAt: string | null;
  notes: string | null;
};

const stageStyles = [
  "bg-[#d8f3ee]",
  "bg-[#e6ebf1]",
  "bg-[#dce8ff]",
  "bg-[#eef2f7]",
  "bg-[#f0ecff]",
  "bg-[#e9f7ef]",
  "bg-[#fff3d9]",
  "bg-[#e2f7e8]",
  "bg-[#e9efff]",
  "bg-[#f6e8ec]"
];

function formatDate(value: string | null) {
  if (!value) return "No activity yet";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(value));
}

function initials(name: string | null, email: string) {
  const source = name || email;
  return source
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join("")
    .toUpperCase();
}

export function CustomerPipelineBoard({
  customers,
  showConsultant
}: {
  customers: PipelineCustomer[];
  showConsultant?: boolean;
}) {
  const customersByStage = useMemo(() => {
    const map = new Map<CustomerPipelineStage, PipelineCustomer[]>();
    CUSTOMER_PIPELINE_STAGES.forEach((stage) => map.set(stage.value, []));
    customers.forEach((customer) => {
      const bucket = map.get(customer.pipelineStage) ?? map.get("NEW_SALE");
      bucket?.push(customer);
    });
    return map;
  }, [customers]);

  return (
    <div className="overflow-x-auto pb-4">
      <div className="flex min-w-max gap-4">
        {CUSTOMER_PIPELINE_STAGES.map((stage, index) => {
          const stageCustomers = customersByStage.get(stage.value) ?? [];
          const stageValueCents = stageCustomers.reduce(
            (sum, customer) => sum + (customer.latestOrderTotalCents ?? customer.lifetimeValueCents),
            0
          );

          return (
            <section key={stage.value} className="w-[360px] shrink-0">
              <div className={`rounded-xl border border-border px-4 py-3 shadow-sm ${stageStyles[index % stageStyles.length]}`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-semibold text-clinic-ink">{stage.label}</h3>
                    <div className="mt-2 flex items-center gap-3 text-sm text-slate-600">
                      <span>{stageCustomers.length} Opportunities</span>
                      <span className="font-semibold text-clinic-ink">{formatCurrency(stageValueCents)}</span>
                    </div>
                  </div>
                  <span className="text-2xl leading-none text-slate-500">‹</span>
                </div>
              </div>

              <div className="mt-4 space-y-3">
                {stageCustomers.map((customer) => (
                  <article key={customer.id} className="rounded-xl border border-border bg-white p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-base font-semibold text-clinic-ink">{customer.name}</p>
                        {showConsultant && customer.consultantName ? (
                          <p className="mt-1 truncate text-xs font-semibold uppercase tracking-[0.14em] text-clinic-red">
                            {customer.consultantName}
                          </p>
                        ) : null}
                      </div>
                      <div className="relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full border border-slate-300 bg-[#dce8ff] text-sm font-semibold text-clinic-navy">
                        {customer.consultantAvatarUrl ? (
                          <Image
                            src={customer.consultantAvatarUrl}
                            alt={customer.consultantName ?? "Consultant"}
                            fill
                            sizes="40px"
                            className="object-cover"
                          />
                        ) : (
                          <span className="m-auto">{initials(customer.consultantName, customer.email)}</span>
                        )}
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      <span className="rounded-full border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-600">
                        Customer
                      </span>
                      <span className="rounded-full border border-violet-300 px-2.5 py-1 text-xs font-medium text-violet-700">
                        Wellness
                      </span>
                    </div>

                    <div className="mt-5 grid grid-cols-[96px_1fr] gap-y-3 text-sm text-slate-600">
                      <p className="font-semibold text-slate-600">Source:</p>
                      <p className="truncate">CRM / Consultant</p>
                      <p className="font-semibold text-slate-600">Value:</p>
                      <p>{formatCurrency(customer.latestOrderTotalCents ?? customer.lifetimeValueCents)}</p>
                    </div>

                    <div className="mt-4 space-y-2 text-xs text-slate-500">
                      <p className="flex items-center gap-2 truncate" title={customer.email}>
                        <Mail className="h-3.5 w-3.5" />
                        {customer.email}
                      </p>
                      {customer.phone ? (
                        <p className="flex items-center gap-2">
                          <Phone className="h-3.5 w-3.5" />
                          {customer.phone}
                        </p>
                      ) : null}
                      <p className="flex items-center gap-2">
                        <CalendarDays className="h-3.5 w-3.5" />
                        {formatDate(customer.pipelineUpdatedAt ?? customer.latestOrderCreatedAt)}
                      </p>
                    </div>

                    {customer.notes ? (
                      <p className="mt-3 line-clamp-2 rounded-xl bg-clinic-mist px-3 py-2 text-xs leading-5 text-slate-600">{customer.notes}</p>
                    ) : null}

                    <div className="mt-4 flex items-center gap-4 text-slate-500">
                      <Phone className="h-4 w-4" />
                      <MessageCircle className="h-4 w-4" />
                      <Tag className="h-4 w-4" />
                      <FileText className="h-4 w-4" />
                      <CheckSquare className="h-4 w-4" />
                      <CalendarDays className="h-4 w-4" />
                    </div>

                    <form action={updateCustomerPipelineStage} className="mt-4 flex gap-2">
                      <input type="hidden" name="customerId" value={customer.id} />
                      <select
                        name="pipelineStage"
                        defaultValue={customer.pipelineStage}
                        className="h-9 min-w-0 flex-1 rounded-xl border border-border bg-white px-2 text-xs font-semibold text-clinic-ink outline-none"
                      >
                        {CUSTOMER_PIPELINE_STAGES.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                      <SubmitButton size="sm" pendingText="Saving...">Move</SubmitButton>
                    </form>
                  </article>
                ))}

                {stageCustomers.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-border bg-white p-5 text-center text-xs text-slate-500">
                    No opportunities in this stage.
                  </div>
                ) : null}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
