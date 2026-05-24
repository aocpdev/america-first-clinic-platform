"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent } from "react";
import { Building2, Search, UserRound, X, ZoomIn, ZoomOut } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export type HierarchyNode = {
  id: string;
  type: "PARTNER" | "GROUP_LEADER" | "CONSULTANT";
  name: string;
  email: string;
  avatarUrl: string | null;
  commissionLabel: string;
  revenueCents: number;
  commissionCents: number;
  salesCount: number;
  showCommissionMetric?: boolean;
  showCommissionSetup?: boolean;
  subtitle?: string;
  notes?: string[];
};

export type HierarchyLeaderGroup = {
  leader: HierarchyNode;
  consultants: HierarchyNode[];
};

export type SalesHierarchyTree = {
  partner: HierarchyNode;
  leaderGroups: HierarchyLeaderGroup[];
  directConsultants: HierarchyNode[];
};

function formatCurrency(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD"
  }).format(cents / 100);
}

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function roleLabel(type: HierarchyNode["type"]) {
  if (type === "PARTNER") return "Partner";
  if (type === "GROUP_LEADER") return "Group leader";
  return "Consultant";
}

function isInteractiveTarget(target: EventTarget | null) {
  return target instanceof HTMLElement && Boolean(target.closest("button, a, input, select, textarea"));
}

function Avatar({ node, size = "md" }: { node: HierarchyNode; size?: "sm" | "md" | "lg" }) {
  const dimensions = size === "lg" ? "h-16 w-16" : size === "sm" ? "h-10 w-10" : "h-12 w-12";

  return (
    <div className={`${dimensions} shrink-0 overflow-hidden rounded-full border border-white bg-clinic-mist shadow-line`}>
      {node.avatarUrl ? (
        <div
          aria-label={`${node.name} avatar`}
          className="h-full w-full bg-cover bg-center"
          style={{ backgroundImage: `url(${node.avatarUrl})` }}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-clinic-navy text-sm font-semibold text-white">
          {initials(node.name) || <UserRound className="h-4 w-4" />}
        </div>
      )}
    </div>
  );
}

function PersonNode({
  node,
  selected,
  onSelect
}: {
  node: HierarchyNode;
  selected: boolean;
  onSelect: (node: HierarchyNode) => void;
}) {
  const isPartner = node.type === "PARTNER";
  const showCommissionMetric = node.showCommissionMetric !== false;

  return (
    <button
      type="button"
      onClick={() => onSelect(node)}
      draggable={false}
      className={`group min-w-[220px] select-none rounded-2xl border bg-white p-4 text-left shadow-line transition hover:-translate-y-0.5 hover:border-clinic-navy/40 hover:shadow-soft ${
        selected ? "border-clinic-navy ring-4 ring-clinic-navy/10" : "border-border"
      }`}
    >
      <div className="flex items-start gap-3">
        <Avatar node={node} size={isPartner ? "lg" : "md"} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate font-semibold text-clinic-ink">{node.name}</p>
            {isPartner ? <Building2 className="h-4 w-4 text-clinic-red" /> : null}
          </div>
          <p className="mt-1 truncate text-xs font-medium text-slate-500">{roleLabel(node.type)}</p>
          <p className="mt-1 truncate text-xs text-slate-400">{node.email}</p>
        </div>
      </div>
      <div className={`mt-4 grid gap-2 text-xs ${showCommissionMetric ? "grid-cols-2" : "grid-cols-1"}`}>
        <div className="rounded-xl bg-clinic-mist px-3 py-2">
          <p className="font-semibold text-clinic-navy">{formatCurrency(node.revenueCents)}</p>
          <p className="mt-1 text-slate-500">Sales</p>
        </div>
        {showCommissionMetric ? (
          <div className="rounded-xl bg-emerald-50 px-3 py-2">
            <p className="font-semibold text-emerald-800">{formatCurrency(node.commissionCents)}</p>
            <p className="mt-1 text-emerald-700">Earned</p>
          </div>
        ) : null}
      </div>
      <div className="mt-3 flex items-center justify-between gap-2">
        {node.showCommissionSetup === false ? null : (
          <Badge className="border-blue-100 bg-blue-50 text-clinic-navy">{node.commissionLabel}</Badge>
        )}
        <span className="text-xs font-semibold text-slate-400">{node.salesCount} sales</span>
      </div>
    </button>
  );
}

function DetailPanel({ node, onClose }: { node: HierarchyNode | null; onClose: () => void }) {
  if (!node) return null;
  const showCommissionMetric = node.showCommissionMetric !== false;
  const showCommissionSetup = node.showCommissionSetup !== false;

  return (
    <aside className="overflow-hidden rounded-3xl border border-border bg-white shadow-soft xl:sticky xl:top-24">
      <div className="p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <Badge>{roleLabel(node.type)}</Badge>
          <button
            type="button"
            onClick={onClose}
            className="grid size-10 shrink-0 place-items-center rounded-full border border-border bg-white text-slate-500 shadow-line transition hover:bg-clinic-mist hover:text-clinic-ink"
            aria-label="Close profile panel"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-5 flex items-center gap-4">
          <Avatar node={node} size="lg" />
          <div className="min-w-0">
            <h3 className="text-2xl font-semibold text-clinic-ink">{node.name}</h3>
            <p className="mt-1 break-all text-sm text-slate-500">{node.email}</p>
          </div>
        </div>

        <div className={`mt-6 grid gap-3 ${showCommissionMetric && showCommissionSetup ? "sm:grid-cols-3 xl:grid-cols-1" : "sm:grid-cols-2 xl:grid-cols-1"}`}>
          <div className="rounded-2xl bg-clinic-mist p-4">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Attributed sales</p>
            <p className="mt-2 text-2xl font-semibold text-clinic-navy">{formatCurrency(node.revenueCents)}</p>
          </div>
          {showCommissionMetric ? (
            <div className="rounded-2xl bg-emerald-50 p-4">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-emerald-700">Commission earned</p>
              <p className="mt-2 text-2xl font-semibold text-emerald-800">{formatCurrency(node.commissionCents)}</p>
            </div>
          ) : null}
          {showCommissionSetup ? (
            <div className="rounded-2xl bg-white p-4 ring-1 ring-border">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Commission setup</p>
              <p className="mt-2 text-lg font-semibold text-clinic-ink">{node.commissionLabel}</p>
            </div>
          ) : null}
        </div>

        <div className="mt-6 space-y-3">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Profile details</p>
          <div className="rounded-2xl border border-border bg-white p-4 text-sm leading-6 text-slate-600">
            <p>{node.subtitle ?? "No additional profile summary yet."}</p>
            {node.notes?.length ? (
              <ul className="mt-3 space-y-2">
                {node.notes.map((note) => (
                  <li key={note} className="rounded-xl bg-clinic-mist px-3 py-2">{note}</li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>
      </div>
    </aside>
  );
}

export function SalesHierarchyView({ tree, title = "Sales hierarchy" }: { tree: SalesHierarchyTree; title?: string }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(80);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [query, setQuery] = useState("");
  const dragStartRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  } | null>(null);

  const nodes = useMemo(
    () => [
      tree.partner,
      ...tree.leaderGroups.flatMap((group) => [group.leader, ...group.consultants]),
      ...tree.directConsultants
    ],
    [tree]
  );
  const selectedNode = selectedId ? nodes.find((node) => node.id === selectedId) ?? null : null;
  const normalizedQuery = query.trim().toLowerCase();

  useEffect(() => {
    if (!isPanning) return;

    const previousUserSelect = document.body.style.userSelect;
    const previousWebkitUserSelect = document.body.style.webkitUserSelect;

    document.body.style.userSelect = "none";
    document.body.style.webkitUserSelect = "none";

    return () => {
      document.body.style.userSelect = previousUserSelect;
      document.body.style.webkitUserSelect = previousWebkitUserSelect;
    };
  }, [isPanning]);

  function isVisible(node: HierarchyNode) {
    if (!normalizedQuery) return true;
    return `${node.name} ${node.email} ${roleLabel(node.type)}`.toLowerCase().includes(normalizedQuery);
  }

  function handleCanvasPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0 || isInteractiveTarget(event.target)) return;

    event.preventDefault();
    dragStartRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: pan.x,
      originY: pan.y
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    setIsPanning(true);
  }

  function handleCanvasPointerMove(event: PointerEvent<HTMLDivElement>) {
    const dragStart = dragStartRef.current;
    if (!dragStart || dragStart.pointerId !== event.pointerId) return;

    event.preventDefault();
    setPan({
      x: dragStart.originX + event.clientX - dragStart.startX,
      y: dragStart.originY + event.clientY - dragStart.startY
    });
  }

  function stopCanvasPan(event: PointerEvent<HTMLDivElement>) {
    const dragStart = dragStartRef.current;
    if (!dragStart || dragStart.pointerId !== event.pointerId) return;

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    dragStartRef.current = null;
    setIsPanning(false);
  }

  return (
    <section className="rounded-3xl border border-border bg-white p-5 shadow-line">
      <div className="flex flex-col gap-4 border-b border-border pb-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <Badge>Hierarchy</Badge>
          <h2 className="mt-3 text-2xl font-semibold text-clinic-ink">{title}</h2>
          <p className="mt-1 text-sm text-slate-500">Click any avatar card to view profile, sales, and commission details.</p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search people..."
              className="h-10 w-full rounded-xl border border-border bg-white pl-9 pr-3 text-sm outline-none transition focus:border-clinic-navy focus:ring-4 focus:ring-clinic-navy/10 sm:w-64"
            />
          </label>
          <div className="flex h-10 items-center gap-3 rounded-xl border border-border bg-clinic-mist px-3 shadow-line">
            <ZoomOut className="h-4 w-4 text-slate-500" />
            <input
              type="range"
              min="20"
              max="140"
              step="5"
              value={zoom}
              onChange={(event) => setZoom(Number(event.target.value))}
              className="w-36 accent-clinic-navy"
              aria-label="Zoom hierarchy"
            />
            <span className="w-12 text-center text-xs font-bold tabular-nums text-clinic-navy">{zoom}%</span>
            <ZoomIn className="h-4 w-4 text-slate-500" />
          </div>
        </div>
      </div>

      <div className={`mt-5 grid gap-5 ${selectedNode ? "xl:grid-cols-[minmax(0,1fr)_360px]" : "xl:grid-cols-1"}`}>
        <div
          className={`min-h-[620px] select-none overflow-hidden rounded-3xl bg-slate-50 p-6 touch-none xl:max-h-[72vh] ${
            isPanning ? "cursor-grabbing" : "cursor-grab"
          }`}
          onPointerDown={handleCanvasPointerDown}
          onPointerMove={handleCanvasPointerMove}
          onPointerUp={stopCanvasPan}
          onPointerCancel={stopCanvasPan}
        >
          <div
            className="min-w-max origin-top-left transition-transform"
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom / 100})`,
              transformOrigin: "top left"
            }}
          >
            <div className="flex flex-col items-center">
              {isVisible(tree.partner) ? (
                <PersonNode node={tree.partner} selected={selectedId === tree.partner.id} onSelect={(node) => setSelectedId(node.id)} />
              ) : null}

              <div className="h-8 w-px bg-border" />

              <div className="flex items-start gap-6">
                {tree.leaderGroups.map((group) => {
                  const visibleConsultants = group.consultants.filter(isVisible);
                  const leaderVisible = isVisible(group.leader);

                  if (!leaderVisible && visibleConsultants.length === 0) {
                    return null;
                  }

                  return (
                    <div key={group.leader.id} className="flex flex-col items-center">
                      <div className="h-px w-full bg-border" />
                      {leaderVisible ? (
                        <PersonNode
                          node={group.leader}
                          selected={selectedId === group.leader.id}
                          onSelect={(node) => setSelectedId(node.id)}
                        />
                      ) : null}
                      {visibleConsultants.length > 0 ? <div className="h-7 w-px bg-border" /> : null}
                      <div className="grid gap-3">
                        {visibleConsultants.map((consultant) => (
                          <PersonNode
                            key={consultant.id}
                            node={consultant}
                            selected={selectedId === consultant.id}
                            onSelect={(node) => setSelectedId(node.id)}
                          />
                        ))}
                      </div>
                    </div>
                  );
                })}

                {tree.directConsultants.length > 0 ? (
                  <div className="flex flex-col items-center">
                    <div className="mb-3 rounded-full border border-border bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                      Direct consultants
                    </div>
                    <div className="grid gap-3">
                      {tree.directConsultants.filter(isVisible).map((consultant) => (
                        <PersonNode
                          key={consultant.id}
                          node={consultant}
                          selected={selectedId === consultant.id}
                          onSelect={(node) => setSelectedId(node.id)}
                        />
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>

        <DetailPanel node={selectedNode} onClose={() => setSelectedId(null)} />
      </div>
    </section>
  );
}
