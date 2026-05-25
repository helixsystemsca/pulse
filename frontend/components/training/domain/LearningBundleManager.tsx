"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Plus, Save } from "lucide-react";
import { fetchTrainingMatrix } from "@/lib/trainingApi";
import { readSession } from "@/lib/pulse-session";
import { parseClientApiError } from "@/lib/parse-client-api-error";
import {
  createLearningBundleId,
  LEARNING_BUNDLE_CATEGORY_LABELS,
  readLearningBundles,
  upsertLearningBundle,
  type LearningBundle,
  type LearningBundleCategory,
  type LearningBundleItem,
} from "@/lib/training/learning-bundles";
import { cn } from "@/lib/cn";

/** Admin/supervisor Learning Bundle CRUD (local persistence until API exists). */
export function LearningBundleManager() {
  const session = readSession();
  const companyId = session?.company_id ?? null;

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [bundles, setBundles] = useState<LearningBundle[]>([]);
  const [programs, setPrograms] = useState<{ id: string; title: string }[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<LearningBundleCategory>("onboarding");
  const [dueWithinDays, setDueWithinDays] = useState("");
  const [renewalMonths, setRenewalMonths] = useState("");
  const [requiresAck, setRequiresAck] = useState(true);
  const [requiresUpload, setRequiresUpload] = useState(false);
  const [selectedProcedureIds, setSelectedProcedureIds] = useState<string[]>([]);

  const loadBundles = useCallback(() => {
    if (!companyId) return;
    setBundles(readLearningBundles(companyId));
  }, [companyId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const matrix = await fetchTrainingMatrix();
        if (!cancelled) {
          setPrograms(
            (matrix.programs ?? [])
              .filter((p) => p.active)
              .map((p) => ({ id: p.id, title: p.title }))
              .sort((a, b) => a.title.localeCompare(b.title)),
          );
          loadBundles();
        }
      } catch (e) {
        if (!cancelled) setErr(parseClientApiError(e).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadBundles]);

  const editing = useMemo(
    () => bundles.find((b) => b.id === editingId) ?? null,
    [bundles, editingId],
  );

  const resetForm = useCallback(() => {
    setEditingId(null);
    setTitle("");
    setDescription("");
    setCategory("onboarding");
    setDueWithinDays("");
    setRenewalMonths("");
    setRequiresAck(true);
    setRequiresUpload(false);
    setSelectedProcedureIds([]);
  }, []);

  const startEdit = useCallback((bundle: LearningBundle) => {
    setEditingId(bundle.id);
    setTitle(bundle.title);
    setDescription(bundle.description);
    setCategory(bundle.category);
    setDueWithinDays(bundle.due_within_days != null ? String(bundle.due_within_days) : "");
    setRenewalMonths(bundle.renewal_months != null ? String(bundle.renewal_months) : "");
    setRequiresAck(bundle.requires_acknowledgement);
    setRequiresUpload(bundle.requires_upload);
    setSelectedProcedureIds(
      bundle.items.filter((i) => i.source === "procedure").map((i) => i.ref_id),
    );
  }, []);

  const startCreate = useCallback(() => {
    resetForm();
    setEditingId(createLearningBundleId());
  }, [resetForm]);

  const toggleProcedure = (id: string) => {
    setSelectedProcedureIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const handleSave = useCallback(() => {
    if (!companyId || !editingId) return;
    if (!title.trim()) {
      setErr("Title is required.");
      return;
    }
    const items: LearningBundleItem[] = selectedProcedureIds.map((ref_id, i) => {
      const prog = programs.find((p) => p.id === ref_id);
      return {
        id: `${editingId}-item-${ref_id}`,
        source: "procedure" as const,
        ref_id,
        label: prog?.title ?? ref_id,
        sort_order: i,
      };
    });
    const existing = bundles.find((b) => b.id === editingId);
    const now = new Date().toISOString();
    const bundle: LearningBundle = {
      id: editingId,
      title: title.trim(),
      description: description.trim(),
      category,
      items,
      due_within_days: dueWithinDays ? Number(dueWithinDays) : null,
      renewal_months: renewalMonths ? Number(renewalMonths) : null,
      requires_acknowledgement: requiresAck,
      requires_upload: requiresUpload,
      active: true,
      created_at: existing?.created_at ?? now,
      updated_at: now,
    };
    const next = upsertLearningBundle(companyId, bundle);
    setBundles(next);
    setErr(null);
    resetForm();
  }, [
    companyId,
    editingId,
    title,
    description,
    category,
    selectedProcedureIds,
    dueWithinDays,
    renewalMonths,
    requiresAck,
    requiresUpload,
    programs,
    bundles,
    resetForm,
  ]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-ds-muted">
        <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
        Loading bundles…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-ds-foreground">Learning bundles</h3>
          <p className="mt-1 text-sm text-ds-muted">
            Reusable grouped assignments (onboarding tracks, certification paths). External CRD links can be added later
            as <code className="text-xs">source: external</code> items without restructuring.
          </p>
        </div>
        <button
          type="button"
          onClick={startCreate}
          className="inline-flex items-center gap-2 rounded-lg border border-ds-border px-3 py-2 text-sm font-semibold text-ds-foreground hover:bg-ds-muted/20"
        >
          <Plus className="h-4 w-4" />
          Create bundle
        </button>
      </div>

      {err ? (
        <p className="text-sm font-medium text-rose-600 dark:text-rose-400" role="alert">
          {err}
        </p>
      ) : null}

      <ul className="divide-y divide-ds-border rounded-xl border border-ds-border">
        {bundles.map((b) => (
          <li key={b.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
            <div>
              <p className="font-semibold text-ds-foreground">{b.title}</p>
              <p className="text-xs text-ds-muted">
                {LEARNING_BUNDLE_CATEGORY_LABELS[b.category]} · {b.items.length} item(s)
                {b.due_within_days != null ? ` · due in ${b.due_within_days}d` : ""}
              </p>
            </div>
            <button
              type="button"
              onClick={() => startEdit(b)}
              className="text-sm font-semibold text-teal-700 hover:underline dark:text-teal-300"
            >
              Edit
            </button>
          </li>
        ))}
      </ul>

      {editingId ? (
        <section className="space-y-4 rounded-xl border border-dashed border-ds-border bg-ds-muted/10 p-4">
          <h4 className="font-semibold text-ds-foreground">{editing ? "Edit bundle" : "New bundle"}</h4>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm sm:col-span-2">
              <span className="font-medium">Title</span>
              <input
                className="mt-1 w-full rounded-lg border border-ds-border bg-ds-primary px-3 py-2 text-sm"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </label>
            <label className="block text-sm sm:col-span-2">
              <span className="font-medium">Description</span>
              <textarea
                className="mt-1 w-full rounded-lg border border-ds-border bg-ds-primary px-3 py-2 text-sm"
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </label>
            <label className="block text-sm">
              <span className="font-medium">Category</span>
              <select
                className="mt-1 w-full rounded-lg border border-ds-border bg-ds-primary px-3 py-2 text-sm"
                value={category}
                onChange={(e) => setCategory(e.target.value as LearningBundleCategory)}
              >
                {(Object.keys(LEARNING_BUNDLE_CATEGORY_LABELS) as LearningBundleCategory[]).map((k) => (
                  <option key={k} value={k}>
                    {LEARNING_BUNDLE_CATEGORY_LABELS[k]}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="font-medium">Due within (days)</span>
              <input
                type="number"
                min={0}
                className="mt-1 w-full rounded-lg border border-ds-border bg-ds-primary px-3 py-2 text-sm"
                value={dueWithinDays}
                onChange={(e) => setDueWithinDays(e.target.value)}
              />
            </label>
            <label className="block text-sm">
              <span className="font-medium">Renewal (months)</span>
              <input
                type="number"
                min={0}
                className="mt-1 w-full rounded-lg border border-ds-border bg-ds-primary px-3 py-2 text-sm"
                value={renewalMonths}
                onChange={(e) => setRenewalMonths(e.target.value)}
              />
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={requiresAck} onChange={(e) => setRequiresAck(e.target.checked)} />
              Requires acknowledgement
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={requiresUpload} onChange={(e) => setRequiresUpload(e.target.checked)} />
              Requires upload
            </label>
          </div>
          <div>
            <p className="text-sm font-medium text-ds-foreground">Included procedures</p>
            <div className="mt-2 max-h-48 overflow-y-auto rounded-lg border border-ds-border p-2">
              {programs.length === 0 ? (
                <p className="text-sm text-ds-muted">No active procedures in matrix.</p>
              ) : (
                programs.map((p) => (
                  <label key={p.id} className="flex cursor-pointer items-center gap-2 py-1 text-sm">
                    <input
                      type="checkbox"
                      checked={selectedProcedureIds.includes(p.id)}
                      onChange={() => toggleProcedure(p.id)}
                    />
                    {p.title}
                  </label>
                ))
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleSave}
              className="inline-flex items-center gap-2 rounded-lg bg-ds-primary px-4 py-2 text-sm font-semibold text-white"
            >
              <Save className="h-4 w-4" />
              Save bundle
            </button>
            <button
              type="button"
              onClick={resetForm}
              className={cn(
                "rounded-lg px-4 py-2 text-sm font-semibold text-ds-muted hover:text-ds-foreground",
              )}
            >
              Cancel
            </button>
          </div>
        </section>
      ) : null}
    </div>
  );
}
