"use client";

import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, ClipboardList, Eye, Pencil, Trash2 } from "lucide-react";
import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
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
import { CreateDropdown } from "./CreateDropdown";
import { InspectionBuilder } from "./InspectionBuilder";
import { LogBuilder } from "./LogBuilder";
import { cn } from "@/lib/cn";
import { buttonVariants } from "@/styles/button-variants";
import {
  VehicleInspectionSheet,
  type VehicleInspectionArchivePayload,
} from "@/components/inspections/VehicleInspectionSheet";
import { HarnessInspectionForm } from "@/components/compliance/HarnessInspectionForm";

const TABLE_WRAP =
  "mt-6 overflow-hidden rounded-md border border-ds-border bg-white shadow-sm dark:bg-ds-secondary";
const TH =
  "bg-ds-primary px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-ds-muted";
const TD = "bg-white px-4 py-3 text-sm text-ds-foreground dark:bg-ds-secondary";
const ROW =
  "ds-table-row-hover border-t border-ds-border bg-white transition-colors dark:bg-ds-secondary";
const LINKISH =
  "ds-link text-xs font-semibold disabled:opacity-40";

/** Match schedule “Show” segmented control (`ScheduleApp` workers/projects/combined). */
const SEGMENT_TRACK =
  "flex flex-wrap rounded-md border border-pulseShell-border bg-pulseShell-surface p-1 shadow-[var(--pulse-shell-shadow)]";
const SEGMENT_ACTIVE =
  "bg-[var(--pulse-segment-active-bg)] text-[var(--pulse-segment-active-fg)] shadow-sm ring-1 ring-[color-mix(in_srgb,var(--ds-success)_28%,transparent)] dark:ring-sky-400/30";
const SEGMENT_IDLE =
  "text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:text-slate-400 dark:hover:bg-white/[0.06] dark:hover:text-slate-100";

const ARCHIVE_ROLE_TAGS = [
  { id: "lead", label: "Lead" },
  { id: "supervisor", label: "Supervisor" },
  { id: "manager", label: "Manager" },
  { id: "company_admin", label: "Company admin" },
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

function BtnRow({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-center gap-2">{children}</div>;
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
    <div className="space-y-8">
      <PageHeader
        title="Inspections & Logs"
        description="Create checklists and log forms, then record completions in one place."
        icon={ClipboardList}
        actions={<CreateDropdown onNewInspection={openNewInspection} onNewLog={openNewLog} />}
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

      <nav className={SEGMENT_TRACK} aria-label="Module tabs">
        <button
          type="button"
          className={`rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
            tab === "inspections" ? SEGMENT_ACTIVE : SEGMENT_IDLE
          }`}
          onClick={() => {
            setTab("inspections");
            setBuilder(null);
          }}
        >
          Inspections
        </button>
        <button
          type="button"
          className={`rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
            tab === "logs" ? SEGMENT_ACTIVE : SEGMENT_IDLE
          }`}
          onClick={() => {
            setTab("logs");
            setBuilder(null);
          }}
        >
          Logs
        </button>
        <button
          type="button"
          className={`inline-flex max-w-full flex-wrap items-center gap-x-2 gap-y-1 rounded-lg px-3 py-2 text-left text-sm font-semibold transition-colors ${
            tab === "archive" ? SEGMENT_ACTIVE : SEGMENT_IDLE
          }`}
          onClick={() => {
            setTab("archive");
            setBuilder(null);
          }}
        >
          <span>Archive</span>
        </button>
      </nav>

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
        <>
          <section className="rounded-md border border-ds-border bg-white p-4 shadow-sm dark:bg-ds-secondary">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-sm font-semibold text-ds-foreground">Digital Vehicle Inspection</h2>
                <p className="mt-0.5 text-xs font-medium text-ds-muted">
                  Premium tablet-first inspection sheet (mock local state).
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className={cn(buttonVariants({ surface: "light", intent: "secondary" }), "px-3 py-2 text-sm")}
                  onClick={() => setShowVehicleInspection((v) => !v)}
                >
                  {showVehicleInspection ? "Hide sheet" : "New vehicle inspection"}
                </button>
              </div>
            </div>
            {showVehicleInspection ? (
              <div className="mt-4">
                <VehicleInspectionSheet key={vehicleSheetKey} onArchived={onVehicleInspectionArchived} />
              </div>
            ) : null}
          </section>

          <section className="rounded-md border border-ds-border bg-white p-4 shadow-sm dark:bg-ds-secondary">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-sm font-semibold text-ds-foreground">Harness Inspection</h2>
                <p className="mt-0.5 text-xs font-medium text-ds-muted">
                  Mobile-friendly fall-protection harness inspection form (client-side submit for now).
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className={cn(buttonVariants({ surface: "light", intent: "secondary" }), "px-3 py-2 text-sm")}
                  onClick={() => setShowHarnessInspection((v) => !v)}
                >
                  {showHarnessInspection ? "Hide form" : "New harness inspection"}
                </button>
              </div>
            </div>
            {showHarnessInspection ? (
              <div className="mt-4">
                <HarnessInspectionForm
                  onSubmit={(payload) => {
                    // Temporary client-side integration point. Backend saving will plug in here.
                    // eslint-disable-next-line no-console
                    console.log("Harness inspection submit", payload);
                    window.alert("Harness inspection captured (client-side). Ready to wire into Work Items.");
                  }}
                />
              </div>
            ) : null}
          </section>

          <section>
            <h2 className="text-sm font-semibold text-ds-muted">Inspection templates</h2>
            <div className={TABLE_WRAP}>
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="bg-ds-primary">
                    <th className={TH}>Name</th>
                    <th className={TH}>Last completed</th>
                    <th className={TH}>Frequency</th>
                    <th className={`${TH} text-right`}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {store.inspectionTemplates.length === 0 ? (
                    <tr>
                      <td className={`${TD} text-ds-muted`} colSpan={4}>
                        No inspection templates yet. Create one to get started.
                      </td>
                    </tr>
                  ) : (
                    store.inspectionTemplates.map((tpl) => (
                      <tr key={tpl.id} className={ROW}>
                        <td className={TD}>
                          <span className="font-medium">{tpl.name}</span>
                          {tpl.description ? (
                            <p className="mt-0.5 text-xs text-ds-muted">{tpl.description}</p>
                          ) : null}
                        </td>
                        <td className={`${TD} text-ds-muted`}>{formatWhen(store.lastAt(tpl.id))}</td>
                        <td className={`${TD} text-ds-muted`}>{tpl.frequency?.trim() || "—"}</td>
                        <td className={`${TD} text-right`}>
                          <BtnRow>
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
                              className="text-xs font-semibold text-red-700 dark:text-red-400 hover:underline"
                              onClick={() => {
                                if (confirm(`Delete template “${tpl.name}”?`)) store.removeTemplate(tpl.id);
                              }}
                            >
                              <Trash2 className="mr-0.5 inline h-3.5 w-3.5" aria-hidden />
                              Delete
                            </button>
                          </BtnRow>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h2 className="text-sm font-semibold text-ds-muted">Completed inspections</h2>
            <div className={TABLE_WRAP}>
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="bg-ds-primary">
                    <th className={TH}>Template</th>
                    <th className={TH}>Completed</th>
                    <th className={TH}>By</th>
                    <th className={`${TH} text-right`}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {inspectionEntries.length === 0 ? (
                    <tr>
                      <td className={`${TD} text-ds-muted`} colSpan={4}>
                        No completed inspections yet.
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
                          <tr key={entry.id} className={ROW}>
                            <td className={TD}>{tpl?.name ?? entry.template_id}</td>
                            <td className={`${TD} text-ds-muted`}>{formatWhen(entry.created_at)}</td>
                            <td className={`${TD} text-ds-muted`}>{entry.user_id ?? "—"}</td>
                            <td className={`${TD} text-right`}>
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
            </div>
          </section>
        </>
      ) : null}

      {!builder && tab === "archive" ? (
        <section className="space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-ds-foreground">Inspection archive</h2>
            <p className="mt-1 max-w-2xl text-xs font-medium text-ds-muted">
              Vehicle inspections you submit are listed here. Access is intended for{" "}
              {ARCHIVE_ROLE_TAGS.map((r) => r.label).join(", ")}.
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {ARCHIVE_ROLE_TAGS.map((r) => (
                <span
                  key={r.id}
                  className="rounded-lg border border-ds-border/60 bg-ds-secondary/70 px-2 py-1 text-[11px] font-semibold text-ds-foreground"
                >
                  {r.label}
                </span>
              ))}
            </div>
          </div>
          <div className={TABLE_WRAP}>
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="bg-ds-primary">
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
                    <td className={`${TD} text-ds-muted`} colSpan={7}>
                      No archived vehicle inspections yet. Submit a digital vehicle inspection to see it here.
                    </td>
                  </tr>
                ) : (
                  vehicleArchive.map((row) => (
                    <tr key={row.id} className={ROW}>
                      <td className={TD}>
                        <span className="font-medium">{row.vehicle}</span>
                      </td>
                      <td className={TD}>{row.operatorName}</td>
                      <td className={`${TD} text-ds-muted`}>{row.department}</td>
                      <td className={`${TD} text-ds-muted`}>{formatWhen(row.submittedAtIso)}</td>
                      <td className={`${TD} tabular-nums text-ds-muted`}>
                        {row.distanceKm === null ? "—" : `${row.distanceKm} km`}
                      </td>
                      <td className={`${TD} text-ds-muted`}>{row.timeOutDuration ?? "—"}</td>
                      <td className={`${TD} text-ds-muted`}>{row.submittedBy ?? "—"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {!builder && tab === "logs" ? (
        <>
          <section>
            <h2 className="text-sm font-semibold text-ds-muted">Log templates</h2>
            <div className={TABLE_WRAP}>
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="bg-ds-primary">
                    <th className={TH}>Name</th>
                    <th className={TH}>Last entry</th>
                    <th className={TH}>Entries</th>
                    <th className={`${TH} text-right`}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {store.logTemplates.length === 0 ? (
                    <tr>
                      <td className={`${TD} text-ds-muted`} colSpan={4}>
                        No log templates yet.
                      </td>
                    </tr>
                  ) : (
                    store.logTemplates.map((tpl) => (
                      <tr key={tpl.id} className={ROW}>
                        <td className={TD}>
                          <span className="font-medium">{tpl.name}</span>
                          {tpl.description ? (
                            <p className="mt-0.5 text-xs text-ds-muted">{tpl.description}</p>
                          ) : null}
                        </td>
                        <td className={`${TD} text-ds-muted`}>{formatWhen(store.lastAt(tpl.id))}</td>
                        <td className={TD}>{store.entryCount(tpl.id)}</td>
                        <td className={`${TD} text-right`}>
                          <BtnRow>
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
                              className="text-xs font-semibold text-red-700 dark:text-red-400 hover:underline"
                              onClick={() => {
                                if (confirm(`Delete template “${tpl.name}”?`)) store.removeTemplate(tpl.id);
                              }}
                            >
                              <Trash2 className="mr-0.5 inline h-3.5 w-3.5" aria-hidden />
                              Delete
                            </button>
                          </BtnRow>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h2 className="text-sm font-semibold text-ds-muted">Submitted log entries</h2>
            <div className={TABLE_WRAP}>
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="bg-ds-primary">
                    <th className={TH}>Template</th>
                    <th className={TH}>Submitted</th>
                    <th className={TH}>By</th>
                    <th className={`${TH} text-right`}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {logEntries.length === 0 ? (
                    <tr>
                      <td className={`${TD} text-ds-muted`} colSpan={4}>
                        No log entries yet.
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
                          <tr key={entry.id} className={ROW}>
                            <td className={TD}>{tpl?.name ?? entry.template_id}</td>
                            <td className={`${TD} text-ds-muted`}>{formatWhen(entry.created_at)}</td>
                            <td className={`${TD} text-ds-muted`}>{entry.user_id ?? "—"}</td>
                            <td className={`${TD} text-right`}>
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
            </div>
          </section>
        </>
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
