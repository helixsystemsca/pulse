"use client";

import { ClipboardList, ImagePlus, Loader2, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useId, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { PageBody } from "@/components/ui/PageBody";
import {
  createProcedure,
  createProcedureAssignment,
  fetchProcedures,
  patchProcedure,
  procedureStepDisplayText,
  uploadProcedureStepImage,
  type ProcedureRow,
} from "@/lib/cmmsApi";
import { useResolvedProtectedAssetSrc } from "@/lib/useResolvedProtectedAssetSrc";
import { parseClientApiError } from "@/lib/parse-client-api-error";
import { sessionHasAnyRole } from "@/lib/pulse-roles";
import { readSession } from "@/lib/pulse-session";
import { acknowledgeProcedure, hasAcknowledgedProcedure } from "@/lib/procedureAcknowledgments";
import { hasSignedOffProcedure, signoffProcedure } from "@/lib/procedureSignoffs";
import { isApiMode } from "@/lib/api";
import {
  fetchProcedureCompliance,
  fetchWorkerTraining,
  patchProcedureCompliance,
  postProcedureTrainingAcknowledgement,
  postProcedureTrainingSignOff,
  procedureHasTrainingSignOff,
  showProcedureAcknowledgeCTA,
  type WorkerTrainingApiResponse,
} from "@/lib/trainingApi";
import type { TrainingAcknowledgement, TrainingAssignment, TrainingEmployee, TrainingProgram, TrainingTier } from "@/lib/training/types";
import {
  configForProcedure,
  readProcedureComplianceConfig,
  writeProcedureComplianceConfig,
} from "@/lib/training/procedureComplianceConfig";
import { computeProgramColumnCompliancePercent } from "@/lib/training/selectors";
import { generateDemoAssignmentsForMatrix } from "@/lib/training/generatedAssignments";
import { proceduresToTrainingPrograms, workersToTrainingEmployees } from "@/lib/training/liveCatalog";
import { fetchWorkerList, fetchWorkerSettings } from "@/lib/workersService";
import { cn } from "@/lib/cn";
import { buttonVariants } from "@/styles/button-variants";
import { ProcedureKnowledgeVerification } from "@/components/procedures/ProcedureKnowledgeVerification";
import { ProcedureComplianceAcknowledgmentCard } from "@/components/procedures/ProcedureComplianceAcknowledgmentCard";
import { TrainingTierBadge } from "@/components/training/TrainingTierBadge";
import { fetchTrainingMatrix, mapApiAssignments, mapApiEmployees, mapApiPrograms } from "@/lib/trainingApi";

const PROCEDURES_HEADER_BTN = cn(
  buttonVariants({ surface: "light", intent: "accent" }),
  "inline-flex items-center justify-center gap-2 px-5 py-2.5 disabled:cursor-not-allowed disabled:opacity-50",
);
const PROCEDURES_HEADER_BTN_OUTLINE = cn(
  buttonVariants({ surface: "light", intent: "secondary" }),
  "inline-flex items-center justify-center gap-2 px-5 py-2.5 disabled:cursor-not-allowed disabled:opacity-50",
);

type DraftStep = {
  key: string;
  text: string;
  file: File | null;
  image_url: string | null;
  recommended_workers: number | null;
  tools_csv: string;
};

function newKey() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/** Comma/semicolon/newline separated → normalized list for API (deduped, capped). */
function parseKeywordCsv(csv: string): string[] {
  const parts = csv.split(/[,;\n]+/);
  const out: string[] = [];
  const seen = new Set<string>();
  for (const p of parts) {
    const s = p.trim().slice(0, 64);
    if (!s) continue;
    const low = s.toLowerCase();
    if (seen.has(low)) continue;
    seen.add(low);
    out.push(s);
    if (out.length >= 32) break;
  }
  return out;
}

/** Maps to training matrix tiers (`PulseProcedureComplianceSettings.tier`). */
const PROCEDURE_TRAINING_PRIORITY_OPTIONS: { value: TrainingTier; label: string }[] = [
  { value: "mandatory", label: "Mandatory" },
  { value: "high_risk", label: "High" },
  { value: "general", label: "Low" },
];

function trainingTierLabel(tier: TrainingTier): string {
  return PROCEDURE_TRAINING_PRIORITY_OPTIONS.find((o) => o.value === tier)?.label ?? tier;
}

const OTHER_LOCATION_BUCKET = "Other";

/** Lower rank = earlier in library (mandatory before low). */
function trainingTierSortRank(tier: TrainingTier): number {
  switch (tier) {
    case "mandatory":
      return 0;
    case "high_risk":
      return 1;
    case "general":
      return 2;
    default:
      return 9;
  }
}

/**
 * Location for grouping: first internal keyword that prefixes the title, else "Title – rest" prefix,
 * else first keyword, else {@link OTHER_LOCATION_BUCKET}.
 */
function inferProcedureLocation(row: ProcedureRow): string {
  const title = row.title.trim();
  const kws = (row.search_keywords ?? []).map((k) => k.trim()).filter(Boolean);
  const lower = title.toLowerCase();

  for (const kw of kws) {
    const k = kw.toLowerCase();
    if (k.length < 2) continue;
    if (!lower.startsWith(k)) continue;
    const next = title.slice(kw.length);
    if (next.length === 0 || /^[\s\-–—]/.test(next)) return kw;
  }

  const splitLoc = title.match(/^(.+?)\s*[-–—]\s+\S/);
  if (splitLoc) return splitLoc[1].trim();

  if (kws.length > 0) return kws[0];

  return OTHER_LOCATION_BUCKET;
}

function procedureVersionLabel(row: ProcedureRow): string {
  const rev =
    typeof row.content_revision === "number" && Number.isFinite(row.content_revision) ? row.content_revision : 1;
  const d = row.updated_at ? new Date(row.updated_at) : null;
  const updated =
    d && !Number.isNaN(d.getTime())
      ? `Updated ${d.toLocaleDateString(undefined, { month: "short", year: "numeric" })}`
      : "";
  return [`Version ${rev}`, updated].filter(Boolean).join(" • ");
}

function procedureLibraryTier(row: ProcedureRow, ctx: ProcedureLibraryComplianceCtx | null): TrainingTier {
  return ctx?.programs.find((p) => p.id === row.id)?.tier ?? configForProcedure(row.id, readProcedureComplianceConfig()).tier;
}

function compareLibraryProcedureRows(
  a: ProcedureRow,
  b: ProcedureRow,
  ctx: ProcedureLibraryComplianceCtx | null,
): number {
  const locA = inferProcedureLocation(a);
  const locB = inferProcedureLocation(b);
  const aOther = locA === OTHER_LOCATION_BUCKET;
  const bOther = locB === OTHER_LOCATION_BUCKET;
  if (aOther !== bOther) return aOther ? 1 : -1;
  const cLoc = locA.localeCompare(locB, undefined, { sensitivity: "base" });
  if (cLoc !== 0) return cLoc;

  const tierA = procedureLibraryTier(a, ctx);
  const tierB = procedureLibraryTier(b, ctx);
  const cTier = trainingTierSortRank(tierA) - trainingTierSortRank(tierB);
  if (cTier !== 0) return cTier;

  return a.title.localeCompare(b.title, undefined, { sensitivity: "base" });
}

type ProcedureLibraryComplianceCtx = {
  employees: TrainingEmployee[];
  programs: TrainingProgram[];
  assignments: TrainingAssignment[];
  acknowledgements: TrainingAcknowledgement[];
  trustAssignmentStatus: boolean;
};

function toDraftFromProcedure(row: ProcedureRow): DraftStep[] {
  return row.steps.map((s) => ({
    key: newKey(),
    text: typeof s === "string" ? s : procedureStepDisplayText(s),
    file: null,
    image_url: typeof s === "string" ? null : (s.image_url ?? null),
    recommended_workers: typeof s === "string" ? null : (s.recommended_workers ?? null),
    tools_csv: typeof s === "string" ? "" : ((s.tools ?? []).join(", ") || ""),
  }));
}

function StepImagePreview({ imageUrl, imageClassName }: { imageUrl: string | null; imageClassName?: string }) {
  const { src, loading, failed } = useResolvedProtectedAssetSrc(imageUrl);
  if (!imageUrl) return null;
  if (loading) return <Loader2 className="h-6 w-6 animate-spin text-ds-muted" aria-hidden />;
  if (failed || !src) return <p className="text-xs text-ds-danger">Could not load image</p>;
  // eslint-disable-next-line @next/next/no-img-element
  return (
    <img
      src={src}
      alt=""
      className={cn(
        "mt-3 max-h-40 w-full rounded-md border border-ds-border object-contain",
        imageClassName,
      )}
    />
  );
}

export function ProceduresApp() {
  const formId = useId();
  const [isCreating, setIsCreating] = useState(false);
  const [rows, setRows] = useState<ProcedureRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [createKeywordsCsv, setCreateKeywordsCsv] = useState("");
  const [libraryKeyword, setLibraryKeyword] = useState("");
  const [debouncedLibraryKeyword, setDebouncedLibraryKeyword] = useState("");
  const [draftSteps, setDraftSteps] = useState<DraftStep[]>([
    { key: newKey(), text: "", file: null, image_url: null, recommended_workers: null, tools_csv: "" },
  ]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editKeywordsCsv, setEditKeywordsCsv] = useState("");
  const [editSteps, setEditSteps] = useState<DraftStep[]>([]);
  const [editCreatorName, setEditCreatorName] = useState("");
  const [ackOpen, setAckOpen] = useState(false);
  const [ackForId, setAckForId] = useState<string | null>(null);
  const [editIsCritical, setEditIsCritical] = useState(false);
  const [editRevisionNotes, setEditRevisionNotes] = useState("");
  const [editPublishedAtLocal, setEditPublishedAtLocal] = useState("");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignKind, setAssignKind] = useState<"complete" | "revise" | "create">("complete");
  const [assignWorkerId, setAssignWorkerId] = useState("");
  const [assignNote, setAssignNote] = useState("");
  const [workerOptions, setWorkerOptions] = useState<{ id: string; label: string }[]>([]);
  const [assigning, setAssigning] = useState(false);
  const [createTrainingTier, setCreateTrainingTier] = useState<TrainingTier>("general");
  const [editTrainingTier, setEditTrainingTier] = useState<TrainingTier>("general");
  const [notice, setNotice] = useState<string | null>(null);
  const session = readSession();
  const canReview = sessionHasAnyRole(session, "lead", "supervisor", "manager", "company_admin");
  /** Same gate as training matrix compliance PATCH (lead+). */
  const canSetProcedureTrainingTier = sessionHasAnyRole(
    session,
    "lead",
    "supervisor",
    "manager",
    "company_admin",
    "system_admin",
  );
  const userId = session?.sub ?? null;
  const [myTraining, setMyTraining] = useState<WorkerTrainingApiResponse | null>(null);
  const [libraryComplianceCtx, setLibraryComplianceCtx] = useState<ProcedureLibraryComplianceCtx | null>(null);
  const [proceduresEditRoles, setProceduresEditRoles] = useState<string[]>(["manager", "supervisor", "lead"]);

  const sessionRoleSet = useMemo(() => {
    const s = new Set<string>();
    if (session?.role) s.add(session.role);
    for (const r of session?.roles ?? []) s.add(r);
    return s;
  }, [session?.role, session?.roles]);

  const isCompanyAdmin = sessionHasAnyRole(session, "company_admin");
  const canAssign = sessionHasAnyRole(session, "lead", "supervisor", "manager", "company_admin");

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const list = await fetchProcedures(
        debouncedLibraryKeyword.trim() ? { keyword: debouncedLibraryKeyword.trim() } : undefined,
      );
      setRows(list);
    } catch (e) {
      setErr(parseClientApiError(e).message);
    } finally {
      setLoading(false);
    }
  }, [debouncedLibraryKeyword]);

  useEffect(() => {
    const id = window.setTimeout(() => setDebouncedLibraryKeyword(libraryKeyword.trim()), 400);
    return () => window.clearTimeout(id);
  }, [libraryKeyword]);

  useEffect(() => {
    void load();
  }, [load]);

  const reloadMyTraining = useCallback(async () => {
    if (!userId || !isApiMode()) return;
    try {
      const t = await fetchWorkerTraining(userId);
      setMyTraining(t);
    } catch {
      setMyTraining(null);
    }
  }, [userId]);

  const api = isApiMode();

  const refreshProcedureLibraryCompliance = useCallback(async () => {
    if (api) {
      try {
        const m = await fetchTrainingMatrix();
        setLibraryComplianceCtx({
          employees: mapApiEmployees(m.employees),
          programs: mapApiPrograms(m.programs),
          assignments: mapApiAssignments(m.assignments),
          acknowledgements: [],
          trustAssignmentStatus: true,
        });
      } catch {
        setLibraryComplianceCtx(null);
      }
      return;
    }
    try {
      const companyId = session?.company_id ?? null;
      const w = await fetchWorkerList(companyId, { include_inactive: false });
      const cfg = readProcedureComplianceConfig();
      const emps = workersToTrainingEmployees(w.items ?? []);
      const progs = proceduresToTrainingPrograms(rows, cfg);
      const { assignments, acknowledgements } = generateDemoAssignmentsForMatrix(emps, progs);
      setLibraryComplianceCtx({
        employees: emps,
        programs: progs,
        assignments,
        acknowledgements,
        trustAssignmentStatus: false,
      });
    } catch {
      setLibraryComplianceCtx(null);
    }
  }, [api, session?.company_id, rows]);

  useEffect(() => {
    void refreshProcedureLibraryCompliance();
  }, [refreshProcedureLibraryCompliance]);

  useEffect(() => {
    void reloadMyTraining();
  }, [reloadMyTraining]);

  useEffect(() => {
    if (!notice) return;
    const t = window.setTimeout(() => setNotice(null), 6000);
    return () => window.clearTimeout(t);
  }, [notice]);

  useEffect(() => {
    if (!selectedId) {
      setEditTrainingTier("general");
      return;
    }
    let cancelled = false;
    void (async () => {
      if (isApiMode()) {
        try {
          const c = await fetchProcedureCompliance(selectedId);
          if (!cancelled) setEditTrainingTier(c.tier as TrainingTier);
        } catch {
          if (!cancelled) setEditTrainingTier("general");
        }
      } else {
        const cfg = configForProcedure(selectedId, readProcedureComplianceConfig());
        if (!cancelled) setEditTrainingTier(cfg.tier);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  useEffect(() => {
    void (async () => {
      try {
        const st = await fetchWorkerSettings(null);
        const roles = st.settings?.procedures_edit_roles;
        setProceduresEditRoles(Array.isArray(roles) && roles.length ? roles : ["manager", "supervisor", "lead"]);
      } catch {
        // default stays
      }
    })();
  }, []);

  const selected = selectedId ? rows.find((r) => r.id === selectedId) ?? null : null;

  useEffect(() => {
    if (!selected) {
      setEditTitle("");
      setEditKeywordsCsv("");
      setEditSteps([]);
      setEditCreatorName("");
      setAckOpen(false);
      setAckForId(null);
      setEditing(false);
      return;
    }
    setEditTitle(selected.title);
    setEditKeywordsCsv((selected.search_keywords ?? []).join(", "));
    setEditSteps(toDraftFromProcedure(selected));
    setEditCreatorName(selected.created_by_name?.trim() || "");
    setEditIsCritical(Boolean(selected.is_critical));
    setEditRevisionNotes((selected.revision_notes ?? "").trim());
    const pub = selected.published_at;
    setEditPublishedAtLocal(pub ? new Date(pub).toISOString().slice(0, 16) : "");
    setAckForId(selected.id);
    setAckOpen(false);
  }, [selected, editing]);

  useEffect(() => {
    if (!selected?.id) return;
    setAckOpen(false);
  }, [selected?.id]);

  const canEditSelected = useMemo(() => {
    if (!selected) return false;
    if (isCompanyAdmin) return true;
    const allowedByRole = proceduresEditRoles.some((r) => sessionRoleSet.has(r));
    const createdById = selected.created_by_user_id && userId ? selected.created_by_user_id === userId : false;
    const meName = (session?.full_name?.trim() || "").toLowerCase();
    const meEmail = (session?.email?.trim() || "").toLowerCase();
    const createdByName = (selected.created_by_name?.trim() || "").toLowerCase();
    const createdByNameMatch = Boolean(createdByName && (createdByName === meName || createdByName === meEmail));
    return Boolean(allowedByRole || createdById || createdByNameMatch);
  }, [selected, isCompanyAdmin, proceduresEditRoles, sessionRoleSet, userId, session?.full_name, session?.email]);

  const librarySortedRows = useMemo(
    () => [...rows].sort((a, b) => compareLibraryProcedureRows(a, b, libraryComplianceCtx)),
    [rows, libraryComplianceCtx],
  );

  const addDraftRow = (setter: Dispatch<SetStateAction<DraftStep[]>>) => {
    setter((prev) => [
      ...prev,
      { key: newKey(), text: "", file: null, image_url: null, recommended_workers: null, tools_csv: "" },
    ]);
  };

  const removeDraftRow = (setter: Dispatch<SetStateAction<DraftStep[]>>, key: string) => {
    setter((prev) => (prev.length <= 1 ? prev : prev.filter((s) => s.key !== key)));
  };

  const uploadPendingFiles = async (procedureId: string, steps: DraftStep[]) => {
    for (let i = 0; i < steps.length; i++) {
      const f = steps[i].file;
      if (f) {
        await uploadProcedureStepImage(procedureId, i, f);
      }
    }
  };

  const create = async () => {
    const t = title.trim();
    if (!t) return;
    const normalized = draftSteps.map((s) => {
      const tools = s.tools_csv
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean);
      return {
        text: s.text.trim(),
        image_url: s.image_url,
        recommended_workers: s.recommended_workers ?? null,
        tools,
      };
    });
    if (!normalized.some((s, i) => s.text || s.image_url || draftSteps[i]?.file)) {
      setErr("Add at least one step with text or a picture.");
      return;
    }
    setSaving(true);
    setErr(null);
    try {
      const creatorName = (session?.full_name?.trim() || session?.email?.trim() || "Unknown").slice(0, 80);
      const creatorId = session?.sub ?? null;
      const needsReview = !sessionHasAnyRole(session, "lead", "supervisor", "manager", "company_admin");
      const proc = await createProcedure({
        title: t,
        steps: normalized,
        search_keywords: parseKeywordCsv(createKeywordsCsv),
        created_by_user_id: creatorId,
        created_by_name: creatorName,
        review_required: needsReview,
      });
      await uploadPendingFiles(proc.id, draftSteps);
      try {
        await persistProcedureTrainingTier(proc.id, createTrainingTier);
      } catch (e) {
        setNotice(parseClientApiError(e).message || "Could not save training priority — update it under Standards → Training.");
      }
      setTitle("");
      setCreateKeywordsCsv("");
      setCreateTrainingTier("general");
      setDraftSteps([{ key: newKey(), text: "", file: null, image_url: null, recommended_workers: null, tools_csv: "" }]);
      await load();
      setIsCreating(false);
    } catch (e) {
      setErr(parseClientApiError(e).message);
    } finally {
      setSaving(false);
    }
  };

  const openAssign = async (kind: "complete" | "revise" | "create") => {
    if (!canAssign) return;
    setAssignKind(kind);
    setAssignWorkerId("");
    setAssignNote("");
    setAssignOpen(true);
    setErr(null);
    try {
      const companyId = session?.company_id ?? null;
      const list = await fetchWorkerList(companyId, { include_inactive: false });
      setWorkerOptions(
        (list.items ?? [])
          .filter((w) => w.is_active)
          .map((w) => ({
            id: w.id,
            label: `${w.full_name?.trim() || w.email}${w.role ? ` — ${w.role}` : ""}`,
          })),
      );
    } catch {
      setWorkerOptions([]);
    }
  };

  const doAssign = async () => {
    if (!canAssign) return;
    const wid = assignWorkerId.trim();
    if (!wid) return;
    setAssigning(true);
    setErr(null);
    try {
      if (assignKind === "create") {
        const t = title.trim();
        if (!t) {
          setErr("Enter a title first.");
          return;
        }
        const creatorName = (session?.full_name?.trim() || session?.email?.trim() || "Unknown").slice(0, 80);
        const creatorId = session?.sub ?? null;
        const proc = await createProcedure({
          title: t,
          steps: [],
          created_by_user_id: creatorId,
          created_by_name: creatorName,
          review_required: false,
        });
        await createProcedureAssignment({
          procedure_id: proc.id,
          assigned_to_user_id: wid,
          kind: "create",
          notes: assignNote.trim() || null,
        });
        setTitle("");
        await load();
        setSelectedId(proc.id);
      } else {
        if (!selected?.id) {
          setErr("Select a procedure to assign.");
          return;
        }
        await createProcedureAssignment({
          procedure_id: selected.id,
          assigned_to_user_id: wid,
          kind: assignKind,
          notes: assignNote.trim() || null,
        });
      }
      setAssignOpen(false);
    } catch (e) {
      setErr(parseClientApiError(e).message);
    } finally {
      setAssigning(false);
    }
  };

  const saveEdit = async () => {
    if (!selectedId) return;
    const t = editTitle.trim();
    if (!t) return;
    const normalized = editSteps.map((s) => {
      const tools = s.tools_csv
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean);
      return {
        text: s.text.trim(),
        image_url: s.file ? null : s.image_url,
        recommended_workers: s.recommended_workers ?? null,
        tools,
      };
    });
    if (!normalized.some((s, i) => s.text || s.image_url || editSteps[i]?.file)) {
      setErr("Add at least one step with text or a picture.");
      return;
    }
    setSaving(true);
    setErr(null);
    try {
      const reviserName = (session?.full_name?.trim() || session?.email?.trim() || "Supervisor").slice(0, 80);
      const reviserId = session?.sub ?? null;
      await patchProcedure(selectedId, {
        title: t,
        steps: normalized,
        search_keywords: parseKeywordCsv(editKeywordsCsv),
        revised_by_user_id: reviserId,
        revised_by_name: reviserName,
        is_critical: editIsCritical,
        revision_notes: editRevisionNotes.trim() || null,
        published_at: editPublishedAtLocal ? new Date(editPublishedAtLocal).toISOString() : null,
        ...(canReview
          ? {
              created_by_name: editCreatorName.trim() || null,
            }
          : {}),
      });
      await uploadPendingFiles(selectedId, editSteps);
      try {
        await persistProcedureTrainingTier(selectedId, editTrainingTier);
      } catch (e) {
        setNotice(parseClientApiError(e).message || "Procedure saved; training priority could not be updated.");
      }
      await load();
    } catch (e) {
      setErr(parseClientApiError(e).message);
    } finally {
      setSaving(false);
    }
  };

  async function persistProcedureTrainingTier(procedureId: string, tier: TrainingTier) {
    const payload = {
      tier,
      due_within_days: null as number | null,
      requires_acknowledgement: true,
      requires_knowledge_verification: true,
    };
    if (isApiMode()) {
      if (!sessionHasAnyRole(readSession(), "lead", "supervisor", "manager", "company_admin", "system_admin")) {
        return;
      }
      await patchProcedureCompliance(procedureId, payload);
    } else {
      const prev = readProcedureComplianceConfig();
      writeProcedureComplianceConfig({
        ...prev,
        [procedureId]: {
          tier,
          due_within_days: null,
          requires_acknowledgement: true,
          requires_knowledge_verification: true,
        },
      });
    }
    void refreshProcedureLibraryCompliance();
  }

  const signAcknowledgment = async () => {
    if (!userId || !selected) return;
    if (isApiMode()) {
      setErr(null);
      try {
        await postProcedureTrainingAcknowledgement(selected.id);
        await reloadMyTraining();
        void refreshProcedureLibraryCompliance();
      } catch (e) {
        setErr(parseClientApiError(e).message);
      } finally {
        setAckOpen(false);
      }
      return;
    }
    try {
      acknowledgeProcedure(userId, selected.id, selected.title);
      void refreshProcedureLibraryCompliance();
    } finally {
      setAckOpen(false);
    }
  };

  const signCompletion = async () => {
    if (!userId || !selected) return;
    if (isApiMode()) {
      setErr(null);
      try {
        const out = await postProcedureTrainingSignOff(selected.id, {
          supervisor_signoff: sessionHasAnyRole(session, "supervisor", "manager", "company_admin"),
        });
        const when = out.completed_at ? new Date(out.completed_at).toLocaleString() : "";
        setNotice(
          when
            ? `Completion sign-off archived for compliance (${when}). It appears on your training matrix when assigned.`
            : "Completion sign-off recorded for compliance.",
        );
        await reloadMyTraining();
        void refreshProcedureLibraryCompliance();
      } catch (e) {
        setErr(parseClientApiError(e).message);
      }
      return;
    }
    const name = (session?.full_name?.trim() || session?.email?.trim() || "User").slice(0, 120);
    const rev =
      typeof selected.content_revision === "number"
        ? String(selected.content_revision)
        : selected.revised_at
          ? `rev:${selected.revised_at}`
          : `upd:${selected.updated_at}`;
    signoffProcedure(userId, selected.id, selected.title, {
      completed_by_user_id: session?.sub ?? null,
      completed_by_name: name,
      revision_marker: rev,
    });
    void refreshProcedureLibraryCompliance();
  };

  const programMetaForSelected = useMemo(() => {
    if (!selected?.id || !myTraining?.programs) return null;
    return myTraining.programs.find((p) => p.id === selected.id) ?? null;
  }, [selected?.id, myTraining?.programs]);

  /** Default matches server: verification on unless explicitly disabled on the program. */
  const knowledgeVerificationEnabled =
    isApiMode() && Boolean(userId && selected && (programMetaForSelected?.requires_knowledge_verification ?? true));

  const showAckCta =
    !knowledgeVerificationEnabled &&
    userId &&
    selected &&
    (isApiMode() ? showProcedureAcknowledgeCTA(myTraining, selected.id) : !hasAcknowledgedProcedure(userId, selected.id));

  const signedOffForSelected =
    userId && selected
      ? isApiMode()
        ? procedureHasTrainingSignOff(myTraining, selected.id)
        : hasSignedOffProcedure(userId, selected.id)
      : false;

  const markReviewed = async () => {
    if (!selectedId || !selected) return;
    if (!canReview) return;
    setSaving(true);
    setErr(null);
    try {
      const reviewerName = (session?.full_name?.trim() || session?.email?.trim() || "Supervisor").slice(0, 80);
      await patchProcedure(selectedId, {
        review_required: false,
        reviewed_by_user_id: session?.sub ?? null,
        reviewed_by_name: reviewerName,
        reviewed_at: new Date().toISOString(),
      });
      await load();
    } catch (e) {
      setErr(parseClientApiError(e).message);
    } finally {
      setSaving(false);
    }
  };

  const renderStepEditor = (
    steps: DraftStep[],
    setSteps: Dispatch<SetStateAction<DraftStep[]>>,
    idPrefix: string,
  ) => (
    <ol className="mt-3 space-y-4">
      {steps.map((step, index) => (
        <li
          key={step.key}
          className="ds-premium-inset p-4"
        >
          <div className="flex items-start justify-between gap-2">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-sky-500 text-sm font-bold text-white shadow-md ring-1 ring-white/25">
              {index + 1}
            </span>
            <button
              type="button"
              className="rounded-md p-1 text-ds-muted hover:bg-ds-interactive-hover hover:text-ds-danger"
              aria-label={`Remove step ${index + 1}`}
              onClick={() => removeDraftRow(setSteps, step.key)}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
          <label className="mt-2 block text-xs font-semibold uppercase text-ds-muted" htmlFor={`${idPrefix}-t-${step.key}`}>
            Step text
          </label>
          <textarea
            id={`${idPrefix}-t-${step.key}`}
            className="mt-1 min-h-[4rem] w-full rounded-md border border-ds-border/90 bg-white px-3 py-2 text-sm text-ds-foreground dark:bg-ds-secondary"
            placeholder={`Describe step ${index + 1}…`}
            value={step.text}
            onChange={(e) =>
              setSteps((prev) =>
                prev.map((s) => (s.key === step.key ? { ...s, text: e.target.value } : s)),
              )
            }
          />

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <label
                className="block text-xs font-semibold uppercase text-ds-muted"
                htmlFor={`${idPrefix}-w-${step.key}`}
              >
                Recommended workers
              </label>
              <input
                id={`${idPrefix}-w-${step.key}`}
                type="number"
                min={1}
                inputMode="numeric"
                className="mt-1 w-full rounded-md border border-ds-border/90 bg-white px-3 py-2 text-sm text-ds-foreground dark:bg-ds-secondary"
                placeholder="e.g. 2"
                value={step.recommended_workers ?? ""}
                onChange={(e) => {
                  const raw = e.target.value;
                  const next = raw === "" ? null : Math.max(1, Number(raw));
                  setSteps((prev) => prev.map((s) => (s.key === step.key ? { ...s, recommended_workers: next } : s)));
                }}
              />
            </div>
            <div>
              <label
                className="block text-xs font-semibold uppercase text-ds-muted"
                htmlFor={`${idPrefix}-tools-${step.key}`}
              >
                Required tools
              </label>
              <input
                id={`${idPrefix}-tools-${step.key}`}
                className="mt-1 w-full rounded-md border border-ds-border/90 bg-white px-3 py-2 text-sm text-ds-foreground dark:bg-ds-secondary"
                placeholder="e.g. Wrench, Ladder, Gloves"
                value={step.tools_csv}
                onChange={(e) =>
                  setSteps((prev) => prev.map((s) => (s.key === step.key ? { ...s, tools_csv: e.target.value } : s)))
                }
              />
              {step.tools_csv.trim() ? (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {step.tools_csv
                    .split(",")
                    .map((x) => x.trim())
                    .filter(Boolean)
                    .slice(0, 12)
                    .map((tool) => (
                      <span
                        key={tool}
                        className="rounded-full border border-ds-border/80 bg-white px-2 py-0.5 text-[11px] font-semibold text-ds-foreground dark:bg-ds-secondary"
                      >
                        {tool}
                      </span>
                    ))}
                </div>
              ) : null}
            </div>
          </div>

          <label className="mt-3 flex cursor-pointer flex-col gap-2 text-xs font-semibold uppercase text-ds-muted">
            <span className="inline-flex items-center gap-1 text-ds-foreground">
              <ImagePlus className="h-4 w-4" aria-hidden />
              Picture (optional)
            </span>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="text-sm text-ds-muted file:mr-3 file:rounded-md file:border-0 file:bg-ds-accent file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-ds-accent-foreground"
              onChange={(e) => {
                const f = e.target.files?.[0] ?? null;
                setSteps((prev) => prev.map((s) => (s.key === step.key ? { ...s, file: f } : s)));
                e.target.value = "";
              }}
            />
          </label>
          {step.file ? (
            <p className="mt-1 text-xs text-ds-muted">Selected: {step.file.name} (uploads when you save)</p>
          ) : null}
          {step.image_url && !step.file ? <StepImagePreview imageUrl={step.image_url} /> : null}
        </li>
      ))}
    </ol>
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-hidden">
      <PageHeader
        className="shrink-0"
        title="Procedures"
        description="Operational procedures with optional photos. Set priority for the compliance matrix; assigned workers complete acknowledgment and knowledge verification (or legacy sign-off when verification is off) — timestamps are retained for audit."
        icon={ClipboardList}
        actions={
          isCreating ? (
            <button
              type="button"
              className="rounded-[10px] border border-dashed border-violet-200/90 bg-white px-5 py-2.5 text-sm font-semibold text-ds-foreground shadow-sm transition-colors hover:bg-violet-50/80 disabled:opacity-50 dark:border-violet-400/35 dark:bg-ds-secondary dark:hover:bg-ds-secondary/90"
              onClick={() => {
                setIsCreating(false);
                setCreateKeywordsCsv("");
                setCreateTrainingTier("general");
                setErr(null);
              }}
              disabled={saving}
            >
              Cancel
            </button>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                className={PROCEDURES_HEADER_BTN}
                onClick={() => {
                  setIsCreating(true);
                  setSelectedId(null);
                  setEditing(false);
                  setCreateKeywordsCsv("");
                  setCreateTrainingTier("general");
                  setErr(null);
                }}
              >
                <span className="inline-flex items-center gap-2">
                  <Plus className="h-4 w-4" strokeWidth={2.5} aria-hidden />
                  Create procedure
                </span>
              </button>
              {canAssign ? (
                <>
                  <button type="button" className={PROCEDURES_HEADER_BTN_OUTLINE} onClick={() => void openAssign("complete")}>
                    Assign
                  </button>
                  <button type="button" className={PROCEDURES_HEADER_BTN_OUTLINE} onClick={() => void openAssign("revise")}>
                    Assign for revision
                  </button>
                  <button type="button" className={PROCEDURES_HEADER_BTN_OUTLINE} onClick={() => void openAssign("create")}>
                    Create &amp; assign
                  </button>
                </>
              ) : null}
            </div>
          )
        }
      />

      <PageBody className="flex min-h-0 flex-1 flex-col overflow-hidden">

      {assignOpen ? (
        <div className="ds-premium-panel rounded-xl p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-ds-foreground">
                {assignKind === "create"
                  ? "Create and assign a new procedure"
                  : assignKind === "revise"
                    ? "Assign procedure for revision"
                    : "Assign procedure for completion"}
              </p>
              <p className="mt-1 text-xs text-ds-muted">
                {assignKind === "create"
                  ? "This creates a blank procedure with only a title, then assigns it to a worker."
                  : "This creates an assignment that will appear in the worker’s Procedures list as Attention required."}
              </p>
            </div>
            <button
              type="button"
              className="text-sm font-semibold text-ds-muted hover:text-ds-foreground"
              onClick={() => setAssignOpen(false)}
              disabled={assigning}
            >
              Close
            </button>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-[0.14em] text-ds-muted">Worker</label>
              <select
                className="mt-1 w-full rounded-lg border border-ds-border bg-white px-3 py-2 text-sm font-medium text-ds-foreground dark:bg-ds-surface-secondary"
                value={assignWorkerId}
                onChange={(e) => setAssignWorkerId(e.target.value)}
                disabled={assigning}
              >
                <option value="">Select a worker…</option>
                {workerOptions.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-[0.14em] text-ds-muted">Note (optional)</label>
              <input
                className="mt-1 w-full rounded-lg border border-ds-border bg-white px-3 py-2 text-sm font-medium text-ds-foreground dark:bg-ds-surface-secondary"
                value={assignNote}
                onChange={(e) => setAssignNote(e.target.value)}
                placeholder="e.g. Take photos of before/after."
                disabled={assigning}
              />
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
            <button type="button" className={PROCEDURES_HEADER_BTN_OUTLINE} onClick={() => setAssignOpen(false)} disabled={assigning}>
              Cancel
            </button>
            <button type="button" className={PROCEDURES_HEADER_BTN} onClick={() => void doAssign()} disabled={assigning || !assignWorkerId}>
              {assigning ? "Assigning…" : "Send to worker"}
            </button>
          </div>
        </div>
      ) : null}

      {notice ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-950 shadow-sm dark:border-emerald-500/35 dark:bg-emerald-950/40 dark:text-emerald-50">
          {notice}
        </div>
      ) : null}

      {err ? (
        <div className="rounded-xl border border-ds-border bg-ds-primary px-4 py-3 text-sm font-medium text-ds-danger shadow-sm">
          {err}
        </div>
      ) : null}

      <div
        className={cn(
          "min-h-0 flex-1 overflow-hidden",
          isCreating && "grid min-h-0 gap-6 lg:grid-cols-2",
          !isCreating && selected && "flex min-h-0 flex-col gap-6 lg:flex-row lg:items-stretch",
          !isCreating && !selected && "flex min-h-0 flex-col gap-6",
        )}
      >
        {isCreating ? (
          <section className="ds-premium-panel min-h-0 overflow-y-auto p-6">
            <h2 className="text-base font-semibold text-ds-foreground" id={`${formId}-new-title`}>
              New procedure
            </h2>
            <p className="mt-1 text-sm text-ds-muted">
              Numbered steps, optional photo per step. Pictures upload after the procedure is created.
            </p>
            <div className="mt-4 space-y-3">
              <label className="block text-xs font-semibold uppercase text-ds-muted" htmlFor={`${formId}-title`}>
                Title
              </label>
              <input
                id={`${formId}-title`}
                className="w-full rounded-md border border-ds-border/90 bg-white px-3 py-2 text-sm dark:bg-ds-secondary"
                placeholder="e.g. Monthly pump inspection"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
              <label className="mt-3 block text-xs font-semibold uppercase text-ds-muted" htmlFor={`${formId}-new-kw`}>
                Internal keywords (optional)
              </label>
              <input
                id={`${formId}-new-kw`}
                className="mt-1 w-full rounded-md border border-ds-border/90 bg-white px-3 py-2 text-sm dark:bg-ds-secondary"
                placeholder="e.g. Tile, Pool, Arena, Pool Shutdown"
                value={createKeywordsCsv}
                onChange={(e) => setCreateKeywordsCsv(e.target.value)}
              />
              <p className="mt-1 text-[10px] text-ds-muted">
                Comma-separated. Used only for lookup and filtering here — not shown on worker procedure steps.
              </p>
              <label className="mt-3 block text-xs font-semibold uppercase text-ds-muted" htmlFor={`${formId}-new-priority`}>
                Training priority (training matrix)
              </label>
              <select
                id={`${formId}-new-priority`}
                className="mt-1 w-full rounded-md border border-ds-border/90 bg-white px-3 py-2 text-sm dark:bg-ds-secondary"
                value={createTrainingTier}
                onChange={(e) => setCreateTrainingTier(e.target.value as TrainingTier)}
                disabled={saving || (isApiMode() && !canSetProcedureTrainingTier)}
                title={
                  isApiMode() && !canSetProcedureTrainingTier
                    ? "Lead, supervisor, or manager can set training priority."
                    : undefined
                }
              >
                {PROCEDURE_TRAINING_PRIORITY_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-[10px] text-ds-muted">
                Drives Mandatory / High risk / General columns on the team training matrix. Workers record completion with{" "}
                <span className="font-semibold text-ds-foreground">Complete procedure</span> (unless knowledge verification is on).
              </p>
              {renderStepEditor(draftSteps, setDraftSteps, `${formId}-new`)}
              <button
                type="button"
                className="mt-2 inline-flex items-center gap-2 rounded-md border border-ds-border bg-ds-secondary/60 px-3 py-2 text-sm font-semibold text-ds-foreground hover:bg-ds-interactive-hover"
                onClick={() => addDraftRow(setDraftSteps)}
              >
                <Plus className="h-4 w-4" aria-hidden />
                Add step
              </button>
              <div className="mt-4 flex flex-wrap items-center justify-end gap-3">
                <button
                  type="button"
                  className={cn(buttonVariants({ surface: "light", intent: "secondary" }), "px-4 py-2.5 text-sm")}
                  onClick={() => {
                    setIsCreating(false);
                    setCreateKeywordsCsv("");
                    setCreateTrainingTier("general");
                    setErr(null);
                  }}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={saving || !title.trim()}
                  onClick={() => void create()}
                  className={cn(buttonVariants({ surface: "light", intent: "accent" }), "inline-flex items-center gap-2 px-4 py-2.5 text-sm disabled:opacity-50")}
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
                  Create procedure
                </button>
              </div>
            </div>
          </section>
        ) : null}

        {!isCreating && selected ? (
          <section
            className={cn(
              "ds-premium-panel min-h-0 min-w-0 overflow-y-auto p-6",
              "flex-1 lg:min-h-0",
            )}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <h2 className="text-base font-semibold text-ds-foreground">{editing ? "Edit" : "Procedure"}</h2>
              {canEditSelected ? (
                <div className="flex flex-wrap gap-2">
                  {editing ? (
                    <button
                      type="button"
                      className="rounded-md border border-ds-border px-3 py-2 text-sm font-semibold text-ds-foreground hover:bg-ds-secondary"
                      onClick={() => setEditing(false)}
                      disabled={saving}
                    >
                      Cancel edit
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="rounded-md bg-ds-accent px-3 py-2 text-sm font-semibold text-ds-accent-foreground"
                      onClick={() => setEditing(true)}
                    >
                      Edit
                    </button>
                  )}
                </div>
              ) : null}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-ds-muted">
              <span>
                Created by{" "}
                <span className="font-semibold text-ds-foreground">{selected.created_by_name?.trim() || "—"}</span>
              </span>
              {selected.review_required ? (
                <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 font-semibold text-amber-900">
                  Needs review
                </span>
              ) : selected.reviewed_at ? (
                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-900">
                  Reviewed{selected.reviewed_by_name?.trim() ? ` by ${selected.reviewed_by_name}` : ""}
                </span>
              ) : null}
            </div>

            {!editing ? (
              <p className="mt-3 text-sm text-ds-muted">
                <span className="font-semibold text-ds-foreground">Training priority:</span>{" "}
                {trainingTierLabel(editTrainingTier)}
                {isApiMode() && !canSetProcedureTrainingTier ? (
                  <span className="block pt-1 text-xs">Ask a lead or supervisor to change priority — it controls the training matrix tier.</span>
                ) : null}
              </p>
            ) : null}

            {editing ? (
              <>
                {canReview ? (
                  <div className="mt-3">
                    <label
                      className="block text-[11px] font-semibold uppercase tracking-wider text-ds-muted"
                      htmlFor={`${formId}-edit-created-by`}
                    >
                      Creator (edit)
                    </label>
                    <input
                      id={`${formId}-edit-created-by`}
                      className="mt-1 w-full rounded-md border border-ds-border/90 bg-white px-3 py-2 text-sm dark:bg-ds-secondary"
                      placeholder="Name or email"
                      value={editCreatorName}
                      onChange={(e) => setEditCreatorName(e.target.value)}
                    />
                  </div>
                ) : null}
                <label className="mt-3 block text-xs font-semibold uppercase text-ds-muted" htmlFor={`${formId}-edit-title`}>
                  Title
                </label>
                <input
                  id={`${formId}-edit-title`}
                  className="mt-1 w-full rounded-md border border-ds-border/90 bg-white px-3 py-2 text-sm dark:bg-ds-secondary"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                />
                <label className="mt-3 block text-xs font-semibold uppercase text-ds-muted" htmlFor={`${formId}-edit-kw`}>
                  Internal keywords
                </label>
                <input
                  id={`${formId}-edit-kw`}
                  className="mt-1 w-full rounded-md border border-ds-border/90 bg-white px-3 py-2 text-sm dark:bg-ds-secondary"
                  placeholder="Comma-separated tags for filtering"
                  value={editKeywordsCsv}
                  onChange={(e) => setEditKeywordsCsv(e.target.value)}
                />
                <label className="mt-3 flex items-center gap-2 text-sm text-ds-foreground">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-ds-border"
                    checked={editIsCritical}
                    onChange={(e) => setEditIsCritical(e.target.checked)}
                  />
                  Critical procedure (extra acknowledgment + banner for workers)
                </label>
                <label className="mt-3 block text-xs font-semibold uppercase text-ds-muted" htmlFor={`${formId}-edit-published`}>
                  Published (optional)
                </label>
                <input
                  id={`${formId}-edit-published`}
                  type="datetime-local"
                  className="mt-1 w-full max-w-md rounded-md border border-ds-border/90 bg-white px-3 py-2 text-sm dark:bg-ds-secondary"
                  value={editPublishedAtLocal}
                  onChange={(e) => setEditPublishedAtLocal(e.target.value)}
                />
                <label className="mt-3 block text-xs font-semibold uppercase text-ds-muted" htmlFor={`${formId}-edit-rev-notes`}>
                  Revision notes (internal, optional)
                </label>
                <textarea
                  id={`${formId}-edit-rev-notes`}
                  rows={3}
                  className="mt-1 w-full rounded-md border border-ds-border/90 bg-white px-3 py-2 text-sm dark:bg-ds-secondary"
                  placeholder="What changed in this revision…"
                  value={editRevisionNotes}
                  onChange={(e) => setEditRevisionNotes(e.target.value)}
                />
                <label className="mt-3 block text-xs font-semibold uppercase text-ds-muted" htmlFor={`${formId}-edit-priority`}>
                  Training priority (training matrix)
                </label>
                <select
                  id={`${formId}-edit-priority`}
                  className="mt-1 w-full rounded-md border border-ds-border/90 bg-white px-3 py-2 text-sm dark:bg-ds-secondary"
                  value={editTrainingTier}
                  onChange={(e) => setEditTrainingTier(e.target.value as TrainingTier)}
                  disabled={saving || (isApiMode() && !canSetProcedureTrainingTier)}
                  title={
                    isApiMode() && !canSetProcedureTrainingTier
                      ? "Lead, supervisor, or manager can set training priority."
                      : undefined
                  }
                >
                  {PROCEDURE_TRAINING_PRIORITY_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-[10px] text-ds-muted">
                  Saved to compliance settings with acknowledgement required. When knowledge verification is on, the matrix
                  stays incomplete until workers finish review, acknowledgment, and the knowledge check.
                </p>
                {renderStepEditor(editSteps, setEditSteps, `${formId}-edit`)}
                <button
                  type="button"
                  className="mt-2 inline-flex items-center gap-2 rounded-md border border-ds-border bg-ds-secondary/60 px-3 py-2 text-sm font-semibold text-ds-foreground hover:bg-ds-interactive-hover"
                  onClick={() => addDraftRow(setEditSteps)}
                >
                  <Plus className="h-4 w-4" aria-hidden />
                  Add step
                </button>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={saving || !editTitle.trim()}
                    onClick={() => void saveEdit()}
                    className="rounded-md bg-ds-accent px-4 py-2 text-sm font-semibold text-ds-accent-foreground disabled:opacity-50"
                  >
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : "Save changes"}
                  </button>
                  {selected.review_required && canReview ? (
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => void markReviewed()}
                      className="rounded-md border border-ds-border bg-ds-secondary/60 px-4 py-2 text-sm font-semibold text-ds-foreground hover:bg-ds-interactive-hover disabled:opacity-50"
                    >
                      Mark reviewed
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => {
                      setEditing(false);
                      setSelectedId(null);
                    }}
                    className="rounded-md border border-ds-border px-4 py-2 text-sm font-semibold text-ds-foreground hover:bg-ds-secondary"
                  >
                    Close
                  </button>
                </div>
              </>
            ) : (
              <div className="mt-4 min-w-0 space-y-5">
                {selected.is_critical ? (
                  <div className="rounded-lg border border-amber-200/90 bg-amber-50/90 px-3 py-2.5 text-sm text-amber-950 shadow-sm dark:border-amber-900/45 dark:bg-amber-950/30 dark:text-amber-50">
                    <span className="font-semibold">Critical procedure</span>
                    <span className="text-amber-950/90 dark:text-amber-100/85">
                      {" "}
                      — follow documented steps. If anything differs from this procedure or is unclear, stop and involve a
                      supervisor before continuing.
                    </span>
                  </div>
                ) : null}
                <div className="ds-premium-inset p-3">
                  <p className="text-sm font-semibold text-ds-foreground">Title</p>
                  <p className="mt-1 text-sm text-ds-muted">{selected.title}</p>
                  <p className="mt-1 text-[11px] text-ds-muted/90">{procedureVersionLabel(selected)}</p>
                </div>
                <p className="text-xs font-semibold uppercase tracking-wide text-ds-muted">
                  {selected.steps.length} {selected.steps.length === 1 ? "step" : "steps"}
                </p>
                <ol className="space-y-6">
                  {selected.steps.map((s, idx) => (
                    <li
                      key={idx}
                      id={`procedure-step-${selected.id}-${idx + 1}`}
                      className="ds-premium-inset scroll-mt-28 p-5"
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-4">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-sky-500 text-sm font-bold text-white shadow-md ring-1 ring-white/25">
                          {idx + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="whitespace-pre-wrap text-sm leading-relaxed text-ds-foreground">
                            {procedureStepDisplayText(s)}
                          </p>
                          {typeof s !== "string" && (s.recommended_workers || (s.tools?.length ?? 0) > 0) ? (
                            <div className="mt-3 flex flex-wrap gap-2 text-xs text-ds-muted">
                              {s.recommended_workers ? (
                                <span className="rounded-full border border-ds-border bg-ds-secondary/60 px-2 py-0.5 font-semibold">
                                  Recommended workers: {s.recommended_workers}
                                </span>
                              ) : null}
                              {(s.tools ?? []).map((t) => (
                                <span
                                  key={t}
                                  className="rounded-full border border-ds-border bg-ds-secondary/60 px-2 py-0.5 font-semibold"
                                >
                                  {t}
                                </span>
                              ))}
                            </div>
                          ) : null}
                          {typeof s !== "string" ? (
                            <StepImagePreview
                              imageUrl={s.image_url ?? null}
                              imageClassName="max-h-[min(28rem,70vh)] w-full max-w-3xl"
                            />
                          ) : null}
                        </div>
                      </div>
                    </li>
                  ))}
                </ol>

                {knowledgeVerificationEnabled && selected ? (
                  <div className="border-t border-ds-border pt-5">
                    <ProcedureKnowledgeVerification
                      procedureId={selected.id}
                      procedureTitle={selected.title}
                      onRefreshTraining={reloadMyTraining}
                    />
                  </div>
                ) : null}

                {api && userId && !knowledgeVerificationEnabled && selected ? (
                  <div className="border-t border-ds-border pt-5">
                    <ProcedureComplianceAcknowledgmentCard
                      procedureId={selected.id}
                      isCritical={Boolean(selected.is_critical)}
                      contentRevision={selected.content_revision ?? 1}
                      onRecorded={() => {
                        void reloadMyTraining();
                        void refreshProcedureLibraryCompliance();
                      }}
                      onError={(m) => setErr(m)}
                    />
                  </div>
                ) : null}

                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-ds-border pt-5">
                  <div className="min-w-0 space-y-1">
                    <button
                      type="button"
                      onClick={() => setSelectedId(null)}
                      className="rounded-md border border-ds-border px-4 py-2 text-sm font-semibold text-ds-foreground hover:bg-ds-secondary"
                    >
                      Back to library
                    </button>
                    <p className="max-w-xl text-[11px] leading-snug text-ds-muted">
                      {knowledgeVerificationEnabled ? (
                        <>
                          Finish <span className="font-semibold text-ds-foreground">review → acknowledgment → knowledge check</span>{" "}
                          above to record verified completion on your training assignment.
                        </>
                      ) : (
                        <>
                          {isApiMode() ? (
                            <>
                              Use <span className="font-semibold text-ds-foreground">Complete procedure</span> above after finishing
                              steps — the server records acknowledgment and updates the training matrix when this procedure is assigned
                              to you.
                            </>
                          ) : (
                            <>
                              Use <span className="font-semibold text-ds-foreground">Sign off complete</span> after finishing steps —
                              completion is tracked locally for demo mode.
                            </>
                          )}
                        </>
                      )}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {showAckCta ? (
                      <button
                        type="button"
                        onClick={() => setAckOpen(true)}
                        className="rounded-md bg-ds-accent px-4 py-2 text-sm font-semibold text-ds-accent-foreground shadow-sm hover:bg-ds-accent/90"
                      >
                        Continue to acknowledge
                      </button>
                    ) : null}
                    {!knowledgeVerificationEnabled && userId && !api ? (
                      <button
                        type="button"
                        onClick={() => void signCompletion()}
                        className="rounded-md border border-ds-border/90 bg-white px-4 py-2 text-sm font-semibold text-ds-foreground shadow-sm hover:bg-slate-50 dark:bg-ds-secondary dark:hover:bg-ds-secondary/90"
                        title={
                          signedOffForSelected
                            ? "Signed off (click again to update timestamp)"
                            : "Sign off completion"
                        }
                      >
                        {signedOffForSelected ? "Signed off" : "Sign off complete"}
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            )}
          </section>
        ) : null}

        <section
            className={cn(
              "ds-premium-panel flex min-h-0 flex-col overflow-hidden",
              !selected && !isCreating && "flex-1",
              isCreating && "h-full min-h-0",
              selected &&
                "lg:sticky lg:top-20 lg:flex lg:w-72 lg:shrink-0 lg:flex-col lg:self-stretch xl:w-80",
            )}
          >
            <div className="shrink-0 space-y-2 border-b border-ds-border bg-ds-surface-secondary px-4 py-2.5">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-ds-foreground">Library</h2>
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-wide text-ds-muted" htmlFor={`${formId}-lib-kw`}>
                  Filter by internal keyword
                </label>
                <input
                  id={`${formId}-lib-kw`}
                  type="search"
                  className="mt-1 w-full rounded-md border border-ds-border/90 bg-white px-2.5 py-1.5 text-sm text-ds-foreground dark:bg-ds-secondary"
                  placeholder="e.g. Tile or Pool Shutdown (comma = any match)"
                  value={libraryKeyword}
                  onChange={(e) => setLibraryKeyword(e.target.value)}
                  autoComplete="off"
                />
                <p className="mt-0.5 text-[10px] text-ds-muted">Uses saved procedure tags only — not step text.</p>
              </div>
            </div>
            <div
              className={cn(
                "flex min-h-0 flex-1 flex-col overflow-hidden",
                isCreating && "pointer-events-none opacity-50",
              )}
              aria-hidden={isCreating}
            >
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3">
                {loading ? (
                  <p className="text-sm text-ds-muted">Loading…</p>
                ) : rows.length === 0 ? (
                  <p className="text-sm text-ds-muted">No procedures yet.</p>
                ) : (
                  <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {librarySortedRows.map((r) => {
                      const tier = procedureLibraryTier(r, libraryComplianceCtx);
                      const compliancePct = libraryComplianceCtx
                        ? computeProgramColumnCompliancePercent(
                            r.id,
                            libraryComplianceCtx.employees,
                            libraryComplianceCtx.programs,
                            libraryComplianceCtx.assignments,
                            libraryComplianceCtx.acknowledgements,
                            { trustAssignmentStatus: libraryComplianceCtx.trustAssignmentStatus },
                          )
                        : null;
                      return (
                      <li key={r.id} className="min-w-0">
                        <button
                          type="button"
                          onClick={() => setSelectedId(r.id)}
                          className={cn(
                            "flex w-full items-start justify-between gap-2 rounded-xl border px-3 py-3 text-left text-sm text-ds-foreground shadow-sm transition-all",
                            "border-ds-border/90 bg-white hover:border-ds-border hover:shadow-md dark:border-ds-border dark:bg-ds-secondary dark:hover:bg-ds-secondary/90",
                            selectedId === r.id
                              ? "border-ds-accent/45 bg-ds-secondary/70 shadow-md ring-2 ring-ds-accent/25 dark:bg-ds-secondary dark:ring-ds-accent/35"
                              : "",
                          )}
                        >
                          <div className="min-w-0">
                            <span className={`font-medium ${selected ? "line-clamp-2" : ""}`}>{r.title}</span>
                            <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[10px] font-semibold text-ds-muted">
                              <span className={selected ? "line-clamp-1" : ""}>By {r.created_by_name?.trim() || "—"}</span>
                              {r.review_required ? (
                                <span className="rounded-full border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-amber-900">
                                  Needs review
                                </span>
                              ) : r.reviewed_at ? (
                                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-emerald-900">
                                  Reviewed
                                </span>
                              ) : null}
                            </div>
                          </div>
                          <div className="flex shrink-0 flex-col items-end gap-1">
                            <div className="flex flex-wrap justify-end gap-1">
                              <TrainingTierBadge tier={tier} label={trainingTierLabel(tier)} />
                              <span
                                className="inline-flex shrink-0 items-center rounded-md border border-ds-border bg-ds-secondary/50 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide leading-none text-ds-muted tabular-nums dark:bg-ds-secondary/40"
                                title="Share of employees in compliance for this procedure on the team training matrix (complete or expiring soon)."
                              >
                                {compliancePct == null ? "—" : `${compliancePct}%`}
                              </span>
                            </div>
                            <span className="text-[11px] tabular-nums text-ds-muted">{r.steps.length}</span>
                          </div>
                        </button>
                      </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>
          </section>
      </div>

      {ackOpen && !editing && selected && ackForId === selected.id ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/30 px-4 py-8">
          <div className="w-full max-w-lg rounded-xl border border-ds-border bg-ds-elevated p-5 shadow-[var(--ds-shadow-diffuse)]">
            <h3 className="text-base font-semibold text-ds-foreground">Acknowledge procedure</h3>
            <p className="mt-2 text-sm text-ds-muted">
              Please confirm you’ve read and understand this procedure. This will be recorded in your profile under Compliance.
            </p>
            <div className="ds-premium-inset mt-4 p-3 text-sm text-ds-foreground">
              <span className="font-semibold">Procedure:</span> {selected.title}
            </div>
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                className="rounded-md border border-ds-border px-4 py-2 text-sm font-semibold text-ds-foreground hover:bg-ds-secondary"
                onClick={() => setAckOpen(false)}
              >
                Not now
              </button>
              <button
                type="button"
                className="rounded-md bg-ds-accent px-4 py-2 text-sm font-semibold text-ds-accent-foreground"
                onClick={() => void signAcknowledgment()}
              >
                I acknowledge I’ve read this
              </button>
            </div>
          </div>
        </div>
      ) : null}
      </PageBody>
    </div>
  );
}
