"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ExternalLink, Loader2, Plus, Trash2 } from "lucide-react";
import { PulseDrawer } from "@/components/schedule/PulseDrawer";
import {
  ACTION_STATUS_LABELS,
  ANALYSIS_TYPE_LABELS,
  CATEGORY_LABELS,
  PRIORITY_LABELS,
  STATUS_LABELS,
  statusBadgeClass,
} from "@/lib/operational-improvements/labels";
import { GuidedAnalysisEditor } from "@/components/operational-improvements/analysis-forms";
import { PrioritizationPanel } from "@/components/operational-improvements/PrioritizationPanel";
import { ScorecardPanel } from "@/components/operational-improvements/ScorecardPanel";
import { defaultAnalysisData } from "@/lib/operational-improvements/analysis-defaults";
import {
  createOperationalImprovementAction,
  createOperationalImprovementAnalysis,
  createOperationalImprovementAttachment,
  createPlaybookFromImprovement,
  deleteOperationalImprovementAction,
  deleteOperationalImprovementAnalysis,
  deleteOperationalImprovementAttachment,
  getOperationalImprovement,
  patchOperationalImprovement,
  patchOperationalImprovementAction,
  patchOperationalImprovementAnalysis,
} from "@/lib/operational-improvements/api";
import type {
  OperationalImprovementAnalysisType,
  OperationalImprovementRow,
} from "@/lib/operational-improvements/types";
import { getImprovementTemplate, seedScorecardFromTemplate, type ImprovementTemplateId } from "@/lib/operational-improvements/templates";
import type { PrioritizationScores } from "@/lib/operational-improvements/prioritization";
import { OI_ANALYSIS_TYPES, OI_STATUSES } from "@/lib/operational-improvements/types";
import { createWorkRequest } from "@/lib/workRequestsService";
import { pulseAppHref } from "@/lib/pulse-app";
import { cn } from "@/lib/cn";
import { buttonVariants } from "@/styles/button-variants";

const FIELD =
  "mt-1.5 w-full rounded-[10px] border border-slate-200/90 bg-white px-3 py-2.5 text-sm shadow-sm focus:border-[#2B4C7E]/35 focus:outline-none focus:ring-1 focus:ring-[#2B4C7E]/25 dark:border-ds-border dark:bg-ds-secondary dark:text-ds-foreground";
const LABEL = "text-[11px] font-semibold uppercase tracking-wider text-ds-muted";
const PRIMARY = cn(buttonVariants({ surface: "light", intent: "accent" }), "inline-flex items-center gap-1.5 px-3 py-2 text-sm font-bold");
const GHOST = cn(buttonVariants({ surface: "light", intent: "secondary" }), "inline-flex items-center gap-1.5 px-2 py-1.5 text-xs font-semibold");

type Phase = "identification" | "analysis" | "plan" | "implementation" | "measurement";

const PHASES: { id: Phase; label: string }[] = [
  { id: "identification", label: "Opportunity" },
  { id: "analysis", label: "Analysis" },
  { id: "plan", label: "Plan" },
  { id: "implementation", label: "Implementation" },
  { id: "measurement", label: "Results" },
];

type Props = {
  improvementId: string | null;
  open: boolean;
  onClose: () => void;
  onUpdated: () => void;
  onToast: (message: string) => void;
  canManage: boolean;
};

export function OperationalImprovementDetailPanel({
  improvementId,
  open,
  onClose,
  onUpdated,
  onToast,
  canManage,
}: Props) {
  const [row, setRow] = useState<OperationalImprovementRow | null>(null);
  const [loading, setLoading] = useState(false);
  const [phase, setPhase] = useState<Phase>("identification");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!improvementId) return;
    setLoading(true);
    try {
      setRow(await getOperationalImprovement(improvementId));
    } catch (e) {
      onToast(e instanceof Error ? e.message : "Could not load improvement.");
    } finally {
      setLoading(false);
    }
  }, [improvementId, onToast]);

  useEffect(() => {
    if (open && improvementId) void load();
    if (!open) setRow(null);
  }, [open, improvementId, load]);

  async function savePatch(patch: Parameters<typeof patchOperationalImprovement>[1]) {
    if (!row || !canManage) return;
    setBusy(true);
    try {
      const updated = await patchOperationalImprovement(row.id, patch);
      setRow(updated);
      onUpdated();
      onToast("Saved.");
    } catch (e) {
      onToast(e instanceof Error ? e.message : "Save failed.");
    } finally {
      setBusy(false);
    }
  }

  async function addAnalysis(type: OperationalImprovementAnalysisType) {
    if (!row || !canManage) return;
    setBusy(true);
    try {
      await createOperationalImprovementAnalysis(row.id, {
        analysis_type: type,
        title: ANALYSIS_TYPE_LABELS[type],
        data: defaultAnalysisData(type),
      });
      await load();
      onUpdated();
      onToast("Analysis record added.");
    } catch (e) {
      onToast(e instanceof Error ? e.message : "Could not add analysis.");
    } finally {
      setBusy(false);
    }
  }

  async function addAction() {
    if (!row || !canManage) return;
    const action = window.prompt("Improvement action");
    if (!action?.trim()) return;
    setBusy(true);
    try {
      await createOperationalImprovementAction(row.id, { action: action.trim() });
      await load();
      onUpdated();
    } catch (e) {
      onToast(e instanceof Error ? e.message : "Could not add action.");
    } finally {
      setBusy(false);
    }
  }

  async function createWrForAction(actionId: string, title: string) {
    if (!row || !canManage) return;
    setBusy(true);
    try {
      const wr = await createWorkRequest(row.company_id, {
        title: `[OI] ${title}`,
        description: row.description ?? undefined,
        priority: row.priority === "critical" ? "critical" : row.priority === "high" ? "high" : "medium",
      });
      await patchOperationalImprovementAction(actionId, { linked_work_request_id: wr.id });
      await load();
      onUpdated();
      onToast("Work request linked.");
    } catch (e) {
      onToast(e instanceof Error ? e.message : "Could not create work request.");
    } finally {
      setBusy(false);
    }
  }

  async function createPlaybook() {
    if (!row || !canManage) return;
    setBusy(true);
    try {
      await createPlaybookFromImprovement(row.id);
      onToast("Playbook created — find it under Playbooks.");
      onUpdated();
    } catch (e) {
      onToast(e instanceof Error ? e.message : "Could not create playbook.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <PulseDrawer open={open} onClose={onClose} title={row?.display_id ?? "Improvement"} wide>
      {loading || !row ? (
        <div className="flex items-center gap-2 py-10 text-sm text-ds-muted">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Loading…
        </div>
      ) : (
        <div className="space-y-4 pb-8">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold uppercase", statusBadgeClass(row.status))}>
                {STATUS_LABELS[row.status]}
              </span>
              <span className="text-xs text-ds-muted">{CATEGORY_LABELS[row.category]} · {PRIORITY_LABELS[row.priority]}</span>
            </div>
            <h2 className="mt-2 text-lg font-bold text-ds-foreground">{row.title}</h2>
            {canManage ? (
              <div className="mt-3 flex flex-wrap gap-2">
                <select
                  className={cn(FIELD, "mt-0 w-auto")}
                  value={row.status}
                  disabled={busy}
                  onChange={(e) => void savePatch({ status: e.target.value as OperationalImprovementRow["status"] })}
                >
                  {OI_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {STATUS_LABELS[s]}
                    </option>
                  ))}
                </select>
                <button type="button" className={PRIMARY} disabled={busy} onClick={() => void createPlaybook()}>
                  Save as playbook
                </button>
                <button
                  type="button"
                  className={PRIMARY}
                  disabled={busy}
                  onClick={() =>
                    void savePatch({
                      knowledge_base_published: true,
                      status: row.status === "completed" ? "completed" : "awaiting_review",
                    })
                  }
                >
                  Publish to knowledge base
                </button>
              </div>
            ) : null}
          </div>

          <nav className="flex flex-wrap gap-1 border-b border-ds-border pb-1" role="tablist">
            {PHASES.map((p) => (
              <button
                key={p.id}
                type="button"
                role="tab"
                aria-selected={phase === p.id}
                className={cn(
                  "rounded-t-lg px-3 py-2 text-xs font-semibold",
                  phase === p.id ? "bg-ds-accent/10 text-ds-accent" : "text-ds-muted hover:text-ds-foreground",
                )}
                onClick={() => setPhase(p.id)}
              >
                {p.label}
              </button>
            ))}
          </nav>

          {phase === "identification" ? (
            <IdentificationPhase row={row} canManage={canManage} busy={busy} onSave={savePatch} />
          ) : null}
          {phase === "analysis" ? (
            <AnalysisPhase row={row} canManage={canManage} busy={busy} onAdd={addAnalysis} onReload={load} onToast={onToast} />
          ) : null}
          {phase === "plan" ? (
            <PlanPhase row={row} canManage={canManage} busy={busy} onAdd={addAction} onCreateWr={createWrForAction} onReload={load} onToast={onToast} />
          ) : null}
          {phase === "implementation" ? (
            <ImplementationPhase row={row} canManage={canManage} busy={busy} onSave={savePatch} />
          ) : null}
          {phase === "measurement" ? (
            <MeasurementPhase row={row} canManage={canManage} busy={busy} onSave={savePatch} />
          ) : null}

          <AttachmentsSection row={row} canManage={canManage} busy={busy} onReload={load} onToast={onToast} />
        </div>
      )}
    </PulseDrawer>
  );
}

function IdentificationPhase({
  row,
  canManage,
  busy,
  onSave,
}: {
  row: OperationalImprovementRow;
  canManage: boolean;
  busy: boolean;
  onSave: (patch: Parameters<typeof patchOperationalImprovement>[1]) => Promise<void>;
}) {
  const [draft, setDraft] = useState({
    description: row.description ?? "",
    estimated_impact: row.estimated_impact ?? "",
    current_symptoms: row.current_symptoms ?? "",
    stakeholders_affected: row.stakeholders_affected ?? "",
    location: row.location ?? "",
    department_slug: row.department_slug ?? "",
  });
  useEffect(() => {
    setDraft({
      description: row.description ?? "",
      estimated_impact: row.estimated_impact ?? "",
      current_symptoms: row.current_symptoms ?? "",
      stakeholders_affected: row.stakeholders_affected ?? "",
      location: row.location ?? "",
      department_slug: row.department_slug ?? "",
    });
  }, [row]);
  const template = getImprovementTemplate(row.framework_data?.template_id as ImprovementTemplateId | undefined);
  const prioritization = row.framework_data?.prioritization as PrioritizationScores | undefined;
  return (
    <div className="space-y-4">
      {template ? (
        <div className="rounded-lg border border-ds-border bg-ds-secondary/40 p-3 text-sm">
          <p className="font-semibold text-ds-foreground">Template: {template.label}</p>
          <p className="mt-1 text-ds-muted">{template.guidanceIntro}</p>
          {row.framework_data?.template_answers ? (
            <dl className="mt-2 grid gap-1 text-xs">
              {Object.entries(row.framework_data.template_answers).map(([k, v]) => (
                <div key={k}>
                  <dt className="font-semibold text-ds-muted">{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
          ) : null}
        </div>
      ) : null}
      {(["description", "current_symptoms", "estimated_impact", "stakeholders_affected", "location", "department_slug"] as const).map((key) => (
        <div key={key}>
          <label className={LABEL}>{key.replace(/_/g, " ")}</label>
          <textarea
            className={cn(FIELD, "min-h-[64px]")}
            disabled={!canManage || busy}
            value={draft[key]}
            onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value }))}
          />
        </div>
      ))}
      <PrioritizationPanel
        value={prioritization ?? null}
        disabled={!canManage || busy}
        onSave={async (scores) => {
          await onSave({
            framework_data: {
              ...row.framework_data,
              prioritization: scores,
            },
          });
        }}
      />
      {canManage ? (
        <button type="button" className={PRIMARY} disabled={busy} onClick={() => void onSave(draft)}>
          Save identification
        </button>
      ) : null}
    </div>
  );
}

function AnalysisPhase({
  row,
  canManage,
  busy,
  onAdd,
  onReload,
  onToast,
}: {
  row: OperationalImprovementRow;
  canManage: boolean;
  busy: boolean;
  onAdd: (type: OperationalImprovementAnalysisType) => Promise<void>;
  onReload: () => Promise<void>;
  onToast: (m: string) => void;
}) {
  const recommended = row.framework_data?.recommended_analyses ?? getImprovementTemplate(row.framework_data?.template_id as ImprovementTemplateId | undefined)?.recommendedAnalyses ?? [];
  const types = OI_ANALYSIS_TYPES;
  return (
    <div className="space-y-4">
      {recommended.length ? (
        <p className="text-sm text-ds-muted">
          Recommended for this opportunity:{" "}
          {recommended.map((t) => ANALYSIS_TYPE_LABELS[t as OperationalImprovementAnalysisType] ?? t).join(" · ")}
        </p>
      ) : null}
      {canManage ? (
        <div className="flex flex-wrap gap-2">
          {types.map((t) => (
            <button
              key={t}
              type="button"
              className={cn(GHOST, recommended.includes(t) && "ring-1 ring-ds-accent/40")}
              disabled={busy}
              onClick={() => void onAdd(t)}
            >
              <Plus className="h-3.5 w-3.5" aria-hidden />
              {ANALYSIS_TYPE_LABELS[t]}
            </button>
          ))}
        </div>
      ) : null}
      {row.analyses.length === 0 ? (
        <p className="text-sm text-ds-muted">No analysis records yet. Add 5 Whys, fishbone, process maps, or lean observations.</p>
      ) : (
        row.analyses.map((a) => (
          <AnalysisCard key={a.id} analysis={a} canManage={canManage} busy={busy} onReload={onReload} onToast={onToast} />
        ))
      )}
    </div>
  );
}

function AnalysisCard({
  analysis,
  canManage,
  busy,
  onReload,
  onToast,
}: {
  analysis: OperationalImprovementRow["analyses"][number];
  canManage: boolean;
  busy: boolean;
  onReload: () => Promise<void>;
  onToast: (m: string) => void;
}) {
  const [data, setData] = useState<Record<string, unknown>>(analysis.data ?? {});
  useEffect(() => {
    setData(analysis.data ?? {});
  }, [analysis]);
  return (
    <div className="rounded-lg border border-ds-border bg-ds-secondary/40 p-3">
      <div className="flex items-start justify-between gap-2">
        <h4 className="text-sm font-bold text-ds-foreground">
          {analysis.title ?? ANALYSIS_TYPE_LABELS[analysis.analysis_type]}
        </h4>
        {canManage ? (
          <button
            type="button"
            className={GHOST}
            disabled={busy}
            onClick={() =>
              void deleteOperationalImprovementAnalysis(analysis.id)
                .then(onReload)
                .catch((e) => onToast(e instanceof Error ? e.message : "Delete failed."))
            }
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden />
          </button>
        ) : null}
      </div>
      <div className="mt-3">
        <GuidedAnalysisEditor
          analysisType={analysis.analysis_type}
          data={data}
          disabled={!canManage || busy}
          onChange={setData}
        />
      </div>
      {canManage ? (
        <button
          type="button"
          className={cn(PRIMARY, "mt-3")}
          disabled={busy}
          onClick={() => {
            void patchOperationalImprovementAnalysis(analysis.id, { data })
              .then(onReload)
              .then(() => onToast("Analysis saved."))
              .catch((e) => onToast(e instanceof Error ? e.message : "Save failed."));
          }}
        >
          Save analysis
        </button>
      ) : null}
    </div>
  );
}

function PlanPhase({
  row,
  canManage,
  busy,
  onAdd,
  onCreateWr,
  onReload,
  onToast,
}: {
  row: OperationalImprovementRow;
  canManage: boolean;
  busy: boolean;
  onAdd: () => Promise<void>;
  onCreateWr: (actionId: string, title: string) => Promise<void>;
  onReload: () => Promise<void>;
  onToast: (m: string) => void;
}) {
  return (
    <div className="space-y-3">
      {canManage ? (
        <button type="button" className={PRIMARY} disabled={busy} onClick={() => void onAdd()}>
          <Plus className="h-4 w-4" aria-hidden />
          Add action
        </button>
      ) : null}
      {row.actions.map((a) => (
        <div key={a.id} className="rounded-lg border border-ds-border p-3">
          <p className="font-medium text-ds-foreground">{a.action}</p>
          <p className="mt-1 text-xs text-ds-muted">
            {ACTION_STATUS_LABELS[a.status]}
            {a.due_date ? ` · Due ${a.due_date}` : ""}
          </p>
          {a.notes ? <p className="mt-2 text-sm text-ds-muted">{a.notes}</p> : null}
          <div className="mt-2 flex flex-wrap gap-2">
            {a.linked_work_request_id ? (
              <Link href={pulseAppHref(`/dashboard/maintenance?wr=${a.linked_work_request_id}`)} className={GHOST}>
                <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                Open work request
              </Link>
            ) : canManage ? (
              <button type="button" className={GHOST} disabled={busy} onClick={() => void onCreateWr(a.id, a.action)}>
                Create work request
              </button>
            ) : null}
            {canManage ? (
              <button
                type="button"
                className={GHOST}
                disabled={busy}
                onClick={() =>
                  void deleteOperationalImprovementAction(a.id)
                    .then(onReload)
                    .catch((e) => onToast(e instanceof Error ? e.message : "Delete failed."))
                }
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden />
              </button>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}

function ImplementationPhase({
  row,
  canManage,
  busy,
  onSave,
}: {
  row: OperationalImprovementRow;
  canManage: boolean;
  busy: boolean;
  onSave: (patch: Parameters<typeof patchOperationalImprovement>[1]) => Promise<void>;
}) {
  const fields = ["start_date", "completion_date", "resources_required", "budget", "risks", "dependencies"] as const;
  const [draft, setDraft] = useState<Record<string, string>>({});
  useEffect(() => {
    const next: Record<string, string> = {};
    for (const f of fields) next[f] = String(row.implementation_data?.[f] ?? "");
    setDraft(next);
  }, [row]);
  return (
    <div className="space-y-3">
      <p className="text-sm text-ds-muted">Track rollout — resources, risks, and dependencies.</p>
      {fields.map((f) => (
        <div key={f}>
          <label className={LABEL}>{f.replace(/_/g, " ")}</label>
          <textarea
            className={cn(FIELD, "min-h-[64px]")}
            disabled={!canManage || busy}
            value={draft[f] ?? ""}
            onChange={(e) => setDraft((d) => ({ ...d, [f]: e.target.value }))}
          />
        </div>
      ))}
      {canManage ? (
        <button type="button" className={PRIMARY} disabled={busy} onClick={() => void onSave({ implementation_data: draft })}>
          Save implementation
        </button>
      ) : null}
    </div>
  );
}

function MeasurementPhase({
  row,
  canManage,
  busy,
  onSave,
}: {
  row: OperationalImprovementRow;
  canManage: boolean;
  busy: boolean;
  onSave: (patch: Parameters<typeof patchOperationalImprovement>[1]) => Promise<void>;
}) {
  const templateId = row.framework_data?.template_id as ImprovementTemplateId | undefined;
  const metrics =
    row.measurement_data?.scorecard_metrics?.length
      ? row.measurement_data.scorecard_metrics
      : templateId
        ? seedScorecardFromTemplate(templateId)
        : [];
  const textFields = ["success_criteria", "actual_results", "lessons_learned", "follow_up_review_date"] as const;
  const [draft, setDraft] = useState<Record<string, string>>({});
  useEffect(() => {
    const next: Record<string, string> = {};
    for (const f of textFields) next[f] = String(row.measurement_data?.[f] ?? "");
    setDraft(next);
  }, [row]);
  return (
    <div className="space-y-6">
      <ScorecardPanel
        metrics={metrics}
        estimatedSavings={String(row.measurement_data?.estimated_savings ?? "")}
        disabled={!canManage || busy}
        onSave={async (scorecard_metrics, estimated_savings) => {
          await onSave({
            measurement_data: {
              ...row.measurement_data,
              ...draft,
              scorecard_metrics,
              estimated_savings,
            },
          });
        }}
      />
      {textFields.map((f) => (
        <div key={f}>
          <label className={LABEL}>{f.replace(/_/g, " ")}</label>
          <textarea
            className={cn(FIELD, "min-h-[64px]")}
            disabled={!canManage || busy}
            value={draft[f] ?? ""}
            onChange={(e) => setDraft((d) => ({ ...d, [f]: e.target.value }))}
          />
        </div>
      ))}
      {canManage ? (
        <button
          type="button"
          className={PRIMARY}
          disabled={busy}
          onClick={() =>
            void onSave({
              measurement_data: {
                ...row.measurement_data,
                ...draft,
                scorecard_metrics: metrics,
              },
            })
          }
        >
          Save narrative results
        </button>
      ) : null}
    </div>
  );
}

function AttachmentsSection({
  row,
  canManage,
  busy,
  onReload,
  onToast,
}: {
  row: OperationalImprovementRow;
  canManage: boolean;
  busy: boolean;
  onReload: () => Promise<void>;
  onToast: (m: string) => void;
}) {
  async function addAttachment() {
    const name = window.prompt("File name or label");
    if (!name?.trim()) return;
    const url = window.prompt("URL (optional)") ?? "";
    try {
      await createOperationalImprovementAttachment(row.id, {
        file_name: name.trim(),
        file_url: url.trim() || undefined,
        attachment_type: "document",
      });
      await onReload();
      onToast("Attachment added.");
    } catch (e) {
      onToast(e instanceof Error ? e.message : "Could not add attachment.");
    }
  }
  return (
    <section className="border-t border-ds-border pt-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-bold text-ds-foreground">Attachments</h3>
        {canManage ? (
          <button type="button" className={GHOST} disabled={busy} onClick={() => void addAttachment()}>
            <Plus className="h-3.5 w-3.5" aria-hidden />
            Add
          </button>
        ) : null}
      </div>
      {row.attachments.length === 0 ? (
        <p className="mt-2 text-sm text-ds-muted">Photos, diagrams, and process maps can be linked here.</p>
      ) : (
        <ul className="mt-2 space-y-2">
          {row.attachments.map((a) => (
            <li key={a.id} className="flex items-center justify-between gap-2 rounded-lg border border-ds-border px-3 py-2 text-sm">
              <div>
                <p className="font-medium text-ds-foreground">{a.file_name}</p>
                {a.file_url ? (
                  <a href={a.file_url} target="_blank" rel="noreferrer" className="text-xs text-ds-accent hover:underline">
                    Open file
                  </a>
                ) : null}
              </div>
              {canManage ? (
                <button
                  type="button"
                  className={GHOST}
                  onClick={() =>
                    void deleteOperationalImprovementAttachment(a.id)
                      .then(onReload)
                      .catch((e) => onToast(e instanceof Error ? e.message : "Delete failed."))
                  }
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden />
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
