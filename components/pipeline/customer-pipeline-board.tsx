"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ChevronDown,
  Download,
  ExternalLink,
  FileText,
  FileUp,
  GripVertical,
  MapPin,
  NotebookPen,
  PackageCheck,
  Pill,
  ReceiptText,
  Search,
  SlidersHorizontal,
  Trash2,
  X
} from "lucide-react";
import {
  deleteOrderClinicalDocument,
  deleteUnpaidOrder,
  updateOrderOpportunityDetails,
  updatePipelineOrderStage,
  uploadOrderClinicalDocument
} from "@/app/pipeline/actions";
import { Button } from "@/components/ui/button";
import { OrderTrackingForm } from "@/components/orders/order-tracking-form";
import { SubmitButton } from "@/components/ui/submit-button";
import { carrierLabel, carrierTrackingUrl, SHIPPING_CARRIERS } from "@/lib/orders/tracking";
import { CUSTOMER_PIPELINE_STAGES, orderPipelineLabel, type CustomerPipelineStage } from "@/lib/sales/pipeline";
import { formatCurrency } from "@/lib/products/catalog";
import type { QualiphyExam } from "@/lib/qualiphy/exams";

type PipelineOpportunity = {
  id: string;
  customerId: string;
  name: string;
  email: string;
  phone: string | null;
  dateOfBirth: string | null;
  consultantName: string | null;
  consultantAvatarUrl: string | null;
  pipelineStage: CustomerPipelineStage;
  pipelineUpdatedAt: string | null;
  orderTotalCents: number;
  opportunityValueCents: number;
  adminMarginCents: number;
  shippingAddress: string | null;
  shippingCarrier: string | null;
  shippingTrackingCode: string | null;
  createdAt: string | null;
  notes: string | null;
  rxNotes: string | null;
  rxDocumentUrl: string | null;
  gfeNotes: string | null;
  gfeDocumentUrl: string | null;
  paymentStatus: string;
  orderStatus: string;
  clinicalDocuments: CustomerClinicalDocument[];
  orderHistory: CustomerOrderHistoryItem[];
};

type CustomerClinicalDocument = {
  id: string;
  type: "RX" | "GFE";
  title: string;
  notes: string | null;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
};

type CustomerOrderHistoryItem = {
  id: string;
  createdAt: string;
  customerDateOfBirth: string | null;
  orderTotalCents: number;
  opportunityValueCents: number;
  paymentStatus: string;
  orderStatus: string;
  pipelineStage: string;
  shippingAddress: string | null;
  shippingCarrier: string | null;
  shippingTrackingCode: string | null;
  products: string;
};

type PipelineFilters = {
  query: string;
  stage: "ALL" | CustomerPipelineStage;
  paymentStatus: "ALL" | string;
  tracking: "ALL" | "WITH_TRACKING" | "MISSING_TRACKING";
  dateRange: "ALL" | "7D" | "30D" | "90D";
};

const stageStyles = [
  "bg-[#edf4ff]",
  "bg-[#d8f3ee]",
  "bg-[#e8eef6]",
  "bg-[#eef2ff]",
  "bg-[#f4edff]",
  "bg-[#ecfdf5]",
  "bg-[#fff1f2]",
  "bg-[#f7f7fb]",
  "bg-[#e8f8ee]"
];

function formatDate(value: string | null) {
  if (!value) return "No activity yet";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(value));
}

function formatFullDate(value: string | null) {
  if (!value) return "No date";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
}

function formatBirthDate(value: string | null) {
  if (!value) return "DOB not provided";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(value));
}

function shortOrderId(id: string) {
  return id.slice(0, 8).toUpperCase();
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

function noteEntries(notes: string | null) {
  if (!notes) return [];
  return notes
    .split(/\n-{3,}\n/g)
    .map((note) => note.trim())
    .filter(Boolean);
}

function buildNoteHistory(existing: string | null, note: string) {
  const cleanNote = note.trim();
  if (!cleanNote) return existing ?? "";
  const stamp = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date());
  return [...noteEntries(existing), `${stamp}\n${cleanNote}`].join("\n---\n");
}

function documentLabel(type: "RX" | "GFE") {
  return type === "RX" ? "RX" : "Exam";
}

function fileSizeLabel(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isInteractiveTarget(target: EventTarget | null) {
  return target instanceof HTMLElement && Boolean(target.closest("a,button,input,textarea,select,label,form"));
}

function filterSearchText(opportunity: PipelineOpportunity) {
  return [
    opportunity.id,
    opportunity.name,
    opportunity.email,
    opportunity.phone,
    opportunity.consultantName,
    opportunity.shippingAddress,
    opportunity.shippingTrackingCode,
    opportunity.paymentStatus,
    opportunity.orderStatus
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function dateRangeCutoff(dateRange: PipelineFilters["dateRange"]) {
  if (dateRange === "ALL") return null;
  const days = dateRange === "7D" ? 7 : dateRange === "90D" ? 90 : 30;
  const cutoff = new Date();
  cutoff.setHours(0, 0, 0, 0);
  cutoff.setDate(cutoff.getDate() - (days - 1));
  return cutoff;
}

function matchesPipelineFilters(opportunity: PipelineOpportunity, filters: PipelineFilters) {
  const query = filters.query.trim().toLowerCase();
  if (query && !filterSearchText(opportunity).includes(query)) return false;
  if (filters.stage !== "ALL" && opportunity.pipelineStage !== filters.stage) return false;
  if (filters.paymentStatus !== "ALL" && opportunity.paymentStatus !== filters.paymentStatus) return false;
  if (filters.tracking === "WITH_TRACKING" && !opportunity.shippingTrackingCode) return false;
  if (filters.tracking === "MISSING_TRACKING" && opportunity.shippingTrackingCode) return false;

  const cutoff = dateRangeCutoff(filters.dateRange);
  if (cutoff) {
    const referenceDate = opportunity.createdAt ? new Date(opportunity.createdAt) : null;
    if (!referenceDate || referenceDate < cutoff) return false;
  }

  return true;
}

function activePipelineFilterCount(filters: PipelineFilters) {
  return [
    filters.query.trim(),
    filters.stage !== "ALL",
    filters.paymentStatus !== "ALL",
    filters.tracking !== "ALL",
    filters.dateRange !== "ALL"
  ].filter(Boolean).length;
}

function TrackingLink({
  carrier,
  trackingCode,
  compact = false
}: {
  carrier: string | null;
  trackingCode: string | null;
  compact?: boolean;
}) {
  if (!trackingCode) {
    if (compact) return null;

    return (
      <div className="rounded-2xl border border-dashed border-border bg-white px-3 py-2 text-sm text-slate-500">
        Tracking pending
      </div>
    );
  }

  const url = carrierTrackingUrl(carrier, trackingCode);
  const label = carrierLabel(carrier);
  const className = compact
    ? "flex items-start gap-1.5 rounded-xl bg-blue-50 px-2.5 py-2 text-xs text-clinic-navy transition hover:bg-white"
    : "inline-flex w-full items-start gap-2 rounded-2xl border border-blue-100 bg-blue-50 px-3 py-3 text-sm text-clinic-navy transition hover:bg-white";

  const content = (
    <>
      <PackageCheck className={`${compact ? "size-3.5" : "size-4"} mt-0.5 shrink-0`} />
      <span className="min-w-0">
        <span className={compact ? "block truncate" : "block font-semibold"}>{label}</span>
        <span className={compact ? "block truncate font-semibold" : "block break-all text-xs text-slate-500"}>{trackingCode}</span>
      </span>
    </>
  );

  return url ? (
    <a href={url} target="_blank" rel="noreferrer" className={className}>
      {content}
    </a>
  ) : (
    <div className={className}>{content}</div>
  );
}

const emptyPipelineFilters: PipelineFilters = {
  query: "",
  stage: "ALL",
  paymentStatus: "ALL",
  tracking: "ALL",
  dateRange: "ALL"
};

function PipelineFilterBar({
  filters,
  onChange,
  paymentStatuses,
  activeFilterCount,
  visibleCount,
  totalCount
}: {
  filters: PipelineFilters;
  onChange: (filters: PipelineFilters) => void;
  paymentStatuses: string[];
  activeFilterCount: number;
  visibleCount: number;
  totalCount: number;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    function closeOnOutsidePointer(event: PointerEvent) {
      if (!wrapperRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("pointerdown", closeOnOutsidePointer);
    return () => document.removeEventListener("pointerdown", closeOnOutsidePointer);
  }, [isOpen]);

  function updateFilter<Key extends keyof PipelineFilters>(key: Key, value: PipelineFilters[Key]) {
    onChange({ ...filters, [key]: value });
  }

  return (
    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="rounded-2xl border border-border bg-white/80 px-4 py-3 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">Pipeline view</p>
        <p className="mt-1 text-sm font-semibold text-clinic-ink">
          Showing {visibleCount} of {totalCount} opportunities
        </p>
      </div>

      <div
        ref={wrapperRef}
        className="relative inline-flex self-start sm:self-auto"
        onBlur={(event) => {
          const nextFocus = event.relatedTarget as Node | null;
          if (!event.currentTarget.contains(nextFocus)) {
            setIsOpen(false);
          }
        }}
      >
        <button
          type="button"
          className="inline-flex h-12 items-center gap-2 rounded-2xl border border-border bg-white px-4 text-sm font-semibold text-clinic-navy shadow-sm transition hover:border-clinic-blue/30 hover:bg-clinic-mist focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-100"
          aria-expanded={isOpen}
          onClick={() => setIsOpen((current) => !current)}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              setIsOpen(false);
              event.currentTarget.blur();
            }
          }}
        >
          <SlidersHorizontal className="size-4" />
          Filters
          {activeFilterCount ? (
            <span className="grid min-w-5 place-items-center rounded-full bg-clinic-red px-1.5 py-0.5 text-[11px] font-bold text-white">
              {activeFilterCount}
            </span>
          ) : null}
          <ChevronDown className={`size-4 text-slate-400 transition ${isOpen ? "rotate-180" : ""}`} />
        </button>

        {isOpen ? (
          <div className="absolute right-0 top-14 z-50 w-[min(92vw,34rem)] rounded-3xl border border-white/80 bg-white/95 p-4 text-left shadow-[0_24px_70px_rgba(15,35,58,0.18)] ring-1 ring-slate-900/5 backdrop-blur-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">Filter pipeline</p>
                <p className="mt-1 text-sm text-slate-500">Narrow the board without changing the saved pipeline.</p>
              </div>
              {activeFilterCount ? (
                <button
                  type="button"
                  className="rounded-xl px-3 py-2 text-xs font-semibold text-clinic-red transition hover:bg-red-50"
                  onClick={() => onChange(emptyPipelineFilters)}
                >
                  Reset
                </button>
              ) : null}
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <label className="md:col-span-2">
                <span className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Search</span>
                <span className="mt-2 flex h-12 items-center gap-2 rounded-2xl border border-border bg-white px-3">
                  <Search className="size-4 text-slate-400" />
                  <input
                    value={filters.query}
                    onChange={(event) => updateFilter("query", event.target.value)}
                    placeholder="Customer, order, agent, email, phone, address..."
                    className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-clinic-ink outline-none placeholder:text-slate-400"
                  />
                </span>
              </label>

              <FilterSelect
                label="Stage"
                value={filters.stage}
                onChange={(value) => updateFilter("stage", value as PipelineFilters["stage"])}
                options={[
                  { label: "All stages", value: "ALL" },
                  ...CUSTOMER_PIPELINE_STAGES.map((stage) => ({ label: stage.label, value: stage.value }))
                ]}
              />
              <FilterSelect
                label="Payment"
                value={filters.paymentStatus}
                onChange={(value) => updateFilter("paymentStatus", value)}
                options={[
                  { label: "All payments", value: "ALL" },
                  ...paymentStatuses.map((status) => ({ label: status.replaceAll("_", " "), value: status }))
                ]}
              />
              <FilterSelect
                label="Tracking"
                value={filters.tracking}
                onChange={(value) => updateFilter("tracking", value as PipelineFilters["tracking"])}
                options={[
                  { label: "All tracking", value: "ALL" },
                  { label: "With tracking", value: "WITH_TRACKING" },
                  { label: "Missing tracking", value: "MISSING_TRACKING" }
                ]}
              />
              <FilterSelect
                label="Created"
                value={filters.dateRange}
                onChange={(value) => updateFilter("dateRange", value as PipelineFilters["dateRange"])}
                options={[
                  { label: "All time", value: "ALL" },
                  { label: "Last 7 days", value: "7D" },
                  { label: "Last 30 days", value: "30D" },
                  { label: "Last 90 days", value: "90D" }
                ]}
              />
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  options,
  onChange
}: {
  label: string;
  value: string;
  options: Array<{ label: string; value: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <label>
      <span className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 h-12 w-full rounded-2xl border border-border bg-white px-3 text-sm font-semibold text-clinic-ink outline-none transition focus:border-clinic-blue/40 focus:ring-4 focus:ring-blue-100"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function CustomerPipelineBoard({
  customers,
  showConsultant,
  mode = "admin",
  basePath = "/admin",
  qualiphyExams = [],
  qualiphyExamsError = null
}: {
  customers: PipelineOpportunity[];
  showConsultant?: boolean;
  mode?: "admin" | "partner" | "manager" | "group_leader" | "consultant";
  basePath?: "/admin" | "/partner" | "/manager" | "/consultant";
  qualiphyExams?: QualiphyExam[];
  qualiphyExamsError?: string | null;
}) {
  const [editing, setEditing] = useState<PipelineOpportunity | null>(null);
  const [modalTab, setModalTab] = useState<"notes" | "clinical" | "orders">("orders");
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [pendingMove, setPendingMove] = useState<{ opportunity: PipelineOpportunity; stage: CustomerPipelineStage } | null>(null);
  const [stagePicker, setStagePicker] = useState<PipelineOpportunity | null>(null);
  const [filters, setFilters] = useState<PipelineFilters>({
    query: "",
    stage: "ALL",
    paymentStatus: "ALL",
    tracking: "ALL",
    dateRange: "ALL"
  });
  const [, startTransition] = useTransition();
  const canManageStages = mode === "admin";
  const canManageInternalDocs = mode === "admin";
  const activeFilterCount = activePipelineFilterCount(filters);
  const paymentStatuses = useMemo(
    () => Array.from(new Set(customers.map((opportunity) => opportunity.paymentStatus).filter(Boolean))).sort(),
    [customers]
  );
  const filteredCustomers = useMemo(
    () => customers.filter((opportunity) => matchesPipelineFilters(opportunity, filters)),
    [customers, filters]
  );

  function submitStageMove(opportunity: PipelineOpportunity, stage: CustomerPipelineStage, extra?: Record<string, string>) {
    const formData = new FormData();
    formData.set("orderId", opportunity.id);
    formData.set("orderPipelineStage", stage);
    Object.entries(extra ?? {}).forEach(([key, value]) => formData.set(key, value));
    startTransition(() => {
      updatePipelineOrderStage(formData);
    });
  }

  function requestStageMove(opportunity: PipelineOpportunity, stage: CustomerPipelineStage) {
    if (!canManageStages || opportunity.pipelineStage === stage) return;

    const needsConfirmation =
      stage === "GFE" ||
      (stage === "DEFERRED" && opportunity.paymentStatus === "CAPTURED") ||
      (stage === "FULFILLMENT" || stage === "SHIPPED");

    if (needsConfirmation) {
      setPendingMove({ opportunity, stage });
      return;
    }

    submitStageMove(opportunity, stage);
  }

  const opportunitiesByStage = useMemo(() => {
    const map = new Map<CustomerPipelineStage, PipelineOpportunity[]>();
    CUSTOMER_PIPELINE_STAGES.forEach((stage) => map.set(stage.value, []));
    filteredCustomers.forEach((opportunity) => {
      const bucket = map.get(opportunity.pipelineStage) ?? map.get("AWAITING_PAYMENT");
      bucket?.push(opportunity);
    });
    return map;
  }, [filteredCustomers]);

  return (
    <>
      <PipelineFilterBar
        filters={filters}
        onChange={setFilters}
        paymentStatuses={paymentStatuses}
        activeFilterCount={activeFilterCount}
        visibleCount={filteredCustomers.length}
        totalCount={customers.length}
      />

      <div className="snap-x snap-mandatory overflow-x-auto rounded-[2rem] border border-border bg-white/35 p-3 pb-5 shadow-line">
        <div className="flex w-max min-w-full gap-3 sm:gap-4">
          {CUSTOMER_PIPELINE_STAGES.map((stage, index) => {
            const stageOpportunities = opportunitiesByStage.get(stage.value) ?? [];
            const stageValueCents = stageOpportunities.reduce((sum, opportunity) => sum + opportunity.opportunityValueCents, 0);
            const stageRevenueCents = stageOpportunities.reduce((sum, opportunity) => sum + opportunity.orderTotalCents, 0);

            return (
              <section
                key={stage.value}
                className="w-[min(86vw,22rem)] shrink-0 snap-start sm:w-[360px]"
                onDragOver={(event) => {
                  if (canManageStages) event.preventDefault();
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  const opportunity = customers.find((item) => item.id === draggedId);
                  if (opportunity) requestStageMove(opportunity, stage.value);
                  setDraggedId(null);
                }}
              >
                <div className={`rounded-2xl border border-border px-4 py-3 shadow-sm ${stageStyles[index % stageStyles.length]}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-semibold text-clinic-ink">{stage.label}</h3>
                      <div className="mt-2 flex items-center gap-3 text-sm text-slate-600">
                        <span>{stageOpportunities.length} Opportunities</span>
                        <span className="font-semibold text-clinic-ink">{formatCurrency(stageValueCents)}</span>
                      </div>
                      {mode === "admin" ? (
                        <p className="mt-1 text-xs font-semibold text-slate-500">Revenue {formatCurrency(stageRevenueCents)}</p>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="mt-4 max-h-[calc(100vh-18rem)] space-y-3 overflow-y-auto pr-2">
                  {stageOpportunities.map((opportunity) => (
                    <article
                      key={opportunity.id}
                      draggable={canManageStages}
                      onDragStart={() => setDraggedId(opportunity.id)}
                      onDragEnd={() => setDraggedId(null)}
                      role="button"
                      tabIndex={0}
                      onClick={(event) => {
                        if (isInteractiveTarget(event.target)) return;
                        setModalTab("orders");
                        setEditing(opportunity);
                      }}
                      onKeyDown={(event) => {
                        if (event.key !== "Enter" && event.key !== " ") return;
                        event.preventDefault();
                        setModalTab("orders");
                        setEditing(opportunity);
                      }}
                      className="cursor-pointer select-none rounded-2xl border border-border bg-white p-3 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg focus:outline-none focus:ring-4 focus:ring-blue-100"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <button
                            type="button"
                            onClick={() => {
                              setModalTab("orders");
                              setEditing(opportunity);
                            }}
                            className="block max-w-full truncate text-left text-base font-semibold text-clinic-ink transition hover:text-clinic-red"
                          >
                            {opportunity.name}
                          </button>
                          <p className="mt-0.5 truncate text-xs font-semibold text-slate-400">Order #{shortOrderId(opportunity.id)}</p>
                          {showConsultant && opportunity.consultantName ? (
                            <p className="mt-1 truncate text-xs font-semibold uppercase tracking-[0.14em] text-clinic-red">
                              {opportunity.consultantName}
                            </p>
                          ) : null}
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          {canManageStages ? <GripVertical className="size-4 text-slate-300" /> : null}
                          <div className="relative flex h-10 w-10 overflow-hidden rounded-full border border-slate-300 bg-[#dce8ff] text-sm font-semibold text-clinic-navy">
                            {opportunity.consultantAvatarUrl ? (
                              <Image
                                src={opportunity.consultantAvatarUrl}
                                alt={opportunity.consultantName ?? "Agent"}
                                fill
                                sizes="40px"
                                className="object-cover"
                              />
                            ) : (
                              <span className="m-auto">{initials(opportunity.consultantName, opportunity.email)}</span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <div className="rounded-2xl bg-clinic-mist px-3 py-3">
                          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">
                            {mode === "admin" ? "Revenue" : "Value"}
                          </p>
                          <p className="mt-1 text-lg font-semibold text-clinic-navy">{formatCurrency(opportunity.orderTotalCents)}</p>
                        </div>
                        <div className="rounded-2xl bg-emerald-50 px-3 py-3">
                          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-emerald-700">
                            {mode === "admin" ? "Margin" : "Earning"}
                          </p>
                          <p className="mt-1 text-lg font-semibold text-emerald-700">{formatCurrency(opportunity.opportunityValueCents)}</p>
                        </div>
                      </div>

                      <div className="mt-3 space-y-1 text-xs text-slate-500">
                        <p className="truncate" title={opportunity.email}>{opportunity.email}</p>
                        <p>{opportunity.phone || "No phone"}</p>
                        <p className="font-semibold text-clinic-ink">DOB {formatBirthDate(opportunity.dateOfBirth)}</p>
                        <div className="flex items-start gap-1.5 rounded-xl bg-clinic-mist px-2.5 py-2 text-slate-600">
                          <MapPin className="mt-0.5 size-3.5 shrink-0 text-clinic-navy" />
                          <p className="line-clamp-2" title={opportunity.shippingAddress ?? undefined}>
                            {opportunity.shippingAddress ?? "No shipping address"}
                          </p>
                        </div>
                        {opportunity.shippingTrackingCode ? (
                          <TrackingLink carrier={opportunity.shippingCarrier} trackingCode={opportunity.shippingTrackingCode} compact />
                        ) : null}
                        <p>{formatDate(opportunity.pipelineUpdatedAt ?? opportunity.createdAt)}</p>
                      </div>

                      {canManageStages ? (
                        <div className="mt-3 grid grid-cols-2 gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setStagePicker(opportunity)}
                            className="w-full"
                          >
                            <PackageCheck className="size-4" />
                            Move
                          </Button>
                          {opportunity.paymentStatus === "PENDING" ? (
                            <form action={deleteUnpaidOrder}>
                              <input type="hidden" name="orderId" value={opportunity.id} />
                              <SubmitButton
                                variant="outline"
                                size="sm"
                                pendingText="Deleting..."
                                className="w-full border-red-100 text-red-700 hover:bg-red-50"
                              >
                                <Trash2 className="size-4" />
                                Delete
                              </SubmitButton>
                            </form>
                          ) : (
                            <div />
                          )}
                        </div>
                      ) : null}
                    </article>
                  ))}

                  {stageOpportunities.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-border bg-white p-5 text-center text-xs text-slate-500">
                      No opportunities in this stage.
                    </div>
                  ) : null}
                </div>
              </section>
            );
          })}
        </div>
      </div>

      {editing ? (
        <OpportunityModal
          opportunity={editing}
          canManageInternalDocs={canManageInternalDocs}
          initialTab={modalTab}
          basePath={basePath}
          onClose={() => setEditing(null)}
        />
      ) : null}

      {pendingMove ? (
        <StageMoveModal
          opportunity={pendingMove.opportunity}
          stage={pendingMove.stage}
          qualiphyExams={qualiphyExams}
          qualiphyExamsError={qualiphyExamsError}
          onClose={() => setPendingMove(null)}
        />
      ) : null}

      {stagePicker ? (
        <StagePickerModal
          opportunity={stagePicker}
          onClose={() => setStagePicker(null)}
          onMove={(stage) => {
            setStagePicker(null);
            requestStageMove(stagePicker, stage);
          }}
        />
      ) : null}
    </>
  );
}

function OpportunityModal({
  opportunity,
  canManageInternalDocs,
  initialTab,
  basePath,
  onClose
}: {
  opportunity: PipelineOpportunity;
  canManageInternalDocs: boolean;
  initialTab: "notes" | "clinical" | "orders";
  basePath: "/admin" | "/partner" | "/manager" | "/consultant";
  onClose: () => void;
}) {
  const [tab, setTab] = useState<"notes" | "clinical" | "orders">(initialTab);
  const [newNote, setNewNote] = useState("");
  const notes = noteEntries(opportunity.notes);

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-slate-950/35 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-t-[2rem] border border-border bg-white shadow-2xl sm:rounded-[2rem]">
        <div className="flex items-start justify-between gap-4 border-b border-border p-4 sm:p-6">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-clinic-red">Opportunity</p>
            <h3 className="mt-2 text-xl font-semibold text-clinic-ink sm:text-2xl">{opportunity.name}</h3>
            <p className="mt-1 text-sm text-slate-500">
              Order #{shortOrderId(opportunity.id)} · {orderPipelineLabel(opportunity.pipelineStage)} · {formatCurrency(opportunity.orderTotalCents)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid size-10 place-items-center rounded-full border border-border text-slate-500 transition hover:bg-clinic-mist"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="grid min-h-0 flex-1 md:grid-cols-[220px_1fr]">
          <aside className="grid grid-cols-3 gap-2 border-b border-border bg-clinic-mist p-3 md:block md:border-b-0 md:border-r md:p-4">
            <button
              type="button"
              onClick={() => setTab("orders")}
              className={`flex w-full items-center justify-center gap-2 rounded-2xl px-3 py-3 text-center text-sm font-semibold transition md:justify-start md:text-left ${
                tab === "orders" ? "bg-white text-clinic-navy shadow-line" : "text-slate-500 hover:bg-white/70"
              }`}
            >
              <ReceiptText className="size-4" />
              Orders
            </button>
            <button
              type="button"
              onClick={() => setTab("notes")}
              className={`flex w-full items-center justify-center gap-2 rounded-2xl px-3 py-3 text-center text-sm font-semibold transition md:mt-2 md:justify-start md:text-left ${
                tab === "notes" ? "bg-white text-clinic-navy shadow-line" : "text-slate-500 hover:bg-white/70"
              }`}
            >
              <NotebookPen className="size-4" />
              Notes
            </button>
            <button
              type="button"
              onClick={() => setTab("clinical")}
              className={`flex w-full items-center justify-center gap-2 rounded-2xl px-3 py-3 text-center text-sm font-semibold transition md:mt-2 md:justify-start md:text-left ${
                tab === "clinical" ? "bg-white text-clinic-navy shadow-line" : "text-slate-500 hover:bg-white/70"
              }`}
            >
              <Pill className="size-4" />
              RX / Exam
            </button>
          </aside>

          <div className="min-h-0 overflow-y-auto p-4 sm:p-6">
            {tab === "orders" ? (
              <div className="space-y-5">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Customer order history</p>
                  <h4 className="mt-2 text-2xl font-semibold text-clinic-ink">Purchases for {opportunity.name}</h4>
                  <p className="mt-2 text-sm text-slate-500">
                    Each purchase is tracked as its own opportunity. The highlighted row is the order for this card.
                  </p>
                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    <div className="rounded-2xl border border-border bg-clinic-mist px-4 py-3">
                      <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">Date of birth</p>
                      <p className="mt-1 font-semibold text-clinic-ink">{formatBirthDate(opportunity.dateOfBirth)}</p>
                    </div>
                    <div className="rounded-2xl border border-border bg-clinic-mist px-4 py-3 sm:col-span-2">
                      <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">Contact</p>
                      <p className="mt-1 truncate font-semibold text-clinic-ink" title={opportunity.email}>{opportunity.email}</p>
                      <p className="mt-1 text-sm text-slate-600">{opportunity.phone || "No phone"}</p>
                    </div>
                  </div>
                </div>

                <div className="rounded-3xl border border-clinic-blue bg-blue-50 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.16em] text-clinic-navy">This opportunity</p>
                      <p className="mt-1 text-lg font-semibold text-clinic-ink">Order #{shortOrderId(opportunity.id)}</p>
                      <p className="mt-1 text-sm text-slate-600">
                        {formatFullDate(opportunity.createdAt)} · {orderPipelineLabel(opportunity.pipelineStage)} · {opportunity.paymentStatus.replaceAll("_", " ")}
                      </p>
                      <div className="mt-3 flex items-start gap-2 rounded-2xl bg-white px-3 py-2 text-sm font-semibold text-clinic-navy shadow-line">
                        <MapPin className="mt-0.5 size-4 shrink-0 text-clinic-red" />
                        <p>{opportunity.shippingAddress ?? "No shipping address saved for this order"}</p>
                      </div>
                      <div className="mt-3">
                        <TrackingLink carrier={opportunity.shippingCarrier} trackingCode={opportunity.shippingTrackingCode} />
                      </div>
                      {canManageInternalDocs ? (
                        <div className="mt-3">
                          <OrderTrackingForm
                            orderId={opportunity.id}
                            shippingCarrier={opportunity.shippingCarrier}
                            shippingTrackingCode={opportunity.shippingTrackingCode}
                            compact
                          />
                        </div>
                      ) : null}
                    </div>
                    <Link
                      href={`${basePath}/orders/${opportunity.id}`}
                      className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-clinic-navy px-4 text-sm font-semibold text-white transition hover:bg-clinic-blue"
                    >
                      <FileText className="size-4" />
                      Open order
                    </Link>
                  </div>
                </div>

                <div className="space-y-3">
                  {opportunity.orderHistory.map((order) => {
                    const isCurrent = order.id === opportunity.id;
                    return (
                      <div
                        key={order.id}
                        className={`rounded-2xl border p-4 shadow-line ${
                          isCurrent ? "border-clinic-blue bg-blue-50" : "border-border bg-white"
                        }`}
                      >
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-semibold text-clinic-ink">Order #{shortOrderId(order.id)}</p>
                              {isCurrent ? (
                                <span className="rounded-full bg-clinic-navy px-3 py-1 text-xs font-bold text-white">This opportunity</span>
                              ) : null}
                              <span className="rounded-full border border-border bg-white px-3 py-1 text-xs font-bold text-clinic-navy">
                                {orderPipelineLabel(order.pipelineStage)}
                              </span>
                            </div>
                            <p className="mt-2 text-sm text-slate-500">{formatFullDate(order.createdAt)}</p>
                            <p className="mt-1 text-sm font-semibold text-clinic-ink">DOB {formatBirthDate(order.customerDateOfBirth)}</p>
                            <p className="mt-2 truncate text-sm text-slate-600" title={order.products}>{order.products || "No products listed"}</p>
                            <div className="mt-3 flex items-start gap-2 rounded-2xl bg-clinic-mist px-3 py-2 text-sm font-semibold text-slate-600">
                              <MapPin className="mt-0.5 size-4 shrink-0 text-clinic-navy" />
                              <p>{order.shippingAddress ?? "No shipping address saved"}</p>
                            </div>
                            <div className="mt-3">
                              <TrackingLink carrier={order.shippingCarrier} trackingCode={order.shippingTrackingCode} />
                            </div>
                          </div>
                          <div className="grid shrink-0 grid-cols-2 gap-2 sm:min-w-64">
                            <div className="rounded-2xl bg-clinic-mist px-3 py-2">
                              <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">Total</p>
                              <p className="mt-1 font-semibold text-clinic-navy">{formatCurrency(order.orderTotalCents)}</p>
                            </div>
                            <div className="rounded-2xl bg-emerald-50 px-3 py-2">
                              <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-emerald-700">Value</p>
                              <p className="mt-1 font-semibold text-emerald-700">{formatCurrency(order.opportunityValueCents)}</p>
                            </div>
                          </div>
                        </div>
                        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-500">
                          <span>{order.paymentStatus.replaceAll("_", " ")}</span>
                          <span>·</span>
                          <span>{order.orderStatus.replaceAll("_", " ")}</span>
                          {!isCurrent ? (
                            <>
                              <span>·</span>
                              <Link href={`${basePath}/orders/${order.id}`} className="text-clinic-red transition hover:text-clinic-navy">
                                Open order
                              </Link>
                            </>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : tab === "notes" ? (
              <form action={updateOrderOpportunityDetails} className="space-y-5">
                <input type="hidden" name="orderId" value={opportunity.id} />
                <input type="hidden" name="orderNotes" value={buildNoteHistory(opportunity.notes, newNote)} />
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Notes timeline</p>
                  <h4 className="mt-2 text-2xl font-semibold text-clinic-ink">Internal notes</h4>
                </div>
                <div className="space-y-3">
                  {notes.length ? (
                    notes.map((note, index) => (
                      <div key={`${opportunity.id}-note-${index}`} className="rounded-2xl border border-border bg-white p-4 shadow-line">
                        <p className="whitespace-pre-line text-sm leading-6 text-slate-600">{note}</p>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-2xl border border-dashed border-border bg-clinic-mist p-5 text-sm text-slate-500">
                      No notes yet. Add the first call note or follow-up detail below.
                    </div>
                  )}
                </div>
                <label className="block">
                  <span className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Add note</span>
                  <textarea
                    value={newNote}
                    onChange={(event) => setNewNote(event.target.value)}
                    placeholder="Type a new note. Existing notes will stay saved."
                    className="mt-2 min-h-32 w-full rounded-2xl border border-border bg-white px-4 py-3 text-sm outline-none transition focus:border-clinic-blue focus:ring-4 focus:ring-blue-100"
                  />
                </label>
                <div className="flex flex-col-reverse gap-3 border-t border-border pt-4 sm:flex-row sm:justify-end">
                  <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
                  <SubmitButton pendingText="Saving..." variant="accent">Save notes</SubmitButton>
                </div>
              </form>
            ) : (
              <div className="space-y-5">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Clinical workflow</p>
                  <h4 className="mt-2 text-2xl font-semibold text-clinic-ink">RX / Exam documents</h4>
                  {!canManageInternalDocs ? (
                    <p className="mt-2 text-sm text-slate-500">Clinical document details are managed by Go Virtual Health.</p>
                  ) : null}
                </div>

                {canManageInternalDocs ? (
                  <div className="grid gap-5">
                    <div className="rounded-3xl border border-border bg-clinic-mist p-4">
                      <div className="flex items-start gap-3">
                        <div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-white text-clinic-navy shadow-line">
                          <FileUp className="size-5" />
                        </div>
                        <div>
                          <p className="text-lg font-semibold text-clinic-ink">Upload clinical document</p>
                          <p className="mt-1 text-sm leading-6 text-slate-500">Add RX or Exam files to this customer record and attach them to this opportunity.</p>
                        </div>
                      </div>
                    </div>

                    <UploadClinicalDocumentForm orderId={opportunity.id} />

                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Customer document history</p>
                      <div className="mt-3 space-y-3">
                        {opportunity.clinicalDocuments.length ? (
                          opportunity.clinicalDocuments.map((document) => (
                            <div key={document.id} className="rounded-2xl border border-border bg-white p-4 shadow-line">
                              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                <div className="min-w-0">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="rounded-full border border-border bg-clinic-mist px-3 py-1 text-xs font-bold text-clinic-navy">
                                      {documentLabel(document.type)}
                                    </span>
                                    <p className="truncate text-base font-semibold text-clinic-ink">{document.title}</p>
                                  </div>
                                  <p className="mt-2 truncate text-sm text-slate-500">{document.fileName}</p>
                                  <p className="mt-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                                    {formatFullDate(document.createdAt)} · {fileSizeLabel(document.sizeBytes)}
                                  </p>
                                  {document.notes ? <p className="mt-2 text-sm leading-6 text-slate-600">{document.notes}</p> : null}
                                </div>
                                <div className="flex shrink-0 flex-wrap items-center gap-2">
                                  <a
                                    href={`/api/customer-documents/${document.id}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-border px-4 text-sm font-semibold text-clinic-navy transition hover:bg-clinic-mist"
                                  >
                                    <ExternalLink className="size-4" />
                                    Open
                                  </a>
                                  <a
                                    href={`/api/customer-documents/${document.id}?download=1`}
                                    className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-border bg-clinic-mist px-4 text-sm font-semibold text-clinic-navy transition hover:bg-white"
                                  >
                                    <Download className="size-4" />
                                    Download
                                  </a>
                                  <form action={deleteOrderClinicalDocument}>
                                    <input type="hidden" name="documentId" value={document.id} />
                                    <SubmitButton
                                      variant="outline"
                                      size="sm"
                                      pendingText="Deleting..."
                                      className="h-10 border-red-100 px-3 text-red-700 hover:bg-red-50"
                                    >
                                      <Trash2 className="size-4" />
                                      Delete
                                    </SubmitButton>
                                  </form>
                                </div>
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="rounded-2xl border border-dashed border-border bg-clinic-mist p-5 text-sm text-slate-500">
                            No RX or Exam documents yet. Upload the first document above.
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-border bg-clinic-mist p-5 text-sm text-slate-500">
                    RX and Exam documents are hidden from this role.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function UploadClinicalDocumentForm({ orderId }: { orderId: string }) {
  return (
    <form action={uploadOrderClinicalDocument} className="rounded-3xl border border-border bg-white p-4 shadow-line">
      <input type="hidden" name="orderId" value={orderId} />
      <div className="grid gap-3 sm:grid-cols-[150px_1fr]">
        <label className="block">
          <span className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Type</span>
          <select
            name="documentType"
            className="mt-2 h-12 w-full rounded-2xl border border-border bg-white px-4 text-sm font-semibold text-clinic-ink outline-none transition focus:border-clinic-blue focus:ring-4 focus:ring-blue-100"
            defaultValue="GFE"
          >
            <option value="GFE">Exam</option>
            <option value="RX">RX</option>
          </select>
        </label>
        <label className="block">
          <span className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Document name</span>
          <input
            name="documentTitle"
            placeholder="Example: Initial Exam, Semaglutide RX"
            className="mt-2 h-12 w-full rounded-2xl border border-border bg-white px-4 text-sm outline-none transition focus:border-clinic-blue focus:ring-4 focus:ring-blue-100"
          />
        </label>
      </div>
      <label className="mt-3 block">
        <span className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Notes</span>
        <textarea
          name="documentNotes"
          placeholder="Internal clinical context for this document..."
          className="mt-2 min-h-20 w-full rounded-2xl border border-border bg-white px-4 py-3 text-sm outline-none transition focus:border-clinic-blue focus:ring-4 focus:ring-blue-100"
        />
      </label>
      <label className="mt-3 block rounded-2xl border border-dashed border-border bg-clinic-mist p-4">
        <span className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Upload file</span>
        <input
          name="documentFile"
          type="file"
          accept="application/pdf,image/jpeg,image/png,image/webp"
          className="mt-2 block w-full text-sm text-slate-600 file:mr-4 file:rounded-xl file:border-0 file:bg-clinic-navy file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white"
        />
        <span className="mt-2 block text-xs text-slate-500">PDF, JPG, PNG, or WebP. Max 15 MB.</span>
      </label>
      <div className="mt-4 flex justify-end">
        <SubmitButton pendingText="Uploading..." variant="accent">
          <FileUp className="size-4" />
          Upload document
        </SubmitButton>
      </div>
    </form>
  );
}

function StagePickerModal({
  opportunity,
  onClose,
  onMove
}: {
  opportunity: PipelineOpportunity;
  onClose: () => void;
  onMove: (stage: CustomerPipelineStage) => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end bg-slate-950/35 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <div className="w-full max-w-lg overflow-hidden rounded-t-[2rem] border border-border bg-white shadow-2xl sm:rounded-[2rem]">
        <div className="flex items-start justify-between gap-4 border-b border-border p-4 sm:p-6">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-clinic-red">Move opportunity</p>
            <h3 className="mt-2 text-xl font-semibold text-clinic-ink sm:text-2xl">{opportunity.name}</h3>
            <p className="mt-1 text-sm text-slate-500">Choose the next step for this order record.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid size-10 place-items-center rounded-full border border-border text-slate-500 transition hover:bg-clinic-mist"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="grid gap-2 p-4">
          {CUSTOMER_PIPELINE_STAGES.map((stage) => {
            const active = stage.value === opportunity.pipelineStage;
            return (
              <button
                key={stage.value}
                type="button"
                disabled={active}
                onClick={() => onMove(stage.value)}
                className={`flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left transition ${
                  active
                    ? "border-clinic-blue bg-blue-50 text-clinic-navy"
                    : "border-border bg-white text-clinic-ink hover:-translate-y-0.5 hover:bg-clinic-mist hover:shadow-line"
                }`}
              >
                <span>
                  <span className="block text-sm font-semibold">{stage.label}</span>
                  <span className="mt-0.5 block text-xs text-slate-500">{active ? "Current stage" : "Move to this stage"}</span>
                </span>
                <PackageCheck className={`size-4 ${active ? "text-clinic-blue" : "text-slate-400"}`} />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function StageMoveModal({
  opportunity,
  stage,
  qualiphyExams,
  qualiphyExamsError,
  onClose
}: {
  opportunity: PipelineOpportunity;
  stage: CustomerPipelineStage;
  qualiphyExams: QualiphyExam[];
  qualiphyExamsError: string | null;
  onClose: () => void;
}) {
  const stageLabel = CUSTOMER_PIPELINE_STAGES.find((item) => item.value === stage)?.label ?? stage;
  const needsRefund = stage === "DEFERRED" && opportunity.paymentStatus === "CAPTURED";
  const needsTracking = stage === "FULFILLMENT" || stage === "SHIPPED";
  const showsQualiphyChoice = stage === "GFE";
  const [qualiphyMode, setQualiphyMode] = useState<"skip" | "send">("skip");
  const [selectedExamId, setSelectedExamId] = useState("");
  const [examSearch, setExamSearch] = useState("");
  const selectedExam = qualiphyExams.find((exam) => exam.id.toString() === selectedExamId) ?? null;
  const filteredExams = useMemo(() => {
    const query = examSearch.trim().toLowerCase();
    if (!query) return qualiphyExams.slice(0, 20);
    return qualiphyExams
      .filter((exam) => `${exam.title} ${exam.id}`.toLowerCase().includes(query))
      .slice(0, 30);
  }, [examSearch, qualiphyExams]);

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-slate-950/35 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <form action={updatePipelineOrderStage} className="w-full max-w-xl overflow-hidden rounded-t-[2rem] border border-border bg-white shadow-2xl sm:rounded-[2rem]">
        <input type="hidden" name="orderId" value={opportunity.id} />
        <input type="hidden" name="orderPipelineStage" value={stage} />
        <div className="flex items-start justify-between gap-4 border-b border-border p-4 sm:p-6">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-clinic-red">Move opportunity</p>
            <h3 className="mt-2 text-xl font-semibold text-clinic-ink sm:text-2xl">{stageLabel}</h3>
            <p className="mt-1 text-sm text-slate-500">{opportunity.name}</p>
          </div>
          <button type="button" onClick={onClose} className="grid size-10 place-items-center rounded-full border border-border text-slate-500 transition hover:bg-clinic-mist">
            <X className="size-5" />
          </button>
        </div>

        <div className="max-h-[60vh] space-y-4 overflow-y-auto p-4 sm:p-6">
          {needsRefund ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
              <p className="text-sm font-semibold text-red-700">This captured payment must be refunded before moving to Deferred.</p>
              <p className="mt-1 text-xs leading-5 text-red-600">Type <span className="font-bold">refunded</span> to confirm the refund action.</p>
              <input
                name="refundConfirmation"
                placeholder="Type refunded"
                className="mt-3 h-11 w-full rounded-xl border border-red-200 bg-white px-3 text-sm font-semibold outline-none transition focus:border-red-400 focus:ring-4 focus:ring-red-100"
              />
            </div>
          ) : null}

          {needsTracking ? (
            <div className="rounded-2xl border border-border bg-clinic-mist p-4">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-clinic-navy">Shipping tracking</p>
              <p className="mt-1 text-xs leading-5 text-slate-500">Add tracking if available. If skipped, the tracking webhook will not be sent.</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <select name="shippingCarrier" className="h-11 rounded-xl border border-border bg-white px-3 text-sm font-semibold text-clinic-ink outline-none transition focus:border-clinic-blue focus:ring-4 focus:ring-blue-100" defaultValue={opportunity.shippingCarrier ?? ""}>
                  <option value="">Select carrier</option>
                  {SHIPPING_CARRIERS.map((carrier) => (
                    <option key={carrier.value} value={carrier.value}>
                      {carrier.label}
                    </option>
                  ))}
                </select>
                <input
                  name="shippingTrackingCode"
                  defaultValue={opportunity.shippingTrackingCode ?? ""}
                  placeholder="Tracking code"
                  className="h-11 rounded-xl border border-border bg-white px-3 text-sm font-semibold outline-none transition focus:border-clinic-blue focus:ring-4 focus:ring-blue-100"
                />
              </div>
              <label className="mt-3 flex items-start gap-2 text-xs leading-5 text-slate-600">
                <input type="checkbox" name="allowFulfillmentWithoutTracking" value="true" className="mt-1" />
                Move without tracking for now
              </label>
            </div>
          ) : null}

          {showsQualiphyChoice ? (
            <div className="rounded-3xl border border-border bg-white p-4 shadow-line">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-clinic-navy">Qualiphy Exam</p>
                  <h4 className="mt-1 text-lg font-semibold text-clinic-ink">Choose how to handle this exam</h4>
                  <p className="mt-1 text-sm leading-6 text-slate-500">
                    Select an exam type before moving this opportunity into the Exam stage, or keep it internal without sending to Qualiphy.
                  </p>
                </div>
                <span className="w-fit rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-bold text-clinic-navy">
                  {qualiphyExams.length} exams
                </span>
              </div>

              {qualiphyExamsError ? (
                <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                  Qualiphy exams could not be loaded: {qualiphyExamsError}
                </div>
              ) : null}

              <div className="mt-4 grid gap-3">
                <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-border bg-clinic-mist p-4 transition hover:bg-blue-50">
                  <input
                    type="radio"
                    name="qualiphyExamMode"
                    value="skip"
                    checked={qualiphyMode === "skip"}
                    onChange={() => setQualiphyMode("skip")}
                    className="mt-1"
                  />
                  <span>
                    <span className="block text-sm font-semibold text-clinic-ink">Do not send to Qualiphy</span>
                    <span className="mt-1 block text-xs leading-5 text-slate-500">Move to Exam and manage the clinical workflow inside this portal.</span>
                  </span>
                </label>

                <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-border bg-clinic-mist p-4 transition hover:bg-blue-50">
                  <input
                    type="radio"
                    name="qualiphyExamMode"
                    value="send"
                    checked={qualiphyMode === "send"}
                    disabled={!qualiphyExams.length}
                    onChange={() => setQualiphyMode("send")}
                    className="mt-1"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-clinic-ink">Send to Qualiphy</span>
                    <span className="mt-1 block text-xs leading-5 text-slate-500">Choose the exam template that should be used for this customer.</span>
                  </span>
                </label>

                {qualiphyMode === "send" ? (
                  <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
                    <input type="hidden" name="qualiphyExamId" value={selectedExamId} />
                    <label className="block">
                      <span className="text-xs font-bold uppercase tracking-[0.14em] text-clinic-navy">Find exam</span>
                      <input
                        value={examSearch}
                        onChange={(event) => setExamSearch(event.target.value)}
                        placeholder="Search by exam name or ID"
                        className="mt-2 h-12 w-full rounded-2xl border border-border bg-white px-4 text-sm font-semibold text-clinic-ink outline-none transition placeholder:text-slate-400 focus:border-clinic-blue focus:ring-4 focus:ring-blue-100"
                      />
                    </label>

                    {selectedExam ? (
                      <div className="mt-3 rounded-2xl border border-clinic-blue bg-white p-3">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0">
                            <p className="text-xs font-bold uppercase tracking-[0.14em] text-clinic-navy">Selected exam</p>
                            <p className="mt-1 text-sm font-semibold leading-5 text-clinic-ink">{selectedExam.title}</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => setSelectedExamId("")}
                            className="h-9 rounded-xl border border-border px-3 text-xs font-semibold text-slate-600 transition hover:bg-clinic-mist"
                          >
                            Change
                          </button>
                        </div>
                        <div className="mt-3 grid gap-2 text-xs text-slate-600 sm:grid-cols-3">
                          <div className="rounded-xl bg-clinic-mist px-3 py-2">
                            <p className="font-bold uppercase tracking-[0.12em] text-slate-400">Exam ID</p>
                            <p className="mt-1 font-semibold text-clinic-ink">{selectedExam.id}</p>
                          </div>
                          <div className="rounded-xl bg-clinic-mist px-3 py-2">
                            <p className="font-bold uppercase tracking-[0.12em] text-slate-400">Type</p>
                            <p className="mt-1 font-semibold text-clinic-ink">{selectedExam.rxType === 2 ? "RX" : "Exam"}</p>
                          </div>
                          <div className="rounded-xl bg-clinic-mist px-3 py-2">
                            <p className="font-bold uppercase tracking-[0.12em] text-slate-400">Attachments</p>
                            <p className="mt-1 font-semibold text-clinic-ink">{selectedExam.attachmentsRequired ?? "N/A"}</p>
                          </div>
                        </div>
                      </div>
                    ) : null}

                    <div className="mt-3 max-h-64 overflow-y-auto rounded-2xl border border-border bg-white p-2">
                      {filteredExams.length ? (
                        filteredExams.map((exam) => (
                          <button
                            key={exam.id}
                            type="button"
                            onClick={() => {
                              setSelectedExamId(exam.id.toString());
                              setExamSearch(exam.title);
                            }}
                            className="flex w-full items-start justify-between gap-3 rounded-xl px-3 py-3 text-left transition hover:bg-clinic-mist focus:bg-blue-50 focus:outline-none"
                          >
                            <span className="min-w-0">
                              <span className="block text-sm font-semibold leading-5 text-clinic-ink">{exam.title}</span>
                              <span className="mt-1 block text-xs text-slate-500">
                                ID {exam.id} · {exam.rxType === 2 ? "RX" : "Exam"} · {exam.attachmentsRequired ?? "N/A"} attachment(s)
                              </span>
                            </span>
                            {selectedExamId === exam.id.toString() ? (
                              <span className="shrink-0 rounded-full bg-clinic-navy px-2.5 py-1 text-xs font-bold text-white">Selected</span>
                            ) : null}
                          </button>
                        ))
                      ) : (
                        <div className="p-4 text-sm text-slate-500">No Qualiphy exams match that search.</div>
                      )}
                    </div>

                    <p className="mt-2 text-xs leading-5 text-slate-500">
                      Showing {filteredExams.length} of {qualiphyExams.length}. Use search to narrow the list.
                    </p>
                  </div>
                ) : null}
              </div>

              <input type="hidden" name="qualiphyExamTitle" value={selectedExam?.title ?? ""} />
              <input type="hidden" name="qualiphyExamRxType" value={selectedExam?.rxType?.toString() ?? ""} />
              <input type="hidden" name="qualiphyExamAttachmentsRequired" value={selectedExam?.attachmentsRequired?.toString() ?? ""} />
            </div>
          ) : null}
        </div>

        <div className="flex flex-col-reverse gap-3 border-t border-border p-4 sm:flex-row sm:justify-end sm:p-6">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <SubmitButton pendingText="Moving..." variant="accent">
            <PackageCheck className="size-4" />
            Move to {stageLabel}
          </SubmitButton>
        </div>
      </form>
    </div>
  );
}
