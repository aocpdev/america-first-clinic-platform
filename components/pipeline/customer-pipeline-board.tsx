"use client";

import { useMemo } from "react";
import { CalendarDays, Mail, Phone } from "lucide-react";
import { updateCustomerPipelineStage } from "@/app/pipeline/actions";
import { Badge } from "@/components/ui/badge";
import { SubmitButton } from "@/components/ui/submit-button";
import { CUSTOMER_PIPELINE_STAGES, type CustomerPipelineStage } from "@/lib/sales/pipeline";
import { formatCurrency } from "@/lib/products/catalog";

type PipelineCustomer = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  consultantName: string | null;
  pipelineStage: CustomerPipelineStage;
  pipelineUpdatedAt: string | null;
  lifetimeValueCents: number;
  latestOrderTotalCents: number | null;
  latestOrderCreatedAt: string | null;
  notes: string | null;
};

function formatDate(value: string | null) {
  if (!value) return "No activity yet";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(value));
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
      const bucket = map.get(customer.pipelineStage) ?? map.get("NEW_LEAD");
      bucket?.push(customer);
    });
    return map;
  }, [customers]);

  return (
    <div className="overflow-x-auto pb-4">
      <div className="grid min-w-[1280px] grid-cols-5 gap-4 xl:min-w-0">
        {CUSTOMER_PIPELINE_STAGES.map((stage) => {
          const stageCustomers = customersByStage.get(stage.value) ?? [];

          return (
            <section key={stage.value} className="rounded-3xl border border-border bg-white p-3 shadow-sm">
              <div className="flex items-center justify-between px-1 py-2">
                <div>
                  <h3 className="text-sm font-semibold text-clinic-ink">{stage.label}</h3>
                  <p className="mt-1 text-xs text-slate-500">{stageCustomers.length} customers</p>
                </div>
                <Badge>{stageCustomers.length}</Badge>
              </div>

              <div className="mt-3 space-y-3">
                {stageCustomers.map((customer) => (
                  <article key={customer.id} className="rounded-2xl border border-border bg-clinic-mist p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-clinic-ink">{customer.name}</p>
                        {showConsultant && customer.consultantName ? (
                          <p className="mt-1 text-xs font-semibold uppercase tracking-[0.14em] text-clinic-red">
                            {customer.consultantName}
                          </p>
                        ) : null}
                      </div>
                      <p className="text-sm font-semibold text-clinic-navy">{formatCurrency(customer.lifetimeValueCents)}</p>
                    </div>

                    <div className="mt-3 space-y-2 text-xs text-slate-500">
                      <p className="flex items-center gap-2 truncate">
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

                    {customer.latestOrderTotalCents !== null ? (
                      <div className="mt-3 rounded-xl bg-white px-3 py-2 text-xs">
                        <span className="text-slate-500">Latest order </span>
                        <span className="font-semibold text-clinic-ink">{formatCurrency(customer.latestOrderTotalCents)}</span>
                      </div>
                    ) : null}

                    {customer.notes ? (
                      <p className="mt-3 line-clamp-2 text-xs leading-5 text-slate-600">{customer.notes}</p>
                    ) : null}

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
                  <div className="rounded-2xl border border-dashed border-border bg-clinic-mist p-5 text-center text-xs text-slate-500">
                    No customers in this stage.
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
