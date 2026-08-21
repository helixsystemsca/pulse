"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CheckSquare, Trash2 } from "lucide-react";
import { PageBody } from "@/components/ui/PageBody";
import { PageHeader } from "@/components/ui/PageHeader";
import {
  deleteChecklist,
  listChecklistTemplates,
  listChecklists,
  patchChecklistItem,
  startChecklist,
  type OpsChecklistInstance,
  type OpsChecklistTemplate,
} from "@/lib/recreation/commandService";

const btnGhost =
  "rounded-lg border border-ds-border px-3 py-1.5 text-sm text-ds-foreground hover:bg-ds-card";

function ChecklistsInner() {
  const search = useSearchParams();
  const focusId = search.get("id");
  const [templates, setTemplates] = useState<OpsChecklistTemplate[]>([]);
  const [instances, setInstances] = useState<OpsChecklistInstance[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(focusId);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [t, i] = await Promise.all([listChecklistTemplates(), listChecklists()]);
      setTemplates(t);
      setInstances(i);
      if (focusId && i.some((x) => x.id === focusId)) setSelectedId(focusId);
      else if (!selectedId && i[0]) setSelectedId(i[0].id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load checklists");
    } finally {
      setLoading(false);
    }
  }, [focusId, selectedId]);

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initial load
  }, []);

  const selected = useMemo(
    () => instances.find((i) => i.id === selectedId) ?? null,
    [instances, selectedId],
  );

  const sections = useMemo(() => {
    if (!selected) return [] as { section: string; items: NonNullable<typeof selected>["items"] }[];
    const map = new Map<string, typeof selected.items>();
    for (const item of selected.items) {
      const list = map.get(item.section) ?? [];
      list.push(item);
      map.set(item.section, list);
    }
    return Array.from(map.entries()).map(([section, items]) => ({ section, items }));
  }, [selected]);

  async function onStart(slug: string) {
    setStarting(true);
    try {
      const row = await startChecklist({ template_slug: slug });
      setInstances((prev) => [row, ...prev]);
      setSelectedId(row.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start checklist");
    } finally {
      setStarting(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Checklists"
        description="Personal operating checklists — start from templates (First 30 / 90 / Year) or track progress on active lists."
        icon={CheckSquare}
      />
      <PageBody>
        {error ? (
          <p className="mb-4 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>
        ) : null}
        {loading ? (
          <p className="text-sm text-ds-muted">Loading…</p>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[16rem_1fr]">
            <aside className="space-y-4">
              <div>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ds-muted">Templates</h3>
                <ul className="space-y-2">
                  {templates.map((t) => (
                    <li key={t.id}>
                      <button
                        type="button"
                        disabled={starting}
                        className="w-full rounded-lg border border-ds-border bg-ds-card px-3 py-2 text-left text-sm hover:border-ds-primary/40"
                        onClick={() => void onStart(t.slug)}
                      >
                        <span className="font-medium text-ds-foreground">{t.title}</span>
                        {t.description ? (
                          <span className="mt-0.5 block text-xs text-ds-muted line-clamp-2">{t.description}</span>
                        ) : null}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ds-muted">My checklists</h3>
                <ul className="space-y-1">
                  {instances.map((i) => (
                    <li key={i.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedId(i.id)}
                        className={`w-full rounded-lg px-3 py-2 text-left text-sm ${
                          selectedId === i.id ? "bg-ds-primary text-white" : "hover:bg-ds-card"
                        }`}
                      >
                        <span className="block font-medium">{i.title}</span>
                        <span className={`text-xs ${selectedId === i.id ? "text-white/80" : "text-ds-muted"}`}>
                          {i.progress_pct}% · {i.status}
                        </span>
                      </button>
                    </li>
                  ))}
                  {!instances.length ? (
                    <p className="text-xs text-ds-muted">Start a template to create your first checklist.</p>
                  ) : null}
                </ul>
              </div>
            </aside>

            <section>
              {!selected ? (
                <p className="text-sm text-ds-muted">Select or start a checklist.</p>
              ) : (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h2 className="text-lg font-semibold text-ds-foreground">{selected.title}</h2>
                      {selected.description ? (
                        <p className="mt-1 text-sm text-ds-muted">{selected.description}</p>
                      ) : null}
                      <div className="mt-3 h-2 max-w-md overflow-hidden rounded-full bg-ds-border">
                        <div
                          className="h-full rounded-full bg-ds-primary transition-all"
                          style={{ width: `${selected.progress_pct}%` }}
                        />
                      </div>
                      <p className="mt-1 text-xs text-ds-muted">
                        {selected.items.filter((x) => x.completed).length} / {selected.items.length} complete (
                        {selected.progress_pct}%)
                      </p>
                    </div>
                    <button
                      type="button"
                      className={`${btnGhost} inline-flex items-center gap-1.5 text-red-700`}
                      onClick={async () => {
                        if (!confirm("Delete this checklist?")) return;
                        await deleteChecklist(selected.id);
                        setInstances((prev) => prev.filter((x) => x.id !== selected.id));
                        setSelectedId(null);
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Delete
                    </button>
                  </div>

                  {sections.map(({ section, items }) => (
                    <div key={section}>
                      <h3 className="mb-2 text-sm font-semibold text-ds-foreground">{section}</h3>
                      <ul className="space-y-1">
                        {items.map((item) => (
                          <li
                            key={item.id}
                            className="flex items-start gap-3 rounded-lg border border-ds-border/70 px-3 py-2"
                          >
                            <input
                              type="checkbox"
                              className="mt-1"
                              checked={item.completed}
                              onChange={async (e) => {
                                const next = await patchChecklistItem(item.id, { completed: e.target.checked });
                                setInstances((prev) =>
                                  prev.map((inst) => {
                                    if (inst.id !== selected.id) return inst;
                                    const itemsNext = inst.items.map((it) => (it.id === item.id ? next : it));
                                    const done = itemsNext.filter((x) => x.completed).length;
                                    const pct = itemsNext.length
                                      ? Math.round((100 * done) / itemsNext.length)
                                      : 0;
                                    return { ...inst, items: itemsNext, progress_pct: pct };
                                  }),
                                );
                              }}
                            />
                            <div className="min-w-0 flex-1">
                              <p
                                className={`text-sm ${item.completed ? "text-ds-muted line-through" : "text-ds-foreground"}`}
                              >
                                {item.title}
                              </p>
                              {item.description ? (
                                <p className="text-xs text-ds-muted">{item.description}</p>
                              ) : null}
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
      </PageBody>
    </div>
  );
}

export default function RecreationChecklistsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center">
          <p className="text-sm text-ds-muted">Loading checklists…</p>
        </div>
      }
    >
      <ChecklistsInner />
    </Suspense>
  );
}
