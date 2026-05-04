"use client";

import { ClipboardList } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { parseClientApiError } from "@/lib/parse-client-api-error";
import { cn } from "@/lib/cn";
import { buttonVariants } from "@/styles/button-variants";
import { OverviewSection } from "./components/OverviewSection";
import { ScopeSection } from "./components/ScopeSection";
import { ScheduleSection } from "./components/ScheduleSection";
import { LessonsSection } from "./components/LessonsSection";
import { OutcomeSection } from "./components/OutcomeSection";
import { fetchProjectSummary, fetchProjectSummaryExport, saveProjectSummaryDraft } from "./projectSummaryApi";
import type {
  OutcomeResult,
  ProjectSummaryDoc,
  ProjectSummaryUserInputs,
  SummaryLessons,
  SummaryOutcome,
} from "./types";

const PRIMARY_BTN = cn(buttonVariants({ surface: "light", intent: "accent" }), "px-5 py-2.5");

function asPartialLessons(v: unknown): Partial<SummaryLessons> | undefined {
  if (!v || typeof v !== "object") return undefined;
  const o = v as Record<string, unknown>;
  const p: Partial<SummaryLessons> = {};
  if (typeof o.went_well === "string") p.went_well = o.went_well;
  if (typeof o.didnt_go_well === "string") p.didnt_go_well = o.didnt_go_well;
  if (typeof o.improvements === "string") p.improvements = o.improvements;
  return Object.keys(p).length ? p : undefined;
}

function isOutcomeResult(v: unknown): v is OutcomeResult {
  return v === "success" || v === "partial" || v === "fail";
}

function asPartialOutcome(v: unknown): Partial<SummaryOutcome> | undefined {
  if (!v || typeof v !== "object") return undefined;
  const o = v as Record<string, unknown>;
  const p: Partial<SummaryOutcome> = {};
  if (isOutcomeResult(o.result)) p.result = o.result;
  if (typeof o.summary === "string") p.summary = o.summary;
  return Object.keys(p).length ? p : undefined;
}

function readUserInputsFromExport(exported: Record<string, unknown>): ProjectSummaryUserInputs {
  const raw = exported.user_inputs;
  if (!raw || typeof raw !== "object") return {};
  const u = raw as Record<string, unknown>;
  const lessons = asPartialLessons(u.lessons);
  const outcome = asPartialOutcome(u.outcome);
  const out: ProjectSummaryUserInputs = {};
  if (lessons) out.lessons = lessons;
  if (outcome) out.outcome = outcome;
  return out;
}

function mergeLessons(base: SummaryLessons, patch?: Partial<SummaryLessons> | null): SummaryLessons {
  if (!patch) return base;
  return {
    went_well: patch.went_well !== undefined ? patch.went_well : base.went_well,
    didnt_go_well: patch.didnt_go_well !== undefined ? patch.didnt_go_well : base.didnt_go_well,
    improvements: patch.improvements !== undefined ? patch.improvements : base.improvements,
  };
}

function mergeOutcome(base: SummaryOutcome, patch?: Partial<SummaryOutcome> | null): SummaryOutcome {
  if (!patch) return base;
  return {
    result: patch.result !== undefined ? patch.result : base.result,
    summary: patch.summary !== undefined ? patch.summary : base.summary,
  };
}

export type ProjectSummaryPageProps = {
  projectId: string;
};

export function ProjectSummaryPage({ projectId }: ProjectSummaryPageProps) {
  const [generated, setGenerated] = useState<ProjectSummaryDoc | null>(null);
  const [lessons, setLessons] = useState<SummaryLessons | null>(null);
  const [outcome, setOutcome] = useState<SummaryOutcome | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const [fresh, exported] = await Promise.all([
        fetchProjectSummary(projectId),
        fetchProjectSummaryExport(projectId),
      ]);
      setGenerated(fresh);
      const persisted = readUserInputsFromExport(exported);
      setLessons(mergeLessons(fresh.lessons, persisted.lessons));
      setOutcome(mergeOutcome(fresh.outcome, persisted.outcome));
    } catch (e) {
      setGenerated(null);
      setLessons(null);
      setOutcome(null);
      setErr(parseClientApiError(e).message);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onSave() {
    if (!lessons || !outcome) return;
    setSaving(true);
    setToast(null);
    setErr(null);
    try {
      await saveProjectSummaryDraft(projectId, { lessons, outcome });
      setToast("Draft saved.");
    } catch (e) {
      setErr(parseClientApiError(e).message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-ds-muted">Loading project summary…</div>
    );
  }

  if (!generated || !lessons || !outcome) {
    return (
      <div className="rounded-lg border border-ds-border bg-ds-secondary p-6 text-sm text-ds-foreground">
        {err ?? "Could not load summary."}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Project summary"
        description="Auto-filled overview, scope, and schedule from your project data. Add lessons learned and an outcome, then save a draft."
        icon={ClipboardList}
        actions={
          <button type="button" className={PRIMARY_BTN} disabled={saving} onClick={() => void onSave()}>
            {saving ? "Saving…" : "Save draft"}
          </button>
        }
      />

      {err ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900 dark:border-red-500/40 dark:bg-red-950/35 dark:text-red-100">
          {err}
        </div>
      ) : null}
      {toast ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 dark:border-emerald-500/40 dark:bg-emerald-950/35 dark:text-emerald-100">
          {toast}
        </div>
      ) : null}

      <section aria-labelledby="ps-auto-heading" className="space-y-3">
        <h2 id="ps-auto-heading" className="text-xs font-bold uppercase tracking-wide text-ds-muted">
          Auto-filled from the system
        </h2>
        <div className="grid gap-4 lg:grid-cols-3">
          <OverviewSection overview={generated.overview} />
          <ScopeSection scope={generated.scope} />
          <ScheduleSection schedule={generated.schedule} />
        </div>
      </section>

      <section aria-labelledby="ps-input-heading" className="space-y-3">
        <h2 id="ps-input-heading" className="text-xs font-bold uppercase tracking-wide text-ds-muted">
          Your inputs
        </h2>
        <div className="grid gap-4 lg:grid-cols-2">
          <LessonsSection value={lessons} onChange={setLessons} disabled={saving} />
          <OutcomeSection value={outcome} onChange={setOutcome} disabled={saving} />
        </div>
      </section>
    </div>
  );
}
