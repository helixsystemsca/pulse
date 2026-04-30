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
  uploadProcedureStepImage,
  type ProcedureRow,
} from "@/lib/cmmsApi";
import { useResolvedProtectedAssetSrc } from "@/lib/useResolvedProtectedAssetSrc";
import { parseClientApiError } from "@/lib/parse-client-api-error";
import { sessionHasAnyRole } from "@/lib/pulse-roles";
import { readSession } from "@/lib/pulse-session";
import { acknowledgeProcedure, hasAcknowledgedProcedure } from "@/lib/procedureAcknowledgments";
import { fetchWorkerList, fetchWorkerSettings } from "@/lib/workersService";

const PROCEDURES_HEADER_BTN =
  "ds-btn-solid-primary inline-flex items-center justify-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50";
const PROCEDURES_HEADER_BTN_OUTLINE =
  "app-btn-secondary inline-flex items-center justify-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold shadow-sm disabled:cursor-not-allowed disabled:opacity-50";

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

function toDraftFromProcedure(row: ProcedureRow): DraftStep[] {
  return row.steps.map((s) => ({
    key: newKey(),
    text: typeof s === "string" ? s : s.text ?? "",
    file: null,
    image_url: typeof s === "string" ? null : (s.image_url ?? null),
    recommended_workers: typeof s === "string" ? null : (s.recommended_workers ?? null),
    tools_csv: typeof s === "string" ? "" : ((s.tools ?? []).join(", ") || ""),
  }));
}

function StepImagePreview({ imageUrl }: { imageUrl: string | null }) {
  const { src, loading, failed } = useResolvedProtectedAssetSrc(imageUrl);
  if (!imageUrl) return null;
  if (loading) return <Loader2 className="h-6 w-6 animate-spin text-ds-muted" aria-hidden />;
  if (failed || !src) return <p className="text-xs text-ds-danger">Could not load image</p>;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="" className="mt-2 max-h-40 w-full rounded-md border border-ds-border object-contain" />;
}

export function ProceduresApp() {
  const formId = useId();
  const [isCreating, setIsCreating] = useState(false);
  const [rows, setRows] = useState<ProcedureRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [draftSteps, setDraftSteps] = useState<DraftStep[]>([
    { key: newKey(), text: "", file: null, image_url: null, recommended_workers: null, tools_csv: "" },
  ]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editSteps, setEditSteps] = useState<DraftStep[]>([]);
  const [editCreatorName, setEditCreatorName] = useState("");
  const [ackOpen, setAckOpen] = useState(false);
  const [ackForId, setAckForId] = useState<string | null>(null);
  /** Step index when reading a not-yet-acknowledged procedure (paginated); modal opens after Next on the last step. */
  const [readerStep, setReaderStep] = useState(0);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignKind, setAssignKind] = useState<"complete" | "revise" | "create">("complete");
  const [assignWorkerId, setAssignWorkerId] = useState("");
  const [assignNote, setAssignNote] = useState("");
  const [workerOptions, setWorkerOptions] = useState<{ id: string; label: string }[]>([]);
  const [assigning, setAssigning] = useState(false);
  const session = readSession();
  const canReview = sessionHasAnyRole(session, "lead", "supervisor", "manager", "company_admin");
  const userId = session?.sub ?? null;
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
      const list = await fetchProcedures();
      setRows(list);
    } catch (e) {
      setErr(parseClientApiError(e).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

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
      setEditSteps([]);
      setEditCreatorName("");
      setAckOpen(false);
      setAckForId(null);
      setReaderStep(0);
      setEditing(false);
      return;
    }
    setEditTitle(selected.title);
    setEditSteps(toDraftFromProcedure(selected));
    setEditCreatorName(selected.created_by_name?.trim() || "");
    setAckForId(selected.id);
    setAckOpen(false);
  }, [selected, editing]);

  useEffect(() => {
    if (!selected?.id) return;
    setReaderStep(0);
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
        created_by_user_id: creatorId,
        created_by_name: creatorName,
        review_required: needsReview,
      });
      await uploadPendingFiles(proc.id, draftSteps);
      setTitle("");
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
        revised_by_user_id: reviserId,
        revised_by_name: reviserName,
        ...(canReview
          ? {
              created_by_name: editCreatorName.trim() || null,
            }
          : {}),
      });
      await uploadPendingFiles(selectedId, editSteps);
      await load();
    } catch (e) {
      setErr(parseClientApiError(e).message);
    } finally {
      setSaving(false);
    }
  };

  const signAcknowledgment = async () => {
    if (!userId || !selected) return;
    try {
      acknowledgeProcedure(userId, selected.id, selected.title);
    } finally {
      setAckOpen(false);
    }
  };

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
          className="rounded-lg border border-ds-border bg-ds-secondary/40 p-4 shadow-sm dark:bg-ds-secondary/30"
        >
          <div className="flex items-start justify-between gap-2">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ds-primary text-sm font-bold text-ds-foreground ring-1 ring-ds-border">
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
            className="mt-1 min-h-[4rem] w-full rounded-md border border-ds-border bg-ds-primary px-3 py-2 text-sm text-ds-foreground dark:bg-ds-secondary"
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
                className="mt-1 w-full rounded-md border border-ds-border bg-ds-primary px-3 py-2 text-sm text-ds-foreground dark:bg-ds-secondary"
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
                className="mt-1 w-full rounded-md border border-ds-border bg-ds-primary px-3 py-2 text-sm text-ds-foreground dark:bg-ds-secondary"
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
                        className="rounded-full border border-ds-border bg-ds-primary px-2 py-0.5 text-[11px] font-semibold text-ds-foreground"
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
    <div className="space-y-6">
      <PageHeader
        title="Procedures"
        description="Reusable maintenance procedures with numbered steps, optional photos, and acknowledgments."
        icon={ClipboardList}
        actions={
          isCreating ? (
            <button
              type="button"
              className="rounded-[10px] border border-ds-border bg-ds-primary px-5 py-2.5 text-sm font-semibold text-ds-foreground shadow-sm transition-colors hover:bg-ds-secondary disabled:opacity-50 dark:bg-ds-secondary"
              onClick={() => {
                setIsCreating(false);
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

      <PageBody>

      {assignOpen ? (
        <div className="rounded-xl border border-ds-border bg-white p-4 shadow-[var(--ds-shadow-card)] dark:bg-ds-surface-primary">
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

      {err ? (
        <div className="rounded-xl border border-ds-border bg-ds-primary px-4 py-3 text-sm font-medium text-ds-danger shadow-sm">
          {err}
        </div>
      ) : null}

      <div className={isCreating ? "grid gap-6 lg:grid-cols-2" : "space-y-6"}>
        {isCreating ? (
          <section className="rounded-xl border border-ds-border bg-ds-primary p-6 shadow-[var(--ds-shadow-card)]">
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
                className="w-full rounded-md border border-ds-border bg-ds-primary px-3 py-2 text-sm dark:bg-ds-secondary"
                placeholder="e.g. Monthly pump inspection"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
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
                  className="ds-btn-secondary px-4 py-2.5 text-sm"
                  onClick={() => {
                    setIsCreating(false);
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
                  className="ds-btn-solid-primary inline-flex items-center gap-2 px-4 py-2.5 text-sm disabled:opacity-50"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
                  Create procedure
                </button>
              </div>
            </div>
          </section>
        ) : null}

        <section className="overflow-hidden rounded-xl border border-ds-border bg-ds-primary shadow-[var(--ds-shadow-card)]">
          <div className="border-b border-ds-border bg-ds-surface-secondary px-4 py-2.5">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-ds-foreground">Library</h2>
          </div>
          <div className={`p-6 ${isCreating ? "pointer-events-none opacity-50" : ""}`} aria-hidden={isCreating}>
          {loading ? (
            <p className="text-sm text-ds-muted">Loading…</p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-ds-muted">No procedures yet.</p>
          ) : (
            <ul className="max-h-[min(50vh,24rem)] divide-y divide-ds-border overflow-auto">
              {rows.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(r.id)}
                    className={`flex w-full items-start justify-between gap-3 rounded-lg px-3 py-3 text-left text-sm transition-all ${
                      selectedId === r.id
                        ? "bg-ds-secondary text-ds-foreground"
                        : "hover:bg-ds-secondary/60 hover:shadow-sm"
                    }`}
                  >
                    <div className="min-w-0">
                      <span className="font-medium">{r.title}</span>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] font-semibold text-ds-muted">
                        <span>By {r.created_by_name?.trim() || "—"}</span>
                        {r.review_required ? (
                          <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-amber-900">
                            Needs review
                          </span>
                        ) : r.reviewed_at ? (
                          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-emerald-900">
                            Reviewed
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <span className="shrink-0 text-xs text-ds-muted">{r.steps.length} steps</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          </div>
        </section>

        {!isCreating && selected ? (
          <section className="rounded-xl border border-ds-border bg-ds-primary p-6 shadow-[var(--ds-shadow-card)]">
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
                      className="mt-1 w-full rounded-md border border-ds-border bg-ds-primary px-3 py-2 text-sm dark:bg-ds-secondary"
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
                  className="mt-1 w-full rounded-md border border-ds-border bg-ds-primary px-3 py-2 text-sm dark:bg-ds-secondary"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                />
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
            ) : userId && !hasAcknowledgedProcedure(userId, selected.id) ? (
              <div className="mt-4 space-y-4">
                <div className="rounded-md border border-ds-border bg-ds-secondary/40 p-3">
                  <p className="text-sm font-semibold text-ds-foreground">Title</p>
                  <p className="mt-1 text-sm text-ds-muted">{selected.title}</p>
                </div>
                <p className="text-xs font-semibold uppercase tracking-wide text-ds-muted">
                  Step {readerStep + 1} of {selected.steps.length}
                </p>
                {(() => {
                  const s = selected.steps[readerStep];
                  if (s === undefined) return null;
                  const step = typeof s === "string" ? { text: s } : s;
                  const idx = readerStep;
                  return (
                    <ol className="space-y-3">
                      <li className="rounded-md border border-ds-border bg-ds-primary p-4">
                        <div className="flex items-start gap-3">
                          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-ds-border bg-ds-secondary text-xs font-bold text-ds-foreground">
                            {idx + 1}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="whitespace-pre-wrap text-sm text-ds-foreground">{step.text ?? ""}</p>
                            {typeof s !== "string" && (s.recommended_workers || (s.tools?.length ?? 0) > 0) ? (
                              <div className="mt-2 flex flex-wrap gap-2 text-xs text-ds-muted">
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
                            {typeof s !== "string" ? <StepImagePreview imageUrl={s.image_url ?? null} /> : null}
                          </div>
                        </div>
                      </li>
                    </ol>
                  );
                })()}
                <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-ds-border pt-4">
                  <button
                    type="button"
                    onClick={() => setSelectedId(null)}
                    className="rounded-md border border-ds-border px-4 py-2 text-sm font-semibold text-ds-foreground hover:bg-ds-secondary"
                  >
                    Close
                  </button>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={readerStep <= 0}
                      onClick={() => setReaderStep((n) => Math.max(0, n - 1))}
                      className="rounded-md border border-ds-border px-4 py-2 text-sm font-semibold text-ds-foreground hover:bg-ds-secondary disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Back
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (readerStep < selected.steps.length - 1) {
                          setReaderStep((n) => Math.min(selected.steps.length - 1, n + 1));
                        } else {
                          setAckOpen(true);
                        }
                      }}
                      className="rounded-md bg-ds-accent px-4 py-2 text-sm font-semibold text-ds-accent-foreground shadow-sm hover:bg-ds-accent/90"
                    >
                      Next
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-4 space-y-4">
                <div className="rounded-md border border-ds-border bg-ds-secondary/40 p-3">
                  <p className="text-sm font-semibold text-ds-foreground">Title</p>
                  <p className="mt-1 text-sm text-ds-muted">{selected.title}</p>
                </div>
                <ol className="space-y-3">
                  {selected.steps.map((s, idx) => {
                    const step = typeof s === "string" ? { text: s } : s;
                    return (
                      <li key={idx} className="rounded-md border border-ds-border bg-ds-primary p-4">
                        <div className="flex items-start gap-3">
                          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-ds-border bg-ds-secondary text-xs font-bold text-ds-foreground">
                            {idx + 1}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="whitespace-pre-wrap text-sm text-ds-foreground">{step.text ?? ""}</p>
                            {(typeof s !== "string" && (s.recommended_workers || (s.tools?.length ?? 0) > 0)) ? (
                              <div className="mt-2 flex flex-wrap gap-2 text-xs text-ds-muted">
                                {s.recommended_workers ? (
                                  <span className="rounded-full border border-ds-border bg-ds-secondary/60 px-2 py-0.5 font-semibold">
                                    Recommended workers: {s.recommended_workers}
                                  </span>
                                ) : null}
                                {(s.tools ?? []).map((t) => (
                                  <span key={t} className="rounded-full border border-ds-border bg-ds-secondary/60 px-2 py-0.5 font-semibold">
                                    {t}
                                  </span>
                                ))}
                              </div>
                            ) : null}
                            {typeof s !== "string" ? <StepImagePreview imageUrl={s.image_url ?? null} /> : null}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ol>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedId(null)}
                    className="rounded-md border border-ds-border px-4 py-2 text-sm font-semibold text-ds-foreground hover:bg-ds-secondary"
                  >
                    Close
                  </button>
                </div>
              </div>
            )}
          </section>
        ) : null}
      </div>

      {ackOpen && !editing && selected && ackForId === selected.id ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/30 px-4 py-8">
          <div className="w-full max-w-lg rounded-xl border border-ds-border bg-ds-elevated p-5 shadow-[var(--ds-shadow-diffuse)]">
            <h3 className="text-base font-semibold text-ds-foreground">Acknowledge procedure</h3>
            <p className="mt-2 text-sm text-ds-muted">
              Please confirm you’ve read and understand this procedure. This will be recorded in your profile under Compliance.
            </p>
            <div className="mt-4 rounded-md border border-ds-border bg-ds-primary p-3 text-sm text-ds-foreground">
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
