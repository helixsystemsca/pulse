"use client";

import { useCallback, useEffect, useState } from "react";
import { HelpCircle } from "lucide-react";
import { PageBody } from "@/components/ui/PageBody";
import { PageHeader } from "@/components/ui/PageHeader";
import {
  createKnowledgeGap,
  deleteKnowledgeGap,
  listKnowledgeGaps,
  patchKnowledgeGap,
  type OpsKnowledgeGap,
} from "@/lib/recreation/commandService";

const inputClass =
  "w-full rounded-lg border border-ds-border bg-ds-bg px-3 py-2 text-sm text-ds-foreground outline-none focus:border-ds-primary";
const btnPrimary =
  "rounded-lg bg-ds-primary px-3 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50";

const STATUSES = ["open", "asked", "answered", "needs_review", "closed"] as const;
const PRIORITIES = ["low", "medium", "high", "urgent"] as const;

export default function KnowledgeGapsPage() {
  const [gaps, setGaps] = useState<OpsKnowledgeGap[]>([]);
  const [filter, setFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState({ question: "", category: "General", priority: "medium" });
  const [expanded, setExpanded] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await listKnowledgeGaps({
        q: filter || undefined,
        status: statusFilter || undefined,
      });
      setGaps(rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load knowledge gaps");
    } finally {
      setLoading(false);
    }
  }, [filter, statusFilter]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Knowledge Gaps"
        description="Capture questions you still need answered — who should know, status, and what you learn."
        icon={HelpCircle}
      />
      <PageBody>
        {error ? (
          <p className="mb-4 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>
        ) : null}

        <div className="mb-6 space-y-3 rounded-xl border border-ds-border bg-ds-card p-4">
          <h3 className="text-sm font-semibold text-ds-foreground">Add a gap</h3>
          <textarea
            className={inputClass}
            rows={2}
            placeholder="What do you still need to know?"
            value={draft.question}
            onChange={(e) => setDraft({ ...draft, question: e.target.value })}
          />
          <div className="flex flex-wrap gap-2">
            <input
              className={`${inputClass} w-40`}
              placeholder="Category"
              value={draft.category}
              onChange={(e) => setDraft({ ...draft, category: e.target.value })}
            />
            <select
              className={`${inputClass} w-32`}
              value={draft.priority}
              onChange={(e) => setDraft({ ...draft, priority: e.target.value })}
            >
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
            <button
              type="button"
              className={btnPrimary}
              disabled={!draft.question.trim()}
              onClick={async () => {
                const row = await createKnowledgeGap({
                  question: draft.question.trim(),
                  category: draft.category,
                  priority: draft.priority,
                });
                setGaps((prev) => [row, ...prev]);
                setDraft({ question: "", category: "General", priority: "medium" });
                setExpanded(row.id);
              }}
            >
              Add gap
            </button>
          </div>
        </div>

        <div className="mb-4 flex flex-wrap gap-2">
          <input
            className={`${inputClass} max-w-xs`}
            placeholder="Search…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
          <select
            className={`${inputClass} w-40`}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">All statuses</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        {loading ? (
          <p className="text-sm text-ds-muted">Loading…</p>
        ) : (
          <ul className="space-y-3">
            {gaps.map((g) => {
              const open = expanded === g.id;
              return (
                <li key={g.id} className="rounded-xl border border-ds-border bg-ds-card p-4">
                  <button
                    type="button"
                    className="flex w-full items-start justify-between gap-3 text-left"
                    onClick={() => setExpanded(open ? null : g.id)}
                  >
                    <div>
                      <p className="font-medium text-ds-foreground">{g.question}</p>
                      <p className="mt-1 text-xs text-ds-muted">
                        {g.category} · {g.priority} · {g.status}
                      </p>
                    </div>
                    <span className="text-xs text-ds-muted">{open ? "Collapse" : "Expand"}</span>
                  </button>
                  {open ? (
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <label className="block sm:col-span-2">
                        <span className="mb-1 block text-xs uppercase text-ds-muted">Answer</span>
                        <textarea
                          className={inputClass}
                          rows={3}
                          value={g.answer ?? ""}
                          onChange={(e) =>
                            setGaps((prev) =>
                              prev.map((x) => (x.id === g.id ? { ...x, answer: e.target.value } : x)),
                            )
                          }
                          onBlur={async () => {
                            await patchKnowledgeGap(g.id, { answer: g.answer });
                          }}
                        />
                      </label>
                      <label className="block">
                        <span className="mb-1 block text-xs uppercase text-ds-muted">Status</span>
                        <select
                          className={inputClass}
                          value={g.status}
                          onChange={async (e) => {
                            const next = await patchKnowledgeGap(g.id, { status: e.target.value });
                            setGaps((prev) => prev.map((x) => (x.id === g.id ? next : x)));
                          }}
                        >
                          {STATUSES.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="block">
                        <span className="mb-1 block text-xs uppercase text-ds-muted">Who should answer</span>
                        <input
                          className={inputClass}
                          value={g.who_should_answer ?? ""}
                          onChange={(e) =>
                            setGaps((prev) =>
                              prev.map((x) =>
                                x.id === g.id ? { ...x, who_should_answer: e.target.value } : x,
                              ),
                            )
                          }
                          onBlur={async () => {
                            await patchKnowledgeGap(g.id, { who_should_answer: g.who_should_answer });
                          }}
                        />
                      </label>
                      <label className="block">
                        <span className="mb-1 block text-xs uppercase text-ds-muted">Source</span>
                        <input
                          className={inputClass}
                          value={g.source ?? ""}
                          onChange={(e) =>
                            setGaps((prev) =>
                              prev.map((x) => (x.id === g.id ? { ...x, source: e.target.value } : x)),
                            )
                          }
                          onBlur={async () => {
                            await patchKnowledgeGap(g.id, { source: g.source });
                          }}
                        />
                      </label>
                      <label className="block">
                        <span className="mb-1 block text-xs uppercase text-ds-muted">Related person</span>
                        <input
                          className={inputClass}
                          value={g.related_person ?? ""}
                          onChange={(e) =>
                            setGaps((prev) =>
                              prev.map((x) =>
                                x.id === g.id ? { ...x, related_person: e.target.value } : x,
                              ),
                            )
                          }
                          onBlur={async () => {
                            await patchKnowledgeGap(g.id, { related_person: g.related_person });
                          }}
                        />
                      </label>
                      <div className="sm:col-span-2 flex justify-end">
                        <button
                          type="button"
                          className="text-sm text-red-700 hover:underline"
                          onClick={async () => {
                            if (!confirm("Delete this knowledge gap?")) return;
                            await deleteKnowledgeGap(g.id);
                            setGaps((prev) => prev.filter((x) => x.id !== g.id));
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ) : null}
                </li>
              );
            })}
            {!gaps.length ? (
              <p className="text-sm text-ds-muted">No knowledge gaps yet — capture questions as you find them.</p>
            ) : null}
          </ul>
        )}
      </PageBody>
    </div>
  );
}
