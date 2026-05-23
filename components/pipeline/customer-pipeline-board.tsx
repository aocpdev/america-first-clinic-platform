"use client";

import { useMemo, useState, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import { ExternalLink, FileText, FileUp, GripVertical, NotebookPen, PackageCheck, Pill, Trash2, X } from "lucide-react";
import {
  deleteOrderClinicalDocument,
  deleteUnpaidOrder,
  updateOrderOpportunityDetails,
  updatePipelineOrderStage,
  uploadOrderClinicalDocument
} from "@/app/pipeline/actions";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import { CUSTOMER_PIPELINE_STAGES, type CustomerPipelineStage } from "@/lib/sales/pipeline";
import { formatCurrency } from "@/lib/products/catalog";

type PipelineOpportunity = {
  id: string;
  customerId: string;
  name: string;
  email: string;
  phone: string | null;
  consultantName: string | null;
  consultantAvatarUrl: string | null;
  pipelineStage: CustomerPipelineStage;
  pipelineUpdatedAt: string | null;
  orderTotalCents: number;
  opportunityValueCents: number;
  adminMarginCents: number;
  createdAt: string | null;
  notes: string | null;
  rxNotes: string | null;
  rxDocumentUrl: string | null;
  gfeNotes: string | null;
  gfeDocumentUrl: string | null;
  paymentStatus: string;
  clinicalDocuments: CustomerClinicalDocument[];
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

const stageStyles = [
  "bg-[#edf4ff]",
  "bg-[#d8f3ee]",
  "bg-[#e8eef6]",
  "bg-[#eef2ff]",
  "bg-[#fff1f2]",
  "bg-[#f7f7fb]",
  "bg-[#e8f8ee]"
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
  return type === "RX" ? "RX" : "GFE";
}

export function CustomerPipelineBoard({
  customers,
  showConsultant,
  mode = "admin",
  basePath = "/admin"
}: {
  customers: PipelineOpportunity[];
  showConsultant?: boolean;
  mode?: "admin" | "partner" | "group_leader" | "consultant";
  basePath?: "/admin" | "/partner" | "/consultant";
}) {
  const [editing, setEditing] = useState<PipelineOpportunity | null>(null);
  const [modalTab, setModalTab] = useState<"notes" | "clinical">("notes");
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [pendingMove, setPendingMove] = useState<{ opportunity: PipelineOpportunity; stage: CustomerPipelineStage } | null>(null);
  const [stagePicker, setStagePicker] = useState<PipelineOpportunity | null>(null);
  const [, startTransition] = useTransition();
  const canManageStages = mode === "admin";
  const canManageInternalDocs = mode === "admin";

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
      (stage === "DEFERRED" && opportunity.paymentStatus === "CAPTURED") ||
      (stage === "FULFILLMENT" || stage === "SHIPPED") ||
      (stage === "GFE" && !opportunity.clinicalDocuments.some((document) => document.type === "GFE")) ||
      (stage === "APPROVAL" && !opportunity.clinicalDocuments.some((document) => document.type === "RX" || document.type === "GFE"));

    if (needsConfirmation) {
      setPendingMove({ opportunity, stage });
      return;
    }

    submitStageMove(opportunity, stage);
  }

  const opportunitiesByStage = useMemo(() => {
    const map = new Map<CustomerPipelineStage, PipelineOpportunity[]>();
    CUSTOMER_PIPELINE_STAGES.forEach((stage) => map.set(stage.value, []));
    customers.forEach((opportunity) => {
      const bucket = map.get(opportunity.pipelineStage) ?? map.get("AWAITING_PAYMENT");
      bucket?.push(opportunity);
    });
    return map;
  }, [customers]);

  return (
    <>
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
                      className="select-none rounded-2xl border border-border bg-white p-3 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <Link
                            href={`${basePath}/orders/${opportunity.id}`}
                            className="block truncate text-base font-semibold text-clinic-ink transition hover:text-clinic-red"
                          >
                            {opportunity.name}
                          </Link>
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
                                alt={opportunity.consultantName ?? "Seller"}
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
                        <p>{formatDate(opportunity.pipelineUpdatedAt ?? opportunity.createdAt)}</p>
                      </div>

                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setModalTab("notes");
                            setEditing(opportunity);
                          }}
                        >
                          <NotebookPen className="size-4" />
                          Notes
                        </Button>
                        {canManageInternalDocs ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setModalTab("clinical");
                              setEditing(opportunity);
                            }}
                          >
                            <Pill className="size-4" />
                            RX / GFE
                          </Button>
                        ) : (
                          <Link
                            href={`${basePath}/orders/${opportunity.id}`}
                            className="inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-border px-3 text-sm font-semibold text-clinic-navy transition hover:bg-clinic-mist"
                          >
                            <FileText className="size-4" />
                            Order
                          </Link>
                        )}
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
          onClose={() => setEditing(null)}
        />
      ) : null}

      {pendingMove ? (
        <StageMoveModal
          opportunity={pendingMove.opportunity}
          stage={pendingMove.stage}
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
  onClose
}: {
  opportunity: PipelineOpportunity;
  canManageInternalDocs: boolean;
  initialTab: "notes" | "clinical";
  onClose: () => void;
}) {
  const [tab, setTab] = useState<"notes" | "clinical">(initialTab);
  const [newNote, setNewNote] = useState("");
  const notes = noteEntries(opportunity.notes);

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-slate-950/35 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-t-[2rem] border border-border bg-white shadow-2xl sm:rounded-[2rem]">
        <div className="flex items-start justify-between gap-4 border-b border-border p-4 sm:p-6">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-clinic-red">Opportunity</p>
            <h3 className="mt-2 text-xl font-semibold text-clinic-ink sm:text-2xl">{opportunity.name}</h3>
            <p className="mt-1 text-sm text-slate-500">Manage notes, GFE, and RX records for this order.</p>
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
          <aside className="grid grid-cols-2 gap-2 border-b border-border bg-clinic-mist p-3 md:block md:border-b-0 md:border-r md:p-4">
            <button
              type="button"
              onClick={() => setTab("notes")}
              className={`flex w-full items-center justify-center gap-2 rounded-2xl px-3 py-3 text-center text-sm font-semibold transition md:justify-start md:text-left ${
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
              RX / GFE
            </button>
          </aside>

          <div className="min-h-0 overflow-y-auto p-4 sm:p-6">
            {tab === "notes" ? (
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
                  <h4 className="mt-2 text-2xl font-semibold text-clinic-ink">RX / GFE documents</h4>
                  {!canManageInternalDocs ? (
                    <p className="mt-2 text-sm text-slate-500">Clinical document details are managed by the admin team.</p>
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
                          <p className="mt-1 text-sm leading-6 text-slate-500">Add RX or GFE files to this customer record and attach them to this opportunity.</p>
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
                                  {document.notes ? <p className="mt-2 text-sm leading-6 text-slate-600">{document.notes}</p> : null}
                                </div>
                                <div className="flex shrink-0 items-center gap-2">
                                  <a
                                    href={`/api/customer-documents/${document.id}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-border px-4 text-sm font-semibold text-clinic-navy transition hover:bg-clinic-mist"
                                  >
                                    <ExternalLink className="size-4" />
                                    View
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
                            No RX or GFE documents yet. Upload the first document above.
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-border bg-clinic-mist p-5 text-sm text-slate-500">
                    RX and GFE documents are hidden from this role.
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
            <option value="GFE">GFE</option>
            <option value="RX">RX</option>
          </select>
        </label>
        <label className="block">
          <span className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Document name</span>
          <input
            name="documentTitle"
            placeholder="Example: Initial GFE, Semaglutide RX"
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
  onClose
}: {
  opportunity: PipelineOpportunity;
  stage: CustomerPipelineStage;
  onClose: () => void;
}) {
  const stageLabel = CUSTOMER_PIPELINE_STAGES.find((item) => item.value === stage)?.label ?? stage;
  const needsRefund = stage === "DEFERRED" && opportunity.paymentStatus === "CAPTURED";
  const needsTracking = stage === "FULFILLMENT" || stage === "SHIPPED";
  const needsGfeConfirmation = stage === "GFE" && !opportunity.clinicalDocuments.some((document) => document.type === "GFE");
  const needsApprovalConfirmation =
    stage === "APPROVAL" && !opportunity.clinicalDocuments.some((document) => document.type === "RX" || document.type === "GFE");

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
                <select name="shippingCarrier" className="h-11 rounded-xl border border-border bg-white px-3 text-sm font-semibold text-clinic-ink outline-none transition focus:border-clinic-blue focus:ring-4 focus:ring-blue-100" defaultValue="">
                  <option value="">Select carrier</option>
                  <option value="fedex">FedEx</option>
                  <option value="ups">UPS</option>
                  <option value="usps">USPS</option>
                  <option value="dhl">DHL</option>
                </select>
                <input
                  name="shippingTrackingCode"
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

          {needsGfeConfirmation || needsApprovalConfirmation ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-sm font-semibold text-amber-800">
                {needsGfeConfirmation ? "No GFE document is attached yet." : "No RX or GFE document is attached yet."}
              </p>
              <p className="mt-1 text-xs leading-5 text-amber-700">You can still move this opportunity now and add the document later from the RX / GFE modal.</p>
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
