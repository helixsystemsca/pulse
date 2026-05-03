"use client";

import { Award, LogOut, Users } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { KioskSection, ProjectKioskView, TeamHighlight } from "@/lib/project-kiosk/types";
import { getProjectKioskView } from "@/lib/project-kiosk/buildProjectKioskView";
import { useProjectKioskRealtime } from "@/lib/project-kiosk/useProjectKioskRealtime";

function SectionBody({ section }: { section: KioskSection }) {
  const b = section.body;
  if (b.kind === "metrics") {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {b.items.map((m) => (
          <div key={m.label} className="rounded-xl border border-white/10 bg-black/30 px-4 py-3">
            <p className="text-xs font-bold uppercase tracking-wider text-white/50">{m.label}</p>
            <p
              className={`mt-1 text-2xl font-bold ${
                m.emphasis === "warning" ? "text-amber-300"
                : m.emphasis === "positive" ? "text-emerald-300"
                : "text-white"
              }`}
            >
              {m.value}
            </p>
          </div>
        ))}
      </div>
    );
  }
  if (b.kind === "task_columns") {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {b.columns.map((c) => (
          <div key={c.label} className="rounded-xl border border-white/10 bg-black/25 p-4">
            <p className="text-sm font-bold uppercase tracking-wide text-emerald-300/90">{c.label}</p>
            <ul className="mt-3 space-y-2">
              {c.items.length === 0 ? <li className="text-white/40">—</li> : null}
              {c.items.map((t) => (
                <li key={t} className="truncate text-lg font-semibold text-white">
                  {t}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    );
  }
  if (b.kind === "blocked_cards") {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        {b.items.length === 0 ? (
          <p className="text-xl text-white/50">No blocked tasks.</p>
        ) : (
          b.items.map((it) => (
            <div key={it.title} className="rounded-xl border border-amber-400/40 bg-amber-950/30 px-4 py-4">
              <p className="text-xl font-bold text-amber-100">{it.title}</p>
              {it.subtitle ? <p className="mt-2 text-sm text-amber-200/80">{it.subtitle}</p> : null}
            </div>
          ))
        )}
      </div>
    );
  }
  if (b.kind === "summary_lines") {
    return (
      <ul className="space-y-3">
        {b.lines.map((line) => (
          <li key={line} className="text-xl font-medium leading-snug text-white md:text-2xl">
            {line}
          </li>
        ))}
      </ul>
    );
  }
  if (b.kind === "insights_cards") {
    return <HighlightStrip highlights={b.highlights} large />;
  }
  return null;
}

function HighlightStrip({ highlights, large }: { highlights: TeamHighlight[]; large?: boolean }) {
  return (
    <div className={`grid gap-3 ${large ? "sm:grid-cols-2 lg:grid-cols-3" : "sm:grid-cols-2"}`}>
      {highlights.map((h, i) => (
        <div
          key={`${h.user}-${i}`}
          className="flex gap-3 rounded-xl border border-emerald-500/35 bg-emerald-950/25 px-4 py-3 shadow-[0_0_24px_rgba(16,185,129,0.12)]"
        >
          <Award className="mt-0.5 h-6 w-6 shrink-0 text-emerald-300" aria-hidden />
          <div className="min-w-0">
            <p className={`font-bold text-emerald-200 ${large ? "text-sm uppercase tracking-wider" : "text-xs"}`}>{h.badge}</p>
            <p className={`mt-1 truncate font-semibold text-white ${large ? "text-lg" : "text-sm"}`}>{h.user}</p>
            <p className={`mt-1 text-white/80 ${large ? "text-base" : "text-xs"}`}>{h.description}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

export function ProjectKioskDisplay({ projectId }: { projectId: string }) {
  const [view, setView] = useState<ProjectKioskView | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [rotIndex, setRotIndex] = useState(0);

  const reload = useCallback(async () => {
    setErr(null);
    try {
      const v = await getProjectKioskView(projectId);
      setView(v);
    } catch (e: unknown) {
      const msg = e && typeof e === "object" && "message" in e ? String((e as Error).message) : "Could not load project.";
      setErr(msg);
    }
  }, [projectId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useProjectKioskRealtime({
    projectId,
    enabled: Boolean(projectId),
    onInvalidate: () => void reload(),
  });

  const rotCount = view?.rotatingSections?.length ?? 0;
  useEffect(() => {
    setRotIndex(0);
  }, [projectId, rotCount]);

  useEffect(() => {
    if (rotCount <= 1) return;
    const t = window.setInterval(() => {
      setRotIndex((i) => (i + 1) % rotCount);
    }, 15_000);
    return () => window.clearInterval(t);
  }, [rotCount]);

  useEffect(() => {
    const go = async () => {
      try {
        const el = document.documentElement;
        if (!document.fullscreenElement && el.requestFullscreen) {
          await el.requestFullscreen();
        }
      } catch {
        /* user gesture / policy */
      }
    };
    void go();
  }, []);

  const rotating = view?.rotatingSections ?? [];
  const currentRot = useMemo(() => {
    if (!rotating.length) return null;
    return rotating[rotIndex % rotating.length] ?? null;
  }, [rotating, rotIndex]);

  const exit = useCallback(async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
    } catch {
      /* ignore */
    }
    window.close();
  }, []);

  if (err) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-black px-6 text-center text-white">
        <p className="text-2xl font-bold">Kiosk unavailable</p>
        <p className="mt-4 max-w-lg text-lg text-white/70">{err}</p>
        <button type="button" className="mt-8 rounded-lg bg-white/10 px-6 py-3 text-lg font-semibold hover:bg-white/20" onClick={() => void exit()}>
          Exit
        </button>
      </div>
    );
  }

  if (!view) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black text-2xl font-semibold text-white">
        Loading operational view…
      </div>
    );
  }

  const h = view.header;

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-zinc-950 via-black to-black text-white">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 bg-black/60 px-6 py-4 backdrop-blur-md">
        <div className="min-w-0">
          <h1 className="truncate text-3xl font-black tracking-tight md:text-4xl">{h.name}</h1>
          <p className="mt-1 text-sm text-white/50">Last updated · {new Date(h.lastUpdated).toLocaleString()}</p>
        </div>
        <div className="flex flex-wrap items-center gap-4 md:gap-6">
          <div className="text-right">
            <p className="text-xs font-bold uppercase text-white/45">Progress</p>
            <p className="text-3xl font-black text-emerald-300">{h.percentComplete}%</p>
          </div>
          <div className="text-right">
            <p className="text-xs font-bold uppercase text-white/45">Remaining</p>
            <p className="text-3xl font-black text-white">{h.tasksRemaining}</p>
          </div>
          <div className="text-right">
            <p className="text-xs font-bold uppercase text-white/45">Blocked</p>
            <p className={`text-3xl font-black ${h.blockedCount > 0 ? "text-amber-300" : "text-white/60"}`}>{h.blockedCount}</p>
          </div>
          <div className="flex items-center gap-2 text-right">
            <Users className="h-8 w-8 text-sky-300" aria-hidden />
            <div>
              <p className="text-xs font-bold uppercase text-white/45">Active</p>
              <p className="text-3xl font-black text-sky-200">{h.activeWorkers}</p>
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void exit()}
          className="inline-flex items-center gap-2 rounded-lg border border-white/20 bg-white/10 px-4 py-2 text-sm font-bold uppercase tracking-wide text-white hover:bg-white/20"
        >
          <LogOut className="h-4 w-4" aria-hidden />
          Exit
        </button>
      </header>

      <div className="flex flex-1 flex-col gap-6 p-6 lg:flex-row lg:gap-8">
        <section className="lg:w-[38%] lg:min-w-[320px]">
          <h2 className="mb-4 text-sm font-black uppercase tracking-[0.25em] text-emerald-400/90">Locked — high value</h2>
          <div className="space-y-6">
            {view.lockedSections.length === 0 ? (
              <p className="text-lg text-white/50">No locked panels — mark widgets as “high value” on the dashboard.</p>
            ) : (
              view.lockedSections.map((sec) => (
                <div key={sec.id} className="rounded-2xl border border-white/10 bg-white/5 p-5">
                  <h3 className="text-lg font-bold text-white">{sec.title}</h3>
                  <div className="mt-4">
                    <SectionBody section={sec} />
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="min-h-0 flex-1">
          <h2 className="mb-4 text-sm font-black uppercase tracking-[0.25em] text-sky-400/90">Rotating view</h2>
          {currentRot ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6 md:p-8">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h3 className="text-2xl font-black text-white md:text-3xl">{currentRot.title}</h3>
                <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-white/70">
                  {rotIndex + 1} / {rotating.length} · 15s
                </span>
              </div>
              <SectionBody section={currentRot} />
            </div>
          ) : (
            <p className="text-xl text-white/50">No rotating panels configured.</p>
          )}

          <div className="mt-8">
            <h3 className="mb-3 text-sm font-black uppercase tracking-[0.25em] text-emerald-400/80">Team pulse</h3>
            <HighlightStrip highlights={view.teamInsights.highlights} large />
          </div>
        </section>
      </div>
    </div>
  );
}
