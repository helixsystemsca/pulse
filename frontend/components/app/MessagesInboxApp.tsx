"use client";

import { Gift, Inbox, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { isApiMode } from "@/lib/api";
import { parseClientApiError } from "@/lib/parse-client-api-error";
import {
  awardFeedbackXp,
  deleteFeedback,
  fetchCompanyFeedback,
  markAllFeedbackRead,
  markFeedbackRead,
  type FeedbackRow,
} from "@/lib/feedbackApi";
import { canAccessCompanyConfiguration } from "@/lib/pulse-roles";
import { usePulseAuth } from "@/hooks/usePulseAuth";
import { cn } from "@/lib/cn";

function dispatchFeedbackInboxUpdated() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("pulse-feedback-updated"));
}

function listPreview(body: string, max = 120): string {
  const one = body.replace(/\s+/g, " ").trim();
  if (one.length <= max) return one;
  return `${one.slice(0, max).trim()}…`;
}

export function MessagesInboxApp() {
  const { session } = usePulseAuth();
  const isAdmin = session ? canAccessCompanyConfiguration(session) : false;
  const [rows, setRows] = useState<FeedbackRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [xpById, setXpById] = useState<Record<string, number>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [markingReadId, setMarkingReadId] = useState<string | null>(null);

  const loadList = useCallback(async () => {
    const list = await fetchCompanyFeedback();
    setRows(list);
    return list;
  }, []);

  useEffect(() => {
    if (!isAdmin || !isApiMode()) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setErr(null);
      try {
        await loadList();
      } catch (e) {
        if (!cancelled) setErr(parseClientApiError(e).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isAdmin, loadList]);

  const selected = useMemo(() => rows.find((r) => r.id === selectedId) ?? null, [rows, selectedId]);

  const onSelectRow = useCallback(
    (id: string) => {
      setSelectedId(id);
      const row = rows.find((r) => r.id === id);
      if (!row?.admin_read_at) {
        setMarkingReadId(id);
        void markFeedbackRead(id)
          .then((updated) => {
            setRows((prev) => prev.map((r) => (r.id === id ? updated : r)));
            dispatchFeedbackInboxUpdated();
          })
          .catch((e) => setErr(parseClientApiError(e).message))
          .finally(() => setMarkingReadId(null));
      }
    },
    [rows],
  );

  const onMarkAllRead = async () => {
    setErr(null);
    try {
      await markAllFeedbackRead();
      const now = new Date().toISOString();
      setRows((prev) => prev.map((r) => ({ ...r, admin_read_at: r.admin_read_at ?? now })));
      dispatchFeedbackInboxUpdated();
    } catch (e) {
      setErr(parseClientApiError(e).message);
    }
  };

  const onAward = async (id: string) => {
    const amt = Math.min(200, Math.max(1, Math.round(xpById[id] ?? 25)));
    setBusyId(id);
    setErr(null);
    try {
      const updated = await awardFeedbackXp(id, amt);
      setRows((prev) => prev.map((r) => (r.id === id ? updated : r)));
      dispatchFeedbackInboxUpdated();
    } catch (e) {
      setErr(parseClientApiError(e).message);
    } finally {
      setBusyId(null);
    }
  };

  const onDelete = async (id: string) => {
    if (!window.confirm("Remove this message from the inbox? The submitter is not notified.")) return;
    setBusyId(id);
    setErr(null);
    try {
      await deleteFeedback(id);
      setRows((prev) => {
        const next = prev.filter((r) => r.id !== id);
        if (selectedId === id) {
          setSelectedId(next[0]?.id ?? null);
        }
        return next;
      });
      dispatchFeedbackInboxUpdated();
    } catch (e) {
      setErr(parseClientApiError(e).message);
    } finally {
      setBusyId(null);
    }
  };

  if (!session) {
    return (
      <div className="flex min-h-[30vh] items-center justify-center text-sm text-ds-muted">Sign in to continue.</div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="space-y-4">
        <PageHeader
          title="Messages"
          description="Company administrators review product feedback submitted from the megaphone button in the header."
          icon={Inbox}
        />
        <div className="ds-premium-panel p-5 text-sm text-ds-muted">
          Only organization administrators see the feedback inbox. Use{" "}
          <span className="font-semibold text-ds-foreground">Send product feedback</span> in the header to share ideas
          with your admin team.
        </div>
      </div>
    );
  }

  const unreadCount = rows.filter((r) => !r.admin_read_at).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageHeader
          title="Messages"
          description="Product feedback from your organization. Open a row to read the full note; unread items stay in the header badge until opened or cleared."
          icon={Inbox}
          className="min-w-0 flex-1"
        />
        {rows.length > 0 && unreadCount > 0 ? (
          <button
            type="button"
            onClick={() => void onMarkAllRead()}
            className="shrink-0 rounded-lg border border-ds-border px-3 py-2 text-xs font-semibold text-ds-foreground transition-colors hover:bg-ds-secondary"
          >
            Mark all read
          </button>
        ) : null}
      </div>

      {err ? (
        <div className="rounded-lg border border-ds-danger/40 bg-ds-danger/10 px-3 py-2 text-sm text-ds-danger" role="alert">
          {err}
        </div>
      ) : null}

      <div className="ds-premium-panel overflow-hidden">
        {loading ? (
          <p className="p-5 text-sm text-ds-muted">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="p-5 text-sm text-ds-muted">No feedback yet.</p>
        ) : (
          <div className="flex min-h-[min(70vh,520px)] flex-col md:grid md:grid-cols-[minmax(260px,34%)_1fr]">
            <aside className="max-h-[40vh] overflow-y-auto border-b border-ds-border md:max-h-none md:border-b-0 md:border-r">
              <ul className="divide-y divide-ds-border">
                {rows.map((r) => {
                  const isSel = r.id === selectedId;
                  const unread = !r.admin_read_at;
                  return (
                    <li key={r.id}>
                      <button
                        type="button"
                        onClick={() => onSelectRow(r.id)}
                        className={cn(
                          "flex w-full flex-col gap-1 px-3 py-3 text-left text-sm transition-colors md:px-4",
                          isSel ? "bg-ds-secondary" : "hover:bg-ds-secondary/60",
                          unread && "border-l-[3px] border-l-[var(--ds-accent)] pl-[calc(0.75rem-3px)] md:pl-[calc(1rem-3px)]",
                        )}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate text-xs font-bold uppercase tracking-wide text-ds-muted">
                            {r.feature_label}
                          </span>
                          {unread ? (
                            <span className="shrink-0 rounded-full bg-[var(--ds-accent)] px-2 py-0.5 text-[10px] font-bold uppercase text-white">
                              New
                            </span>
                          ) : null}
                        </div>
                        <p className="line-clamp-2 text-xs leading-snug text-ds-foreground">{listPreview(r.body)}</p>
                        <p className="text-[10px] text-ds-muted">{new Date(r.created_at).toLocaleString()}</p>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </aside>
            <section className="flex min-h-[280px] flex-1 flex-col bg-ds-primary/30">
              {selected ? (
                <div className="flex flex-1 flex-col">
                  <div className="flex flex-wrap items-start justify-between gap-3 border-b border-ds-border px-4 py-3">
                    <div className="min-w-0 space-y-1">
                      <p className="text-xs font-bold uppercase tracking-wide text-ds-muted">{selected.feature_label}</p>
                      <p className="text-[11px] text-ds-muted">
                        From {selected.author_name || selected.author_email || selected.author_user_id} ·{" "}
                        {new Date(selected.created_at).toLocaleString()}
                        {markingReadId === selected.id ? <span className="ml-2 text-ds-muted">Saving…</span> : null}
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={busyId === selected.id}
                      onClick={() => void onDelete(selected.id)}
                      className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-ds-border px-2.5 py-1.5 text-xs font-semibold text-ds-danger transition-colors hover:bg-ds-danger/10 disabled:opacity-50"
                      title="Remove from inbox"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden />
                      Delete
                    </button>
                  </div>
                  <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
                    <p className="whitespace-pre-wrap text-sm leading-relaxed text-ds-foreground">{selected.body}</p>
                    <div className="flex flex-wrap items-end gap-3 border-t border-ds-border pt-4">
                      {selected.xp_awarded_at ? (
                        <span className="rounded-md border border-emerald-500/35 bg-emerald-500/10 px-2 py-1 text-[11px] font-semibold text-emerald-800 dark:text-emerald-100">
                          +{selected.xp_amount} XP awarded
                        </span>
                      ) : (
                        <>
                          <label className="flex items-center gap-1 text-[11px] text-ds-muted">
                            <span>XP</span>
                            <input
                              type="number"
                              min={1}
                              max={200}
                              className="w-16 rounded border border-ds-border bg-ds-primary px-1 py-0.5 text-xs text-ds-foreground"
                              value={xpById[selected.id] ?? 25}
                              onChange={(e) =>
                                setXpById((m) => ({
                                  ...m,
                                  [selected.id]: Number.parseInt(e.target.value, 10) || 25,
                                }))
                              }
                            />
                          </label>
                          <button
                            type="button"
                            disabled={busyId === selected.id}
                            onClick={() => void onAward(selected.id)}
                            className={cn(
                              "inline-flex items-center gap-1.5 rounded-lg border border-ds-border px-2.5 py-1.5 text-xs font-semibold text-ds-foreground transition-colors",
                              "hover:bg-ds-secondary disabled:opacity-50",
                            )}
                          >
                            <Gift className="h-3.5 w-3.5" aria-hidden />
                            {busyId === selected.id ? "Awarding…" : "Award XP"}
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-1 items-center justify-center p-8 text-center text-sm text-ds-muted">
                  Select a message on the left to read the full feedback.
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
