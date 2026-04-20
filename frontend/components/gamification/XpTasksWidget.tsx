"use client";

import { usePulseWs } from "@/hooks/usePulseWs";
import { completeTask, getUserAnalytics, listMyTasks, previewXp, type GamifiedTask } from "@/lib/gamificationService";
import { readSession } from "@/lib/pulse-session";
import { useCallback, useEffect, useMemo, useState } from "react";

function clamp01(v: number) {
  if (Number.isNaN(v) || !Number.isFinite(v)) return 0;
  return Math.min(1, Math.max(0, v));
}

function XpBar({ totalXp, level }: { totalXp: number; level: number }) {
  const into = totalXp % 100;
  const pct = clamp01(into / 100) * 100;
  return (
    <div className="rounded-xl border border-ds-border bg-ds-primary p-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-ds-muted">Level</p>
          <p className="mt-1 text-2xl font-extrabold tabular-nums text-ds-foreground">{level}</p>
        </div>
        <div className="text-right">
          <p className="text-xs font-semibold uppercase tracking-wider text-ds-muted">XP</p>
          <p className="mt-1 text-sm font-bold tabular-nums text-ds-foreground">
            {into}/100 <span className="text-ds-muted">({totalXp} total)</span>
          </p>
        </div>
      </div>
      <div className="mt-3 h-3 w-full overflow-hidden rounded-full border border-ds-border bg-ds-secondary">
        <div
          className="h-full rounded-full bg-[#4C6085] transition-[width] duration-700 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

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
      <div className="relative">
        <XpBar totalXp={analytics?.totalXp ?? 0} level={analytics?.level ?? 1} />
        {flash && flash.xp > 0 ? (
          <div className="pointer-events-none absolute -top-3 right-3 rounded-full bg-ds-success px-3 py-1 text-xs font-extrabold text-ds-on-accent shadow-[var(--ds-shadow-card)]">
            +{flash.xp} XP
          </div>
        ) : null}
      </div>

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

