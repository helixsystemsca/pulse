"use client";

import { ImagePlus, Loader2, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useId, useState, type Dispatch, type SetStateAction } from "react";
import {
  createProcedure,
  fetchProcedures,
  patchProcedure,
  uploadProcedureStepImage,
  type ProcedureRow,
} from "@/lib/cmmsApi";
import { useResolvedProtectedAssetSrc } from "@/lib/useResolvedProtectedAssetSrc";
import { parseClientApiError } from "@/lib/parse-client-api-error";

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
  const [saving, setSaving] = useState(false);

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

  const selected = selectedId ? rows.find((r) => r.id === selectedId) ?? null : null;

  useEffect(() => {
    if (!selected) {
      setEditTitle("");
      setEditSteps([]);
      return;
    }
    setEditTitle(selected.title);
    setEditSteps(toDraftFromProcedure(selected));
  }, [selected]);

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
      const proc = await createProcedure({ title: t, steps: normalized });
      await uploadPendingFiles(proc.id, draftSteps);
      setTitle("");
      setDraftSteps([{ key: newKey(), text: "", file: null, image_url: null, recommended_workers: null, tools_csv: "" }]);
      await load();
    } catch (e) {
      setErr(parseClientApiError(e).message);
    } finally {
      setSaving(false);
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
      await patchProcedure(selectedId, { title: t, steps: normalized });
      await uploadPendingFiles(selectedId, editSteps);
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
    <div className="grid gap-8 lg:grid-cols-2">
      <section className="rounded-md border border-ds-border bg-ds-primary p-5 shadow-[var(--ds-shadow-card)]">
        <h2 className="text-base font-semibold text-ds-foreground" id={`${formId}-new-title`}>
          New procedure
        </h2>
        <p className="mt-1 text-sm text-ds-muted">Numbered steps, optional photo per step. Pictures upload after the procedure is created.</p>
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
          <button
            type="button"
            disabled={saving || !title.trim()}
            onClick={() => void create()}
            className="mt-4 w-full rounded-md bg-ds-accent px-4 py-2.5 text-sm font-semibold text-ds-accent-foreground shadow-sm hover:bg-ds-accent/90 disabled:opacity-50 sm:w-auto"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : "Create procedure"}
          </button>
        </div>
      </section>

      <div className="space-y-4">
        {err ? <p className="text-sm text-ds-danger">{err}</p> : null}

        <section className="rounded-md border border-ds-border bg-ds-primary p-5 shadow-[var(--ds-shadow-card)]">
          <h2 className="text-base font-semibold text-ds-foreground">Library</h2>
          {loading ? (
            <p className="mt-3 text-sm text-ds-muted">Loading…</p>
          ) : rows.length === 0 ? (
            <p className="mt-3 text-sm text-ds-muted">No procedures yet.</p>
          ) : (
            <ul className="mt-3 max-h-[min(50vh,24rem)] divide-y divide-ds-border overflow-auto">
              {rows.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(r.id)}
                    className={`flex w-full items-start justify-between gap-2 px-2 py-3 text-left text-sm transition-colors ${
                      selectedId === r.id ? "bg-ds-secondary text-ds-foreground" : "ds-table-row-hover"
                    }`}
                  >
                    <span className="font-medium">{r.title}</span>
                    <span className="shrink-0 text-xs text-ds-muted">{r.steps.length} steps</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {selected ? (
          <section className="rounded-md border border-ds-border bg-ds-primary p-5 shadow-[var(--ds-shadow-card)]">
            <h2 className="text-base font-semibold text-ds-foreground">Edit</h2>
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
              <button
                type="button"
                onClick={() => setSelectedId(null)}
                className="rounded-md border border-ds-border px-4 py-2 text-sm font-semibold text-ds-foreground hover:bg-ds-secondary"
              >
                Close
              </button>
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}
