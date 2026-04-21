"use client";

import { usePulseWs } from "@/hooks/usePulseWs";
import { completeTask, getUserAnalytics, listMyTasks, previewXp, type GamifiedTask } from "@/lib/gamificationService";
import { readSession } from "@/lib/pulse-session";
import { useCallback, useEffect, useMemo, useState } from "react";
import { WowXpBar } from "@/components/gamification/WowXpBar";

function formatDue(dueIso: string | null | undefined): string {
  if (!dueIso) return "—";
  const d = new Date(dueIso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function XpTasksWidget() {
  const [tasks, setTasks] = useState<GamifiedTask[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [flash, setFlash] = useState<{ xp: number; at: number } | null>(null);
  const [analytics, setAnalytics] = useState<{ totalXp: number; level: number } | null>(null);

  const me = useMemo(() => readSession()?.sub ?? null, []);

  const refresh = useCallback(async () => {
    if (!me) return;
    const [t, a] = await Promise.all([listMyTasks("todo"), getUserAnalytics(me)]);
    setTasks(t);
    setAnalytics({ totalXp: a.totalXp, level: a.level });
  }, [me]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  usePulseWs(
    (evt) => {
      if (!evt?.event_type) return;
      if (!evt.event_type.startsWith("gamification.")) return;
      void refresh();
    },
    Boolean(me),
  );

  const onComplete = useCallback(
    async (taskId: string) => {
      setBusy(taskId);
      try {
        const res = await completeTask(taskId);
        setFlash({ xp: res.xp, at: Date.now() });
        setTasks((prev) => prev.filter((t) => t.id !== taskId));
        setAnalytics({ totalXp: res.totalXp, level: res.level });
        window.setTimeout(() => setFlash((v) => (v && Date.now() - v.at > 1200 ? null : v)), 1400);
      } finally {
        setBusy((v) => (v === taskId ? null : v));
      }
    },
    [setTasks],
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div className="min-h-0 flex-1">
        {tasks.length === 0 ? (
          <p className="text-sm text-ds-muted">No tasks due right now.</p>
        ) : (
          <ul className="space-y-2">
            {tasks.slice(0, 6).map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-3 rounded-xl border border-ds-border bg-ds-primary p-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ds-foreground">{t.title}</p>
                  <p className="mt-1 text-xs text-ds-muted">
                    Due {formatDue(t.due_date)} · XP {previewXp(t)}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={busy === t.id}
                  onClick={() => void onComplete(t.id)}
                  className="ds-btn-solid-primary shrink-0 px-3 py-2 text-xs"
                >
                  {busy === t.id ? "Completing…" : "Complete"}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

