"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  CheckCircle2,
  ClipboardList,
  Eye,
  Inbox,
  Pencil,
  Search,
  Shield,
  Trash2,
  Truck,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useInspectionsLogsStore } from "@/hooks/useInspectionsLogsStore";
import type {
  EntryRecord,
  InspectionItemResponseType,
  InspectionTemplate,
  LogFieldDef,
  LogFieldType,
  LogTemplate,
} from "@/lib/inspectionsLogsTypes";
import { readSession } from "@/lib/pulse-session";
import { ScrollReveal } from "@/components/motion/ScrollReveal";
import { InspectionBuilder } from "./InspectionBuilder";
import { LogBuilder } from "./LogBuilder";
import { cn } from "@/lib/cn";
import { buttonVariants } from "@/styles/button-variants";
import { DataTableCard, dataTableBodyRow, dataTableHeadRowClass } from "@/components/ui/DataTable";
import { dsInputClass } from "@/components/ui/ds-form-classes";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Card } from "@/components/pulse/Card";
import { MetricCard } from "@/components/ui/MetricCard";
import {
  InspectionQuickInspectionCard,
  InspectionsLogsHero,
  InspectionsLogsMetricsInspections,
  InspectionsLogsMetricsLogs,
  INSPECTIONS_OP_HERO_SHELL,
} from "./InspectionsLogsChrome";
import {
  VehicleInspectionSheet,
  type VehicleInspectionArchivePayload,
} from "@/components/inspections/VehicleInspectionSheet";
import { HarnessInspectionForm } from "@/components/compliance/HarnessInspectionForm";

const TH = "px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-ds-muted";
const TD = "px-4 py-3 text-sm text-ds-foreground";
const LINKISH = "ds-link text-xs font-semibold disabled:opacity-40";

const ARCHIVE_ROLE_TAGS = [
  { id: "lead", label: "Lead" },
  { id: "supervisor", label: "Supervisor" },
  { id: "manager", label: "Manager" },
  { id: "company_admin", label: "Operations / Admin" },
] as const;

type ArchivedVehicleInspection = VehicleInspectionArchivePayload & {
  id: string;
  submittedBy: string | null;
};

function newArchiveId(): string {
  return `vinv_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function formatWhen(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function isSameLocalDay(iso: string): boolean {
  const d = new Date(iso);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate()
  );
}

function formatRelativeWhen(iso: string | null): string {
  if (!iso) return "—";
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diffSec = Math.round((now - then) / 1000);
  if (diffSec < 45) return "Just now";
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  if (diffSec < 86400 * 7) return `${Math.floor(diffSec / 86400)}d ago`;
  return formatWhen(iso);
}

function userInitials(userId: string | null | undefined): string {
  if (!userId) return "—";
  const local = userId.includes("@") ? userId.split("@")[0]! : userId;
  const parts = local.replace(/[._-]+/g, " ").trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
  if (local.length >= 2) return local.slice(0, 2).toUpperCase();
  return local.slice(0, 1).toUpperCase() || "?";
}

export function InspectionsLogsApp() {
  const store = useInspectionsLogsStore();
  const session = readSession();
  const userId = session?.email ?? session?.sub ?? null;

  const [tab, setTab] = useState<"inspections" | "logs" | "archive">("inspections");
  const [showVehicleInspection, setShowVehicleInspection] = useState(false);
  const [vehicleSheetKey, setVehicleSheetKey] = useState(0);
  const [vehicleArchive, setVehicleArchive] = useState<ArchivedVehicleInspection[]>([]);
  const [inspectionCompleteFlash, setInspectionCompleteFlash] = useState(false);
  const [showHarnessInspection, setShowHarnessInspection] = useState(false);
  const [builder, setBuilder] = useState<null | { kind: "inspection" | "log"; editId: string | null }>(
    null,
  );

  const [inspectFill, setInspectFill] = useState<InspectionTemplate | null>(null);
  const [logFill, setLogFill] = useState<LogTemplate | null>(null);
  const [viewEntry, setViewEntry] = useState<EntryRecord | null>(null);

  const inspectionEntries = useMemo(
    () => store.entries.filter((e) => e.template_type === "inspection"),
    [store.entries],
  );
  const logEntries = useMemo(() => store.entries.filter((e) => e.template_type === "log"), [store.entries]);

  const [inspectTemplateQuery, setInspectTemplateQuery] = useState("");
  const [logTemplateQuery, setLogTemplateQuery] = useState("");

  const filteredInspectionTemplates = useMemo(() => {
    const q = inspectTemplateQuery.trim().toLowerCase();
    if (!q) return store.inspectionTemplates;
    return store.inspectionTemplates.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        (t.description ?? "").toLowerCase().includes(q) ||
        (t.frequency ?? "").toLowerCase().includes(q),
    );
  }, [store.inspectionTemplates, inspectTemplateQuery]);

  const filteredLogTemplates = useMemo(() => {
    const q = logTemplateQuery.trim().toLowerCase();
    if (!q) return store.logTemplates;
    return store.logTemplates.filter(
      (t) => t.name.toLowerCase().includes(q) || (t.description ?? "").toLowerCase().includes(q),
    );
  }, [store.logTemplates, logTemplateQuery]);

  const completedInspectionTodayCount = useMemo(
    () => inspectionEntries.filter((e) => isSameLocalDay(e.created_at)).length,
    [inspectionEntries],
  );

  const logEntriesTodayCount = useMemo(
    () => logEntries.filter((e) => isSameLocalDay(e.created_at)).length,
    [logEntries],
  );

  const needsAttentionCount = useMemo(() => {
    return store.inspectionTemplates.filter((t) => !store.lastAt(t.id)).length;
  }, [store]);

  const goTab = useCallback((t: "inspections" | "logs" | "archive") => {
    setTab(t);
    setBuilder(null);
  }, []);

  const openNewInspection = useCallback(() => {
    setTab("inspections");
    setBuilder({ kind: "inspection", editId: null });
  }, []);

  const openNewLog = useCallback(() => {
    setTab("logs");
    setBuilder({ kind: "log", editId: null });
  }, []);

  const saveInspectionTemplate = (t: InspectionTemplate) => {
    const existing = store.templates.find((x) => x.id === t.id);
    if (existing) store.updateTemplate(t);
    else store.addTemplate(t);
    setBuilder(null);
  };

  const saveLogTemplate = (t: LogTemplate) => {
    const existing = store.templates.find((x) => x.id === t.id);
    if (existing) store.updateTemplate(t);
    else store.addTemplate(t);
    setBuilder(null);
  };

  const onVehicleInspectionArchived = useCallback(
    (payload: VehicleInspectionArchivePayload) => {
      setVehicleArchive((prev) => [
        { ...payload, id: newArchiveId(), submittedBy: userId },
        ...prev,
      ]);
      setShowVehicleInspection(false);
      setVehicleSheetKey((k) => k + 1);
      setInspectionCompleteFlash(true);
      setTab("archive");
    },
    [userId],
  );

  useEffect(() => {
    if (!inspectionCompleteFlash) return;
    const t = window.setTimeout(() => setInspectionCompleteFlash(false), 8000);
    return () => window.clearTimeout(t);
  }, [inspectionCompleteFlash]);

  return (
    <div className="space-y-6">
      <InspectionsLogsHero
        title="Inspections & Logs"
        subtitle="Build reusable checklists and log forms, run field inspections, and keep a defensible record — all in one operational workspace."
        icon={ClipboardList}
        tab={tab}
        onTabChange={goTab}
        onNewInspectionTemplate={openNewInspection}
        onNewLogTemplate={openNewLog}
        onGoArchive={() => goTab("archive")}
        metadata={
          tab === "logs" ? (
            <>
              <span className="inline-flex items-center rounded-full border border-ds-border/80 bg-ds-primary px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-ds-muted">
                Logs
              </span>
              <span className="hidden text-ds-border sm:inline" aria-hidden>
                ·
              </span>
              <span>{store.logTemplates.length} templates</span>
              <span className="hidden text-ds-border sm:inline" aria-hidden>
                ·
              </span>
              <span>{logEntries.length} entries</span>
            </>
          ) : tab === "archive" ? (
            <>
              <span className="inline-flex items-center rounded-full border border-ds-border/80 bg-ds-primary px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-ds-muted">
                Archive
              </span>
              <span className="hidden text-ds-border sm:inline" aria-hidden>
                ·
              </span>
              <span>{vehicleArchive.length} vehicle record{vehicleArchive.length === 1 ? "" : "s"}</span>
            </>
          ) : (
            <>
              <span className="inline-flex items-center rounded-full border border-ds-border/80 bg-ds-primary px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-ds-muted">
                Inspections
              </span>
              <span className="hidden text-ds-border sm:inline" aria-hidden>
                ·
              </span>
              <span>{store.inspectionTemplates.length} templates</span>
              <span className="hidden text-ds-border sm:inline" aria-hidden>
                ·
              </span>
              <span>{inspectionEntries.length} completed runs</span>
            </>
          )
        }
      />

      <AnimatePresence initial={false}>
        {inspectionCompleteFlash ? (
          <motion.div
            role="status"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="flex items-center gap-3 rounded-lg border border-[color-mix(in_srgb,var(--ds-success)_32%,var(--ds-border))] bg-[color-mix(in_srgb,var(--ds-success)_10%,var(--ds-primary))] px-4 py-3 text-sm font-semibold text-ds-foreground shadow-[var(--ds-shadow-card)]"
          >
            <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-ds-border/60 bg-ds-secondary/80 text-ds-success">
              <CheckCircle2 className="h-5 w-5" strokeWidth={2.25} aria-hidden />
            </span>
            <span>Inspection complete — saved to Archive.</span>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {!builder && tab === "inspections" ? (
        <ScrollReveal className="space-y-3" y={6}>
          <InspectionsLogsMetricsInspections
            templateCount={store.inspectionTemplates.length}
            completedTotal={inspectionEntries.length}
            completedToday={completedInspectionTodayCount}
            needsAttentionCount={needsAttentionCount}
          />
        </ScrollReveal>
      ) : null}

      {!builder && tab === "logs" ? (
        <ScrollReveal className="space-y-3" y={6}>
          <InspectionsLogsMetricsLogs
            templateCount={store.logTemplates.length}
            entriesTotal={logEntries.length}
            entriesToday={logEntriesTodayCount}
          />
        </ScrollReveal>
      ) : null}

      {!builder && tab === "archive" ? (
        <ScrollReveal className="space-y-3" y={6}>
          <div className="grid gap-3 sm:grid-cols-2">
            <MetricCard
              label="Archived vehicle inspections"
              value={vehicleArchive.length}
              borderAccent="neutral"
              hint="Submitted from this device session"
            />
            <MetricCard
              label="Retention"
              value="Local"
              borderAccent="info"
              hint="Sync to company records when backend wiring is enabled"
            />
          </div>
        </ScrollReveal>
      ) : null}

      {builder?.kind === "inspection" ? (
        <InspectionBuilder
          initial={
            builder.editId ? (store.inspectionTemplates.find((t) => t.id === builder.editId) ?? null) : null
          }
          onSave={saveInspectionTemplate}
          onCancel={() => setBuilder(null)}
        />
      ) : null}

      {builder?.kind === "log" ? (
        <LogBuilder
          initial={builder.editId ? (store.logTemplates.find((t) => t.id === builder.editId) ?? null) : null}
          onSave={saveLogTemplate}
          onCancel={() => setBuilder(null)}
        />
      ) : null}

      {!builder && tab === "inspections" ? (
        <div className="space-y-6">
          <ScrollReveal className="grid gap-4 md:grid-cols-1 lg:grid-cols-2" y={8}>
            <InspectionQuickInspectionCard
              icon={Truck}
              title="Digital vehicle inspection"
              description="Tablet-first DVIR-style sheet with distance, time-out, and sign-off — mock local state until fleet sync lands."
              meta={
                <>
                  <StatusBadge variant="neutral">Field</StatusBadge>
                  <span>{vehicleArchive.length} archived this session</span>
                </>
              }
              expanded={showVehicleInspection}
              onToggle={() => setShowVehicleInspection((v) => !v)}
              actionLabel={showVehicleInspection ? "Hide inspection sheet" : "Open inspection sheet"}
            >
              <VehicleInspectionSheet key={vehicleSheetKey} onArchived={onVehicleInspectionArchived} />
            </InspectionQuickInspectionCard>

            <InspectionQuickInspectionCard
              icon={Shield}
              title="Harness inspection"
              description="Fall-protection harness walkthrough tuned for gloved hands and bright sunlight — capture now, route to Work Items later."
              meta={
                <>
                  <StatusBadge variant="neutral">Safety</StatusBadge>
                  <span>Client-side submit (demo)</span>
                </>
              }
              expanded={showHarnessInspection}
              onToggle={() => setShowHarnessInspection((v) => !v)}
              actionLabel={showHarnessInspection ? "Hide harness form" : "Open harness form"}
            >
              <HarnessInspectionForm
                onSubmit={(payload) => {
                  // eslint-disable-next-line no-console
                  console.log("Harness inspection submit", payload);
                  window.alert("Harness inspection captured (client-side). Ready to wire into Work Items.");
                }}
              />
            </InspectionQuickInspectionCard>
          </ScrollReveal>

          <motion.section
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="space-y-3"
          >
            <div className="flex flex-col gap-3 border-b border-ds-border/80 pb-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-base font-semibold text-ds-foreground">Inspection templates</h2>
                <p className="mt-0.5 text-sm text-ds-muted">Reusable checklists your crew can run on shift.</p>
              </div>
              <div className="relative w-full sm:max-w-xs">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ds-muted"
                  aria-hidden
                />
                <input
                  type="search"
                  value={inspectTemplateQuery}
                  onChange={(e) => setInspectTemplateQuery(e.target.value)}
                  placeholder="Search templates…"
                  className={cn(dsInputClass, "pl-9")}
                  aria-label="Search inspection templates"
                />
              </div>
            </div>

            <DataTableCard>
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className={dataTableHeadRowClass}>
                    <th className={TH}>Name</th>
                    <th className={TH}>Last completed</th>
                    <th className={TH}>Frequency</th>
                    <th className={`${TH} text-right`}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {store.inspectionTemplates.length === 0 ? (
                    <tr>
                      <td className={cn(TD, "bg-ds-secondary/40")} colSpan={4}>
                        <Card variant="secondary" padding="lg" className="border-dashed border-ds-border/80 text-center">
                          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-ds-border bg-ds-primary text-ds-muted">
                            <Inbox className="h-6 w-6" aria-hidden />
                          </div>
                          <p className="mt-3 text-sm font-semibold text-ds-foreground">No inspection templates yet</p>
                          <p className="mt-1 text-sm text-ds-muted">
                            Start from a proven checklist, then tune line items for your facility.
                          </p>
                          <button
                            type="button"
                            className={cn(
                              buttonVariants({ surface: "light", intent: "accent" }),
                              "mt-5 inline-flex min-h-[44px] items-center justify-center px-5 py-2.5 text-sm font-semibold shadow-sm",
                            )}
                            onClick={openNewInspection}
                          >
                            Create first template
                          </button>
                        </Card>
                      </td>
                    </tr>
                  ) : filteredInspectionTemplates.length === 0 ? (
                    <tr>
                      <td className={cn(TD, "text-ds-muted")} colSpan={4}>
                        {`No templates match "${inspectTemplateQuery.trim()}".`}
                      </td>
                    </tr>
                  ) : (
                    filteredInspectionTemplates.map((tpl) => (
                      <tr key={tpl.id} className={dataTableBodyRow()}>
                        <td className={cn(TD, "align-top")}>
                          <span className="font-semibold text-ds-foreground">{tpl.name}</span>
                          {tpl.description ? (
                            <p className="mt-1 text-xs leading-snug text-ds-muted">{tpl.description}</p>
                          ) : null}
                          <p className="mt-2 text-[11px] font-semibold uppercase tracking-wide text-ds-muted">
                            {tpl.checklist_items.length} line item{tpl.checklist_items.length === 1 ? "" : "s"}
                          </p>
                        </td>
                        <td className={cn(TD, "align-top text-ds-muted")}>{formatWhen(store.lastAt(tpl.id))}</td>
                        <td className={cn(TD, "align-top")}>
                          {tpl.frequency?.trim() ? (
                            <StatusBadge variant="neutral">{tpl.frequency.trim()}</StatusBadge>
                          ) : (
                            <span className="text-ds-muted">—</span>
                          )}
                        </td>
                        <td className={cn(TD, "align-top text-right")}>
                          <div className="flex flex-wrap items-center justify-end gap-2">
                            <button
                              type="button"
                              className={LINKISH}
                              onClick={() => setInspectFill(tpl)}
                              disabled={tpl.checklist_items.length === 0}
                            >
                              Submit run
                            </button>
                            <button
                              type="button"
                              className={LINKISH}
                              onClick={() => setBuilder({ kind: "inspection", editId: tpl.id })}
                            >
                              <Pencil className="mr-0.5 inline h-3.5 w-3.5" aria-hidden />
                              Edit
                            </button>
                            <button
                              type="button"
                              className="text-xs font-semibold text-red-700 hover:underline dark:text-red-400"
                              onClick={() => {
                                if (confirm(`Delete template “${tpl.name}”?`)) store.removeTemplate(tpl.id);
                              }}
                            >
                              <Trash2 className="mr-0.5 inline h-3.5 w-3.5" aria-hidden />
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </DataTableCard>
          </motion.section>

          <motion.section
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1], delay: 0.03 }}
            className="space-y-3"
          >
            <div className="border-b border-ds-border/80 pb-3">
              <h2 className="text-base font-semibold text-ds-foreground">Completed inspections</h2>
              <p className="mt-0.5 text-sm text-ds-muted">Latest runs first — tap a row to review captured answers.</p>
            </div>

            <DataTableCard>
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className={dataTableHeadRowClass}>
                    <th className={TH}>Template</th>
                    <th className={TH}>Status</th>
                    <th className={TH}>Completed</th>
                    <th className={TH}>By</th>
                    <th className={`${TH} text-right`}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {inspectionEntries.length === 0 ? (
                    <tr>
                      <td className={cn(TD, "text-ds-muted")} colSpan={5}>
                        No completed inspections yet. Submit a template run to build your audit trail.
                      </td>
                    </tr>
                  ) : (
                    [...inspectionEntries]
                      .sort(
                        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
                      )
                      .map((entry) => {
                        const tpl = store.inspectionTemplates.find((t) => t.id === entry.template_id);
                        return (
                          <tr key={entry.id} className={dataTableBodyRow()}>
                            <td className={cn(TD, "align-top font-medium text-ds-foreground")}>
                              {tpl?.name ?? entry.template_id}
                            </td>
                            <td className={cn(TD, "align-top")}>
                              <StatusBadge variant="success">Recorded</StatusBadge>
                            </td>
                            <td className={cn(TD, "align-top")}>
                              <span className="font-medium text-ds-foreground">
                                {formatRelativeWhen(entry.created_at)}
                              </span>
                              <p className="mt-0.5 text-xs text-ds-muted">{formatWhen(entry.created_at)}</p>
                            </td>
                            <td className={cn(TD, "align-top")}>
                              <div className="flex items-center gap-2">
                                <span
                                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-ds-border bg-ds-primary text-[11px] font-bold text-ds-foreground"
                                  aria-hidden
                                >
                                  {userInitials(entry.user_id)}
                                </span>
                                <span className="min-w-0 truncate text-sm text-ds-muted">{entry.user_id ?? "—"}</span>
                              </div>
                            </td>
                            <td className={cn(TD, "align-top text-right")}>
                              <button type="button" className={LINKISH} onClick={() => setViewEntry(entry)}>
                                <Eye className="mr-0.5 inline h-3.5 w-3.5" aria-hidden />
                                View
                              </button>
                            </td>
                          </tr>
                        );
                      })
                  )}
                </tbody>
              </table>
            </DataTableCard>
          </motion.section>
        </div>
      ) : null}

      {!builder && tab === "archive" ? (
        <div className="space-y-5">
          <section className={INSPECTIONS_OP_HERO_SHELL}>
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0 space-y-2">
                <h2 className="text-lg font-semibold text-ds-foreground">Inspection archive</h2>
                <p className="max-w-2xl text-sm leading-relaxed text-ds-muted">
                  Vehicle inspections you submit are listed here. Access is intended for{" "}
                  {ARCHIVE_ROLE_TAGS.map((r) => r.label).join(", ")}.
                </p>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {ARCHIVE_ROLE_TAGS.map((r) => (
                    <StatusBadge key={r.id} variant="neutral">
                      {r.label}
                    </StatusBadge>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <DataTableCard>
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className={dataTableHeadRowClass}>
                  <th className={TH}>Vehicle</th>
                  <th className={TH}>Operator</th>
                  <th className={TH}>Department</th>
                  <th className={TH}>Submitted</th>
                  <th className={TH}>Distance</th>
                  <th className={TH}>Time out</th>
                  <th className={TH}>By</th>
                </tr>
              </thead>
              <tbody>
                {vehicleArchive.length === 0 ? (
                  <tr>
                    <td className={cn(TD, "align-top text-ds-muted")} colSpan={7}>
                      <div className="py-6 text-center">
                        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-ds-border bg-ds-primary text-ds-muted">
                          <Inbox className="h-6 w-6" aria-hidden />
                        </div>
                        <p className="mt-3 text-sm font-semibold text-ds-foreground">No archived inspections yet</p>
                        <p className="mt-1 text-sm text-ds-muted">
                          Complete a digital vehicle inspection to populate this ledger.
                        </p>
                        <button
                          type="button"
                          className={cn(
                            buttonVariants({ surface: "light", intent: "accent" }),
                            "mt-4 inline-flex min-h-[44px] items-center justify-center px-4 py-2.5 text-sm font-semibold",
                          )}
                          onClick={() => {
                            goTab("inspections");
                            setShowVehicleInspection(true);
                          }}
                        >
                          Open vehicle inspection
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  vehicleArchive.map((row) => (
                    <tr key={row.id} className={dataTableBodyRow()}>
                      <td className={cn(TD, "align-top font-semibold text-ds-foreground")}>{row.vehicle}</td>
                      <td className={cn(TD, "align-top")}>{row.operatorName}</td>
                      <td className={cn(TD, "align-top text-ds-muted")}>{row.department}</td>
                      <td className={cn(TD, "align-top")}>
                        <span className="font-medium text-ds-foreground">{formatRelativeWhen(row.submittedAtIso)}</span>
                        <p className="mt-0.5 text-xs text-ds-muted">{formatWhen(row.submittedAtIso)}</p>
                      </td>
                      <td className={cn(TD, "align-top tabular-nums text-ds-muted")}>
                        {row.distanceKm === null ? "—" : `${row.distanceKm} km`}
                      </td>
                      <td className={cn(TD, "align-top text-ds-muted")}>{row.timeOutDuration ?? "—"}</td>
                      <td className={cn(TD, "align-top")}>
                        <div className="flex items-center gap-2">
                          <span
                            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-ds-border bg-ds-primary text-[11px] font-bold text-ds-foreground"
                            aria-hidden
                          >
                            {userInitials(row.submittedBy)}
                          </span>
                          <span className="min-w-0 truncate text-sm text-ds-muted">{row.submittedBy ?? "—"}</span>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </DataTableCard>
        </div>
      ) : null}

      {!builder && tab === "logs" ? (
        <div className="space-y-6">
          <motion.section
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="space-y-3"
          >
            <div className="flex flex-col gap-3 border-b border-ds-border/80 pb-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-base font-semibold text-ds-foreground">Log templates</h2>
                <p className="mt-0.5 text-sm text-ds-muted">Operational forms for readings, rounds, and shift notes.</p>
              </div>
              <div className="relative w-full sm:max-w-xs">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ds-muted"
                  aria-hidden
                />
                <input
                  type="search"
                  value={logTemplateQuery}
                  onChange={(e) => setLogTemplateQuery(e.target.value)}
                  placeholder="Search log templates…"
                  className={cn(dsInputClass, "pl-9")}
                  aria-label="Search log templates"
                />
              </div>
            </div>

            <DataTableCard>
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className={dataTableHeadRowClass}>
                    <th className={TH}>Name</th>
                    <th className={TH}>Last entry</th>
                    <th className={TH}>Entries</th>
                    <th className={`${TH} text-right`}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {store.logTemplates.length === 0 ? (
                    <tr>
                      <td className={cn(TD, "bg-ds-secondary/40")} colSpan={4}>
                        <Card variant="secondary" padding="lg" className="border-dashed border-ds-border/80 text-center">
                          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-ds-border bg-ds-primary text-ds-muted">
                            <Inbox className="h-6 w-6" aria-hidden />
                          </div>
                          <p className="mt-3 text-sm font-semibold text-ds-foreground">No log templates yet</p>
                          <p className="mt-1 text-sm text-ds-muted">
                            Standardize what gets captured on every shift so supervisors can compare apples to apples.
                          </p>
                          <button
                            type="button"
                            className={cn(
                              buttonVariants({ surface: "light", intent: "accent" }),
                              "mt-5 inline-flex min-h-[44px] items-center justify-center px-5 py-2.5 text-sm font-semibold shadow-sm",
                            )}
                            onClick={openNewLog}
                          >
                            Create first log template
                          </button>
                        </Card>
                      </td>
                    </tr>
                  ) : filteredLogTemplates.length === 0 ? (
                    <tr>
                      <td className={cn(TD, "text-ds-muted")} colSpan={4}>
                        {`No templates match "${logTemplateQuery.trim()}".`}
                      </td>
                    </tr>
                  ) : (
                    filteredLogTemplates.map((tpl) => (
                      <tr key={tpl.id} className={dataTableBodyRow()}>
                        <td className={cn(TD, "align-top")}>
                          <span className="font-semibold text-ds-foreground">{tpl.name}</span>
                          {tpl.description ? (
                            <p className="mt-1 text-xs leading-snug text-ds-muted">{tpl.description}</p>
                          ) : null}
                          <p className="mt-2 text-[11px] font-semibold uppercase tracking-wide text-ds-muted">
                            {tpl.fields.length} field{tpl.fields.length === 1 ? "" : "s"}
                          </p>
                        </td>
                        <td className={cn(TD, "align-top text-ds-muted")}>{formatWhen(store.lastAt(tpl.id))}</td>
                        <td className={cn(TD, "align-top font-medium tabular-nums text-ds-foreground")}>
                          {store.entryCount(tpl.id)}
                        </td>
                        <td className={cn(TD, "align-top text-right")}>
                          <div className="flex flex-wrap items-center justify-end gap-2">
                            <button
                              type="button"
                              className={LINKISH}
                              onClick={() => setLogFill(tpl)}
                              disabled={tpl.fields.length === 0}
                            >
                              New entry
                            </button>
                            <button
                              type="button"
                              className={LINKISH}
                              onClick={() => setBuilder({ kind: "log", editId: tpl.id })}
                            >
                              <Pencil className="mr-0.5 inline h-3.5 w-3.5" aria-hidden />
                              Edit
                            </button>
                            <button
                              type="button"
                              className="text-xs font-semibold text-red-700 hover:underline dark:text-red-400"
                              onClick={() => {
                                if (confirm(`Delete template “${tpl.name}”?`)) store.removeTemplate(tpl.id);
                              }}
                            >
                              <Trash2 className="mr-0.5 inline h-3.5 w-3.5" aria-hidden />
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </DataTableCard>
          </motion.section>

          <motion.section
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1], delay: 0.03 }}
            className="space-y-3"
          >
            <div className="border-b border-ds-border/80 pb-3">
              <h2 className="text-base font-semibold text-ds-foreground">Submitted log entries</h2>
              <p className="mt-0.5 text-sm text-ds-muted">Immutable submissions with automatic timestamps.</p>
            </div>

            <DataTableCard>
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className={dataTableHeadRowClass}>
                    <th className={TH}>Template</th>
                    <th className={TH}>Status</th>
                    <th className={TH}>Submitted</th>
                    <th className={TH}>By</th>
                    <th className={`${TH} text-right`}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {logEntries.length === 0 ? (
                    <tr>
                      <td className={cn(TD, "text-ds-muted")} colSpan={5}>
                        No log entries yet. Pick a template and capture your first field reading.
                      </td>
                    </tr>
                  ) : (
                    [...logEntries]
                      .sort(
                        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
                      )
                      .map((entry) => {
                        const tpl = store.logTemplates.find((t) => t.id === entry.template_id);
                        return (
                          <tr key={entry.id} className={dataTableBodyRow()}>
                            <td className={cn(TD, "align-top font-medium text-ds-foreground")}>
                              {tpl?.name ?? entry.template_id}
                            </td>
                            <td className={cn(TD, "align-top")}>
                              <StatusBadge variant="success">Submitted</StatusBadge>
                            </td>
                            <td className={cn(TD, "align-top")}>
                              <span className="font-medium text-ds-foreground">
                                {formatRelativeWhen(entry.created_at)}
                              </span>
                              <p className="mt-0.5 text-xs text-ds-muted">{formatWhen(entry.created_at)}</p>
                            </td>
                            <td className={cn(TD, "align-top")}>
                              <div className="flex items-center gap-2">
                                <span
                                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-ds-border bg-ds-primary text-[11px] font-bold text-ds-foreground"
                                  aria-hidden
                                >
                                  {userInitials(entry.user_id)}
                                </span>
                                <span className="min-w-0 truncate text-sm text-ds-muted">{entry.user_id ?? "—"}</span>
                              </div>
                            </td>
                            <td className={cn(TD, "align-top text-right")}>
                              <button type="button" className={LINKISH} onClick={() => setViewEntry(entry)}>
                                <Eye className="mr-0.5 inline h-3.5 w-3.5" aria-hidden />
                                View
                              </button>
                            </td>
                          </tr>
                        );
                      })
                  )}
                </tbody>
              </table>
            </DataTableCard>
          </motion.section>
        </div>
      ) : null}

      {inspectFill ? (
        <InspectionFillModal
          key={inspectFill.id}
          template={inspectFill}
          onClose={() => setInspectFill(null)}
          onSubmit={(values) => {
            store.addEntry({
              template_id: inspectFill.id,
              template_type: "inspection",
              values,
              created_at: new Date().toISOString(),
              user_id: userId,
            });
            setInspectFill(null);
          }}
        />
      ) : null}

      {logFill ? (
        <LogFillModal
          key={logFill.id}
          template={logFill}
          onClose={() => setLogFill(null)}
          onSubmit={(values) => {
            store.addEntry({
              template_id: logFill.id,
              template_type: "log",
              values,
              created_at: new Date().toISOString(),
              user_id: userId,
            });
            setLogFill(null);
          }}
        />
      ) : null}

      {viewEntry ? (
        <EntryViewModal entry={viewEntry} templates={store.templates} onClose={() => setViewEntry(null)} />
      ) : null}
    </div>
  );
}

function defaultInspectionValue(responseType: InspectionItemResponseType | undefined): unknown {
  const rt = responseType ?? "checkbox";
  if (rt === "checkbox") return false;
  if (rt === "yes_no") return "";
  return "";
}

function InspectionFillModal({
  template,
  onClose,
  onSubmit,
}: {
  template: InspectionTemplate;
  onClose: () => void;
  onSubmit: (values: Record<string, unknown>) => void;
}) {
  const [values, setValues] = useState<Record<string, unknown>>(() => {
    const o: Record<string, unknown> = {};
    template.checklist_items.forEach((i) => {
      o[i.id] = defaultInspectionValue(i.response_type);
    });
    return o;
  });

  const inputCls =
    "mt-1.5 w-full rounded-md border border-ds-border bg-ds-primary px-3 py-2 text-sm text-ds-foreground focus:border-ds-success/40 focus:outline-none focus:ring-2 focus:ring-[var(--ds-focus-ring)]";

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
      <button
        type="button"
        className="ds-modal-backdrop absolute inset-0 backdrop-blur-[2px]"
        aria-label="Close"
        onClick={onClose}
      />
      <div className="app-glass-elevated relative max-h-[90vh] w-full max-w-lg overflow-auto rounded-md p-6">
        <h3 className="text-lg font-semibold text-ds-foreground">Submit inspection — {template.name}</h3>
        <p className="mt-1 text-xs text-ds-muted">Complete each line according to its type.</p>
        <ul className="mt-4 space-y-4">
          {template.checklist_items
            .slice()
            .sort((a, b) => a.order - b.order)
            .map((item) => {
              const rt: InspectionItemResponseType = item.response_type ?? "checkbox";
              const id = `inspection-${item.id}`;
              if (rt === "checkbox") {
                return (
                  <li key={item.id} className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      id={id}
                      className="mt-1 h-4 w-4 rounded border-ds-border text-ds-success focus:ring-2 focus:ring-[var(--ds-focus-ring)]"
                      checked={values[item.id] === true}
                      onChange={(e) => setValues((c) => ({ ...c, [item.id]: e.target.checked }))}
                    />
                    <label htmlFor={id} className="text-sm text-ds-foreground">
                      {item.label}
                    </label>
                  </li>
                );
              }
              if (rt === "yes_no") {
                return (
                  <li key={item.id}>
                    <label htmlFor={id} className="text-[11px] font-semibold uppercase tracking-wider text-ds-muted">
                      {item.label}
                    </label>
                    <select
                      id={id}
                      className={inputCls}
                      value={typeof values[item.id] === "string" ? (values[item.id] as string) : ""}
                      onChange={(e) => setValues((c) => ({ ...c, [item.id]: e.target.value }))}
                    >
                      <option value="">— Select —</option>
                      <option value="yes">Yes</option>
                      <option value="no">No</option>
                    </select>
                  </li>
                );
              }
              if (rt === "notes") {
                return (
                  <li key={item.id}>
                    <label htmlFor={id} className="text-[11px] font-semibold uppercase tracking-wider text-ds-muted">
                      {item.label}
                    </label>
                    <textarea
                      id={id}
                      className={`${inputCls} min-h-[4.5rem] resize-y`}
                      rows={3}
                      value={typeof values[item.id] === "string" ? (values[item.id] as string) : ""}
                      onChange={(e) => setValues((c) => ({ ...c, [item.id]: e.target.value }))}
                    />
                  </li>
                );
              }
              if (rt === "number") {
                return (
                  <li key={item.id}>
                    <label htmlFor={id} className="text-[11px] font-semibold uppercase tracking-wider text-ds-muted">
                      {item.label}
                    </label>
                    <input
                      id={id}
                      type="number"
                      className={inputCls}
                      value={values[item.id] === undefined || values[item.id] === "" ? "" : String(values[item.id])}
                      onChange={(e) =>
                        setValues((c) => ({
                          ...c,
                          [item.id]: e.target.value === "" ? "" : Number(e.target.value),
                        }))
                      }
                    />
                  </li>
                );
              }
              return (
                <li key={item.id}>
                  <label htmlFor={id} className="text-[11px] font-semibold uppercase tracking-wider text-ds-muted">
                    {item.label}
                  </label>
                  <input
                    id={id}
                    type="text"
                    className={inputCls}
                    value={typeof values[item.id] === "string" ? (values[item.id] as string) : ""}
                    onChange={(e) => setValues((c) => ({ ...c, [item.id]: e.target.value }))}
                  />
                </li>
              );
            })}
        </ul>
        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            className="rounded-md border border-ds-border bg-ds-secondary px-4 py-2 text-sm font-semibold text-ds-foreground"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className={cn(buttonVariants({ surface: "light", intent: "accent" }), "px-4 py-2 text-sm font-semibold")}
            onClick={() => onSubmit(values)}
          >
            Save completion
          </button>
        </div>
      </div>
    </div>
  );
}

function defaultLogValue(fieldType: LogFieldType): unknown {
  if (fieldType === "checkbox") return false;
  if (fieldType === "yes_no") return "";
  return "";
}

function LogFillModal({
  template,
  onClose,
  onSubmit,
}: {
  template: LogTemplate;
  onClose: () => void;
  onSubmit: (values: Record<string, unknown>) => void;
}) {
  const sorted = useMemo(
    () => [...template.fields].sort((a, b) => a.order - b.order),
    [template.fields],
  );
  const [vals, setVals] = useState<Record<string, unknown>>(() => {
    const o: Record<string, unknown> = {};
    sorted.forEach((f) => {
      o[f.id] = defaultLogValue(f.type);
    });
    return o;
  });

  const inputCls =
    "mt-1.5 w-full rounded-md border border-ds-border bg-ds-primary px-3 py-2 text-sm text-ds-foreground focus:border-ds-success/40 focus:outline-none focus:ring-2 focus:ring-[var(--ds-focus-ring)]";

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
      <button
        type="button"
        className="ds-modal-backdrop absolute inset-0 backdrop-blur-[2px]"
        aria-label="Close"
        onClick={onClose}
      />
      <div className="app-glass-elevated relative max-h-[90vh] w-full max-w-lg overflow-auto rounded-md p-6">
        <h3 className="text-lg font-semibold text-ds-foreground">New log entry — {template.name}</h3>
        <p className="mt-1 text-xs text-ds-muted">Timestamp is saved automatically when you submit.</p>
        <div className="mt-4 space-y-4">
          {sorted.map((field: LogFieldDef) => {
            const id = `log-field-${field.id}`;
            const label = (
              <label htmlFor={id} className="text-[11px] font-semibold uppercase tracking-wider text-ds-muted">
                {field.label || "Field"}
              </label>
            );

            if (field.type === "checkbox") {
              return (
                <div key={field.id} className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    id={id}
                    className="mt-1 h-4 w-4 rounded border-ds-border text-ds-success focus:ring-2 focus:ring-[var(--ds-focus-ring)]"
                    checked={vals[field.id] === true}
                    onChange={(e) => setVals((s) => ({ ...s, [field.id]: e.target.checked }))}
                  />
                  <label htmlFor={id} className="text-sm text-ds-foreground">
                    {field.label || "Field"}
                  </label>
                </div>
              );
            }

            if (field.type === "yes_no") {
              return (
                <div key={field.id}>
                  {label}
                  <select
                    id={id}
                    className={inputCls}
                    value={typeof vals[field.id] === "string" ? (vals[field.id] as string) : ""}
                    onChange={(e) => setVals((s) => ({ ...s, [field.id]: e.target.value }))}
                  >
                    <option value="">— Select —</option>
                    <option value="yes">Yes</option>
                    <option value="no">No</option>
                  </select>
                </div>
              );
            }

            if (field.type === "notes") {
              return (
                <div key={field.id}>
                  {label}
                  <textarea
                    id={id}
                    className={`${inputCls} min-h-[4.5rem] resize-y`}
                    rows={3}
                    value={typeof vals[field.id] === "string" ? (vals[field.id] as string) : ""}
                    onChange={(e) => setVals((s) => ({ ...s, [field.id]: e.target.value }))}
                  />
                </div>
              );
            }

            if (field.type === "number") {
              return (
                <div key={field.id}>
                  {label}
                  <input
                    id={id}
                    type="number"
                    className={inputCls}
                    value={
                      vals[field.id] === undefined || vals[field.id] === "" ? "" : String(vals[field.id])
                    }
                    onChange={(e) =>
                      setVals((s) => ({
                        ...s,
                        [field.id]: e.target.value === "" ? "" : Number(e.target.value),
                      }))
                    }
                  />
                </div>
              );
            }

            return (
              <div key={field.id}>
                {label}
                <input
                  id={id}
                  type="text"
                  className={inputCls}
                  value={typeof vals[field.id] === "string" ? (vals[field.id] as string) : ""}
                  onChange={(e) => setVals((s) => ({ ...s, [field.id]: e.target.value }))}
                />
              </div>
            );
          })}
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            className="rounded-md border border-ds-border bg-ds-secondary px-4 py-2 text-sm font-semibold text-ds-foreground"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className={cn(buttonVariants({ surface: "light", intent: "accent" }), "px-4 py-2 text-sm font-semibold")}
            onClick={() => {
              const out: Record<string, unknown> = { ...vals };
              sorted.forEach((f) => {
                if (f.type === "number" && out[f.id] !== undefined && out[f.id] !== "") {
                  const n = Number(out[f.id]);
                  out[f.id] = Number.isFinite(n) ? n : out[f.id];
                }
              });
              onSubmit(out);
            }}
          >
            Submit entry
          </button>
        </div>
      </div>
    </div>
  );
}

function EntryViewModal({
  entry,
  templates,
  onClose,
}: {
  entry: EntryRecord;
  templates: import("@/lib/inspectionsLogsTypes").TemplateUnion[];
  onClose: () => void;
}) {
  const tpl = templates.find((t) => t.id === entry.template_id);

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
      <button
        type="button"
        className="ds-modal-backdrop absolute inset-0 backdrop-blur-[2px]"
        aria-label="Close"
        onClick={onClose}
      />
      <div className="app-glass-elevated relative max-h-[90vh] w-full max-w-lg overflow-auto rounded-md p-6">
        <h3 className="text-lg font-semibold text-ds-foreground">Record detail</h3>
        <p className="mt-1 text-xs text-ds-muted">
          {tpl?.name ?? "Template"} · {formatWhen(entry.created_at)}
        </p>
        <dl className="mt-4 space-y-3 text-sm">
          {entry.template_type === "inspection" && tpl && tpl.type === "inspection"
            ? tpl.checklist_items
                .slice()
                .sort((a, b) => a.order - b.order)
                .map((item) => {
                  const rt = item.response_type ?? "checkbox";
                  const v = entry.values[item.id];
                  let shown: string;
                  if (rt === "checkbox") shown = v === true ? "✓" : "—";
                  else if (rt === "yes_no")
                    shown = v === "yes" ? "Yes" : v === "no" ? "No" : "—";
                  else if (v === undefined || v === null || v === "") shown = "—";
                  else shown = String(v);
                  return (
                    <div key={item.id} className="flex justify-between gap-4 border-b border-ds-border pb-2">
                      <dt className="text-ds-muted">{item.label}</dt>
                      <dd className="max-w-[55%] text-right font-medium text-ds-foreground">{shown}</dd>
                    </div>
                  );
                })
            : null}
          {entry.template_type === "log" && tpl && tpl.type === "log"
            ? tpl.fields
                .slice()
                .sort((a, b) => a.order - b.order)
                .map((f) => {
                  const v = entry.values[f.id];
                  let shown: string;
                  if (f.type === "checkbox") shown = v === true ? "✓" : "—";
                  else if (f.type === "yes_no")
                    shown = v === "yes" ? "Yes" : v === "no" ? "No" : "—";
                  else if (v === undefined || v === null || v === "") shown = "—";
                  else shown = String(v);
                  return (
                    <div key={f.id} className="border-b border-ds-border pb-2">
                      <dt className="text-ds-muted">{f.label}</dt>
                      <dd className="mt-1 font-medium text-ds-foreground">{shown}</dd>
                    </div>
                  );
                })
            : null}
        </dl>
        <div className="mt-6 flex justify-end">
          <button
            type="button"
            className="rounded-md border border-ds-border bg-ds-secondary px-4 py-2 text-sm font-semibold text-ds-foreground"
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
