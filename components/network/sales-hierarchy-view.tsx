"use client";

import { Children, useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent, ReactNode } from "react";
import { Building2, UserRound, X, ZoomIn, ZoomOut } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { HierarchyNode, SalesHierarchyTree } from "@/lib/network/sales-hierarchy-types";

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
  if (type === "MANAGER") return "Manager";
  if (type === "GROUP_LEADER") return "Group leader";
  return "Agent";
}

function roleInitial(type: HierarchyNode["type"]) {
  if (type === "PARTNER") return "P";
  if (type === "MANAGER") return "M";
  if (type === "GROUP_LEADER") return "L";
  return "S";
}

function roleTone(type: HierarchyNode["type"]) {
  if (type === "PARTNER") return "border-red-100 bg-red-50 text-clinic-red";
  if (type === "MANAGER") return "border-blue-100 bg-blue-50 text-clinic-navy";
  if (type === "GROUP_LEADER") return "border-emerald-100 bg-emerald-50 text-emerald-700";
  return "border-slate-200 bg-white text-slate-500";
}

function isInteractiveTarget(target: EventTarget | null) {
  return target instanceof HTMLElement && Boolean(target.closest("button, a, input, select, textarea"));
}

function Avatar({ node, size = "md" }: { node: HierarchyNode; size?: "sm" | "md" | "lg" }) {
  const dimensions = size === "lg" ? "h-14 w-14" : size === "sm" ? "h-9 w-9" : "h-11 w-11";

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
  const isLeadership = node.type === "PARTNER" || node.type === "MANAGER" || node.type === "GROUP_LEADER";

  return (
    <button
      type="button"
      data-branch-anchor="true"
      onClick={() => onSelect(node)}
      draggable={false}
      onPointerDown={(event) => event.currentTarget.blur()}
      title={`${node.name} - ${roleLabel(node.type)}`}
      aria-label={`Open ${node.name} ${roleLabel(node.type)} details`}
      className={`group relative flex w-[104px] select-none flex-col items-center gap-2 rounded-[1.6rem] border bg-white/95 px-3 py-3 text-center shadow-line backdrop-blur transition hover:-translate-y-0.5 hover:border-clinic-navy/40 hover:shadow-soft ${
        selected ? "border-clinic-navy ring-4 ring-clinic-navy/10" : "border-border"
      }`}
    >
      <Avatar node={node} size={isPartner ? "lg" : "md"} />
      <span
        className={`absolute -right-1 -top-1 grid size-6 place-items-center rounded-full border text-[9px] font-black shadow-line ${roleTone(node.type)}`}
        aria-hidden="true"
      >
        {roleInitial(node.type)}
      </span>
      {isPartner ? <Building2 className="absolute bottom-3 right-3 h-3 w-3 text-clinic-red" /> : null}
      <span className="max-w-full truncate text-[11px] font-bold leading-tight text-clinic-ink">{node.name}</span>
      <span className={`h-1.5 w-7 rounded-full ${isLeadership ? "bg-clinic-navy" : "bg-slate-300"}`} aria-hidden="true" />
    </button>
  );
}

function BranchLine({ children, className = "gap-12" }: { children: ReactNode; className?: string }) {
  const items = Children.toArray(children).filter(Boolean);
  const rowRef = useRef<HTMLDivElement | null>(null);
  const itemRefs = useRef<Array<HTMLDivElement | null>>([]);
  const [metrics, setMetrics] = useState<{ left: number; width: number; anchors: number[] } | null>(null);

  useEffect(() => {
    const updateLine = () => {
      const row = rowRef.current;

      if (!row || items.length === 0) {
        setMetrics(null);
        return;
      }

      const rowRect = row.getBoundingClientRect();
      const anchors = itemRefs.current
        .slice(0, items.length)
        .map((item) => {
          if (!item) return null;
          const anchor = item.querySelector("[data-branch-anchor='true']") as HTMLElement | null;
          const rect = (anchor ?? item).getBoundingClientRect();
          return rect.left + rect.width / 2 - rowRect.left;
        })
        .filter((value): value is number => typeof value === "number");

      if (anchors.length === 0) {
        setMetrics(null);
        return;
      }

      const left = Math.min(...anchors);
      const right = Math.max(...anchors);
      const nextMetrics = {
        left,
        width: Math.max(0, right - left),
        anchors
      };

      setMetrics((currentMetrics) => {
        if (
          currentMetrics &&
          Math.abs(currentMetrics.left - nextMetrics.left) < 0.5 &&
          Math.abs(currentMetrics.width - nextMetrics.width) < 0.5 &&
          currentMetrics.anchors.length === nextMetrics.anchors.length &&
          currentMetrics.anchors.every((anchor, index) => Math.abs(anchor - nextMetrics.anchors[index]) < 0.5)
        ) {
          return currentMetrics;
        }

        return nextMetrics;
      });
    };

    updateLine();

    const observer = new ResizeObserver(updateLine);
    if (rowRef.current) {
      observer.observe(rowRef.current);
    }

    itemRefs.current.forEach((item) => {
      if (item) {
        observer.observe(item);
      }
    });

    window.addEventListener("resize", updateLine);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateLine);
    };
  }, [items.length, className]);

  return (
    <div className="relative isolate flex flex-col items-center pt-12 before:absolute before:left-1/2 before:top-0 before:z-0 before:h-6 before:w-px before:-translate-x-1/2 before:bg-slate-300">
      {metrics && metrics.width > 0 ? (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute top-6 z-0 h-px bg-slate-300"
          style={{ left: metrics.left, width: metrics.width }}
        />
      ) : null}
      {metrics?.anchors.map((anchor, index) => (
        <span
          key={`${anchor}-${index}`}
          aria-hidden="true"
          className="pointer-events-none absolute top-6 z-0 h-6 w-px -translate-x-1/2 bg-slate-300"
          style={{ left: anchor }}
        />
      ))}
      <div ref={rowRef} className={`relative z-10 flex items-start justify-center ${className}`}>
        {items.map((item, index) => (
          <div
            key={index}
            ref={(node) => {
              itemRefs.current[index] = node;
            }}
            className="relative z-10 flex flex-col items-center"
          >
            {item}
          </div>
        ))}
      </div>
    </div>
  );
}

function BranchItem({ children }: { children: ReactNode; showStem?: boolean }) {
  return <div className="relative z-10 flex flex-col items-center">{children}</div>;
}

function DetailPanel({ node, onClose }: { node: HierarchyNode | null; onClose: () => void }) {
  if (!node) return null;
  const showCommissionMetric = node.showCommissionMetric !== false;
  const showCommissionSetup = node.showCommissionSetup !== false;
  const showGroupEarn = node.type === "MANAGER" || node.type === "GROUP_LEADER";

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
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-emerald-700">
                {showGroupEarn ? "Group earned" : "Commission earned"}
              </p>
              <p className="mt-2 text-2xl font-semibold text-emerald-800">
                {formatCurrency(showGroupEarn ? node.groupCommissionCents ?? 0 : node.commissionCents)}
              </p>
            </div>
          ) : null}
          {showCommissionMetric && showGroupEarn ? (
            <div className="rounded-2xl bg-white p-4 ring-1 ring-border">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Personal earned</p>
              <p className="mt-2 text-2xl font-semibold text-clinic-navy">{formatCurrency(node.personalCommissionCents ?? 0)}</p>
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
  const [zoom, setZoom] = useState(70);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
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
      ...tree.managerGroups.flatMap((managerGroup) => [
        managerGroup.manager,
        ...managerGroup.leaderGroups.flatMap((group) => [group.leader, ...group.consultants]),
        ...managerGroup.directConsultants
      ]),
      ...tree.directLeaderGroups.flatMap((group) => [group.leader, ...group.consultants]),
      ...tree.directConsultants
    ],
    [tree]
  );
  const selectedNode = selectedId ? nodes.find((node) => node.id === selectedId) ?? null : null;

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
          className={`min-h-[620px] select-none overflow-hidden rounded-3xl bg-gradient-to-b from-slate-50 to-white p-6 touch-none xl:max-h-[72vh] ${
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
            <div className="flex flex-col items-center px-16 py-8">
              <PersonNode node={tree.partner} selected={selectedId === tree.partner.id} onSelect={(node) => setSelectedId(node.id)} />

              <BranchLine>
                {tree.managerGroups.map((managerGroup) => (
                  <BranchItem key={managerGroup.manager.id}>
                    <PersonNode
                      node={managerGroup.manager}
                      selected={selectedId === managerGroup.manager.id}
                      onSelect={(node) => setSelectedId(node.id)}
                    />
                    {(managerGroup.leaderGroups.length > 0 || managerGroup.directConsultants.length > 0) ? (
                      <BranchLine className="gap-8">
                        {managerGroup.leaderGroups.map((group) => (
                          <BranchItem key={group.leader.id}>
                            <PersonNode
                              node={group.leader}
                              selected={selectedId === group.leader.id}
                              onSelect={(node) => setSelectedId(node.id)}
                            />
                            {group.consultants.length > 0 ? (
                              <BranchLine className="gap-6">
                                {group.consultants.map((consultant) => (
                                  <BranchItem key={consultant.id}>
                                    <PersonNode
                                      node={consultant}
                                      selected={selectedId === consultant.id}
                                      onSelect={(node) => setSelectedId(node.id)}
                                    />
                                  </BranchItem>
                                ))}
                              </BranchLine>
                            ) : null}
                          </BranchItem>
                        ))}
                        {managerGroup.directConsultants.length > 0 ? (
                          <BranchItem>
                            <div className="mb-3 rounded-full border border-border bg-white px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500 shadow-line">
                              Direct agents
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                              {managerGroup.directConsultants.map((consultant) => (
                                <PersonNode
                                  key={consultant.id}
                                  node={consultant}
                                  selected={selectedId === consultant.id}
                                  onSelect={(node) => setSelectedId(node.id)}
                                />
                              ))}
                            </div>
                          </BranchItem>
                        ) : null}
                      </BranchLine>
                    ) : null}
                  </BranchItem>
                ))}

                {tree.directLeaderGroups.map((group) => (
                  <BranchItem key={group.leader.id}>
                    <PersonNode
                      node={group.leader}
                      selected={selectedId === group.leader.id}
                      onSelect={(node) => setSelectedId(node.id)}
                    />
                    {group.consultants.length > 0 ? (
                      <BranchLine className="gap-6">
                        {group.consultants.map((consultant) => (
                          <BranchItem key={consultant.id}>
                            <PersonNode
                              node={consultant}
                              selected={selectedId === consultant.id}
                              onSelect={(node) => setSelectedId(node.id)}
                            />
                          </BranchItem>
                        ))}
                      </BranchLine>
                    ) : null}
                  </BranchItem>
                ))}

                {tree.directConsultants.length > 0 ? (
                  <BranchItem>
                    <div className="mb-3 rounded-full border border-border bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                      Direct consultants
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      {tree.directConsultants.map((consultant) => (
                        <PersonNode
                          key={consultant.id}
                          node={consultant}
                          selected={selectedId === consultant.id}
                          onSelect={(node) => setSelectedId(node.id)}
                        />
                      ))}
                    </div>
                  </BranchItem>
                ) : null}
              </BranchLine>
            </div>
          </div>
        </div>

        <DetailPanel node={selectedNode} onClose={() => setSelectedId(null)} />
      </div>
    </section>
  );
}
