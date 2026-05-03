"use client";

import {
  Award,
  CheckCircle2,
  Cog,
  Droplets,
  LogOut,
  Shield,
  Sparkles,
  Star,
  Trophy,
  Wrench,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import Image from "next/image";
import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { KioskRotateFooter } from "@/components/dashboard/DashboardChrome";
import { HandoverNotesKioskPage } from "@/components/project-kiosk/HandoverNotesKioskPage";
import { UserProfileAvatarPreview } from "@/components/profile/UserProfileAvatarPreview";
import type {
  KioskSection,
  ProjectKioskView,
  TeamHighlight,
  TeamInsightMemberRow,
  TeamInsightsPanelData,
  TeamInsightTag,
} from "@/lib/project-kiosk/types";
import { getProjectKioskView } from "@/lib/project-kiosk/buildProjectKioskView";
import { useProjectKioskRealtime } from "@/lib/project-kiosk/useProjectKioskRealtime";
import { cn } from "@/lib/cn";
import { DASH } from "@/styles/dashboardTheme";

function pickSection(sections: KioskSection[], id: string): KioskSection | undefined {
  return sections.find((s) => s.id === id);
}

function formatTargetDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso.includes("T") ? iso : `${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function KioskHeaderClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(t);
  }, []);
  const timeStr = now.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const dateStr = now.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  return (
    <div className="shrink-0 text-right tabular-nums">
      <p className="font-headline text-2xl font-bold tracking-tight text-ds-foreground sm:text-3xl">{timeStr}</p>
      <p className="mt-0.5 text-xs font-semibold text-ds-muted sm:text-sm">{dateStr}</p>
    </div>
  );
}

function initialsFromName(name: string): string {
  const p = name.trim().split(/\s+/).filter(Boolean);
  if (p.length >= 2) return `${p[0]![0] ?? ""}${p[1]![0] ?? ""}`.toUpperCase();
  return name.trim().slice(0, 2).toUpperCase() || "?";
}

const AVATAR_BG = ["#0f766e", "#1e3a8a", "#6d28d9", "#c2410c", "#0369a1", "#be185d"] as const;

function avatarBgForId(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h + id.charCodeAt(i) * 13) % 997;
  return AVATAR_BG[h % AVATAR_BG.length]!;
}

function tagPillIcon(tag: TeamInsightTag) {
  const l = tag.label.toLowerCase();
  if (l.includes("safety") || tag.variant === "teal") return Shield;
  if (l.includes("lead") || l.includes("star")) return Star;
  if (l.includes("on-time") || l.includes("time") || l.includes("steady") || l.includes("momentum")) return Trophy;
  if (l.includes("multi") || l.includes("skill") || l.includes("gear")) return Cog;
  if (l.includes("pool") || l.includes("water")) return Droplets;
  if (l.includes("detail") || l.includes("wrench")) return Wrench;
  if (l.includes("active") || l.includes("complete") || tag.variant === "green") return CheckCircle2;
  return Sparkles;
}

const TAG_SURFACE: Record<TeamInsightTag["variant"], string> = {
  teal: "border border-teal-100 bg-teal-50 text-teal-900",
  green: "border border-emerald-100 bg-emerald-50 text-emerald-900",
  orange: "border border-orange-100 bg-orange-50 text-orange-950",
  blue: "border border-sky-100 bg-sky-50 text-sky-950",
  gray: "border border-slate-200 bg-slate-100 text-slate-800",
};

function TeamInsightTagPill({ tag }: { tag: TeamInsightTag }) {
  const Icon = tagPillIcon(tag);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold leading-none",
        TAG_SURFACE[tag.variant],
      )}
    >
      <Icon className="h-3.5 w-3.5 shrink-0 opacity-85" aria-hidden />
      {tag.label}
    </span>
  );
}

function TeamInsightsMemberRow({ member }: { member: TeamInsightMemberRow }) {
  const initials = initialsFromName(member.displayName);
  const bg = avatarBgForId(member.workerId);
  return (
    <div className="border-b border-ds-border py-4 last:border-b-0 last:pb-0">
      <div className="flex gap-3">
        {member.avatarUrl ? (
          <UserProfileAvatarPreview
            avatarUrl={member.avatarUrl}
            nameFallback={member.displayName}
            sizeClassName="h-12 w-12"
            fallback="initials"
            className="!border-0 !bg-transparent !p-0 !text-[13px] !ring-2 !ring-white"
          />
        ) : (
          <div
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white shadow-sm"
            style={{ backgroundColor: bg }}
          >
            {initials}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate font-headline text-base font-bold text-ds-foreground">{member.displayName}</p>
          <p className="mt-0.5 text-sm text-ds-muted">{member.roleLabel}</p>
          {member.tags.length > 0 ? (
            <div className="mt-2.5 flex flex-wrap gap-2">
              {member.tags.map((t) => (
                <TeamInsightTagPill key={`${member.workerId}-${t.label}`} tag={t} />
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function TeamInsightsPanel({ data }: { data: TeamInsightsPanelData }) {
  const { stats, members } = data;
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="grid shrink-0 grid-cols-2 overflow-hidden rounded-lg border border-ds-border bg-ds-primary">
        <div className="border-b border-r border-ds-border px-4 py-3 text-center sm:px-5 sm:py-4">
          <p className="font-headline text-2xl font-bold tabular-nums text-teal-800 dark:text-teal-200">{stats.total}</p>
          <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-ds-muted">Total tasks</p>
        </div>
        <div className="border-b border-ds-border px-4 py-3 text-center sm:px-5 sm:py-4">
          <p className="font-headline text-2xl font-bold tabular-nums text-emerald-700 dark:text-emerald-300">
            {stats.completed}
          </p>
          <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-ds-muted">Completed</p>
        </div>
        <div className="border-r border-ds-border px-4 py-3 text-center sm:px-5 sm:py-4">
          <p className="font-headline text-2xl font-bold tabular-nums text-teal-700 dark:text-teal-200">{stats.inProgress}</p>
          <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-ds-muted">In progress</p>
        </div>
        <div className="px-4 py-3 text-center sm:px-5 sm:py-4">
          <p className="font-headline text-2xl font-bold tabular-nums text-rose-600 dark:text-rose-300">{stats.blocked}</p>
          <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-ds-muted">Blocked</p>
        </div>
      </div>

      <div className="mt-4 min-h-0 flex-1 overflow-y-auto pr-1">
        {members.length === 0 ? (
          <p className="py-6 text-center text-sm text-ds-muted">No assignees on this project yet.</p>
        ) : (
          members.map((m) => <TeamInsightsMemberRow key={m.workerId} member={m} />)
        )}
      </div>
    </div>
  );
}

function HighlightStripLight({ highlights, large }: { highlights: TeamHighlight[]; large?: boolean }) {
  return (
    <div className={cn("grid gap-3", large ? "sm:grid-cols-2" : "sm:grid-cols-2")}>
      {highlights.map((h, i) => (
        <div
          key={`${h.user}-${i}`}
          className="flex gap-3 rounded-xl border border-ds-border bg-ds-primary p-3 shadow-[var(--ds-shadow-card)]"
        >
          <Award className="mt-0.5 h-5 w-5 shrink-0 text-ds-accent" aria-hidden />
          <div className="min-w-0">
            <p className={cn("font-bold uppercase tracking-wider text-ds-accent", large ? "text-[10px]" : "text-[10px]")}>
              {h.badge}
            </p>
            <p className={cn("mt-0.5 truncate font-semibold text-ds-foreground", large ? "text-sm" : "text-xs")}>{h.user}</p>
            <p className={cn("mt-1 text-ds-muted", large ? "text-xs leading-snug" : "text-[11px] leading-snug")}>
              {h.description}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

function splitAssignmentLine(line: string): { title: string; assignee?: string } {
  const idx = line.lastIndexOf(" · ");
  if (idx === -1) return { title: line };
  return { title: line.slice(0, idx).trim(), assignee: line.slice(idx + 3).trim() };
}

function KioskSectionBody({ section }: { section: KioskSection }) {
  const b = section.body;
  if (b.kind === "metrics") {
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        {b.items.map((m) => (
          <div key={m.label} className={cn(DASH.kpiTile)}>
            <p className={DASH.kpiLabel}>{m.label}</p>
            <p
              className={cn(
                DASH.kpiValue,
                m.emphasis === "warning" ? "text-ds-warning"
                : m.emphasis === "positive" ? "text-ds-success"
                : "text-ds-foreground",
              )}
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
      <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-4">
        {b.columns.map((c) => (
            <div key={c.label} className={cn(DASH.cardBase, "flex min-h-0 flex-col")}>
            <div
              className="h-[3px] w-full shrink-0 bg-[color-mix(in_srgb,var(--ds-accent)_55%,transparent)]"
              aria-hidden
            />
            <div className={cn(DASH.cardInner, "flex min-h-0 flex-1 flex-col")}>
              <p className="text-[11px] font-extrabold uppercase tracking-wide text-ds-accent">{c.label}</p>
              <ul className="mt-3 min-h-0 flex-1 space-y-2 overflow-y-auto">
                {c.items.length === 0 ? <li className="text-sm text-ds-muted">—</li> : null}
                {c.items.map((t) => (
                  <li
                    key={t}
                    className="rounded-lg border border-ds-border bg-ds-secondary/50 px-3 py-2 text-sm font-semibold text-ds-foreground"
                  >
                    {t}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ))}
      </div>
    );
  }
  if (b.kind === "blocked_cards") {
    return (
      <div className="grid gap-3 md:grid-cols-2">
        {b.items.length === 0 ? (
          <p className="text-sm text-ds-muted">No blocked tasks.</p>
        ) : (
          b.items.map((it) => (
            <div key={it.title} className="rounded-xl border border-ds-danger/35 bg-ds-primary px-4 py-3 shadow-[var(--ds-shadow-card)]">
              <p className="text-sm font-bold text-ds-foreground">{it.title}</p>
              {it.subtitle ? <p className="mt-1 text-xs text-ds-muted">{it.subtitle}</p> : null}
            </div>
          ))
        )}
      </div>
    );
  }
  if (b.kind === "summary_lines") {
    const showActive = section.id === "active_work";
    return (
      <ul className="min-h-0 flex-1 space-y-2 overflow-y-auto">
        {b.lines.map((line) => {
          const { title, assignee } = splitAssignmentLine(line);
          return (
            <li
              key={line}
              className="flex items-start justify-between gap-3 rounded-lg border border-ds-border bg-ds-primary px-3 py-2.5 shadow-[var(--ds-shadow-card)]"
            >
              <div className="min-w-0">
                <p className="text-sm font-semibold text-ds-foreground">{title}</p>
                {assignee ? <p className="mt-0.5 text-xs text-ds-muted">{assignee}</p> : null}
              </div>
              {showActive ? (
                <span className="shrink-0 rounded-md border border-ds-accent/40 bg-[color-mix(in_srgb,var(--ds-accent)_12%,transparent)] px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-ds-accent">
                  Active
                </span>
              ) : null}
            </li>
          );
        })}
      </ul>
    );
  }
  if (b.kind === "insights_cards") {
    return <HighlightStripLight highlights={b.highlights} large />;
  }
  if (b.kind === "team_insights_panel") {
    return <TeamInsightsPanel data={{ stats: b.stats, members: b.members }} />;
  }
  if (b.kind === "handover_notes") {
    return <HandoverNotesKioskPage cards={[...b.cards]} />;
  }
  return null;
}

function KioskPanelFrame({ title, children, className }: { title: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn(DASH.cardBase, "flex min-h-0 flex-col", className)}>
      <div className="h-[3px] w-full shrink-0 bg-ds-border" aria-hidden />
      <div className={cn(DASH.cardInner, "flex min-h-0 flex-1 flex-col")}>
        <p className={DASH.sectionLabel}>{title}</p>
        <div className="mt-3 min-h-0 flex-1">{children}</div>
      </div>
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

  const allSections = useMemo((): KioskSection[] => {
    if (!view) return [];
    return [...view.lockedSections, ...view.rotatingSections];
  }, [view]);

  const rotatingSections = view?.rotatingSections;
  const currentRot = useMemo(() => {
    if (!rotatingSections?.length) return null;
    return rotatingSections[rotIndex % rotatingSections.length] ?? null;
  }, [rotatingSections, rotIndex]);

  const handoverMain = currentRot?.body.kind === "handover_notes";

  const taskBoard = useMemo(() => pickSection(allSections, "task_board"), [allSections]);
  const teamInsights = useMemo(() => pickSection(allSections, "team_insights"), [allSections]);
  const activeWork = useMemo(() => pickSection(allSections, "active_work"), [allSections]);

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
      <div className="flex min-h-screen flex-col items-center justify-center bg-ds-bg px-6 text-center text-ds-foreground">
        <p className="text-2xl font-bold">Kiosk unavailable</p>
        <p className="mt-4 max-w-lg text-lg text-ds-muted">{err}</p>
        <button
          type="button"
          className="mt-8 rounded-lg border border-ds-border bg-ds-primary px-6 py-3 text-lg font-semibold shadow-[var(--ds-shadow-card)] hover:bg-ds-secondary"
          onClick={() => void exit()}
        >
          Exit
        </button>
      </div>
    );
  }

  if (!view) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ds-bg text-xl font-semibold text-ds-foreground">
        Loading operational view…
      </div>
    );
  }

  const h = view.header;
  const targetToneClass =
    h.targetEndTone === "danger" ? "text-ds-danger"
    : h.targetEndTone === "warning" ? "text-ds-warning"
    : "text-ds-muted";

  const body = (
    <div className={cn(DASH.page, "flex min-h-screen flex-col bg-ds-bg text-ds-foreground")}>
      <header className="shrink-0 border-b border-ds-border bg-ds-primary px-4 py-4 shadow-[var(--ds-shadow-card)] sm:px-6">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between lg:gap-8">
          <div className="flex min-w-0 flex-1 items-start gap-4">
            <div className="relative h-[4.5rem] w-[4.5rem] shrink-0 sm:h-20 sm:w-20">
              <Image
                src="/images/panoramalogo.png"
                alt=""
                fill
                priority
                sizes="80px"
                className="object-contain"
              />
            </div>
            <div className="min-w-0 pt-0.5">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-ds-muted sm:text-sm sm:tracking-[0.14em]">
                {h.facilityLabel}
              </p>
              <h1 className="mt-2 text-balance font-headline text-2xl font-semibold leading-[1.08] tracking-[-0.035em] text-ds-foreground sm:mt-2.5 sm:text-3xl md:text-[2.35rem]">
                {h.projectName}
              </h1>
            </div>
          </div>

          <div className="grid w-full min-w-0 shrink-0 grid-cols-1 gap-x-8 gap-y-5 lg:w-auto lg:max-w-5xl lg:grid-cols-4 lg:items-start lg:gap-x-10">
            <div className="flex min-w-0 flex-col gap-1">
              <p className={cn(DASH.sectionLabel, "min-h-[1.125rem] leading-none")}>Target completion</p>
              <p className="mt-1 text-lg font-bold tabular-nums text-ds-accent sm:text-xl">{formatTargetDate(h.targetEndDate)}</p>
              <p className={cn(DASH.sectionLabel, "mt-1 min-h-[1.125rem] leading-none")}>Days remaining</p>
              <p className={cn("text-sm font-semibold tabular-nums leading-snug", targetToneClass)}>{h.targetEndCaption}</p>
            </div>

            <div className="flex min-h-0 min-w-0 flex-col gap-1">
              <p className={cn(DASH.sectionLabel, "min-h-[1.125rem] leading-none")}>On site today</p>
              <div className="mt-2 flex min-h-[2.25rem] flex-wrap items-center gap-x-4 gap-y-2">
                {h.onSiteWorkers.length === 0 ? (
                  <span className="text-sm text-ds-muted">—</span>
                ) : (
                  h.onSiteWorkers.map((w) => (
                    <div key={w.id} className="flex items-center gap-2">
                      <UserProfileAvatarPreview
                        avatarUrl={w.avatarUrl}
                        nameFallback={w.displayName}
                        sizeClassName="h-9 w-9"
                        fallback="initials"
                        className="!ring-1 !ring-ds-border"
                      />
                      <span className="text-sm font-semibold text-ds-foreground">{w.firstName}</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="flex flex-col gap-1 lg:justify-self-end lg:text-right">
              <p className={cn(DASH.sectionLabel, "min-h-[1.125rem] leading-none lg:text-right")}>Progress</p>
              <p className="font-headline text-2xl font-bold tabular-nums text-ds-accent lg:text-right">{h.percentComplete}%</p>
            </div>

            <div className="flex flex-col items-end gap-2 lg:justify-self-end">
              <button
                type="button"
                onClick={() => void exit()}
                className="rounded-lg border border-ds-border bg-ds-secondary px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-ds-foreground hover:bg-ds-secondary/80"
              >
                <span className="inline-flex items-center gap-1.5">
                  <LogOut className="h-3.5 w-3.5" aria-hidden />
                  Exit
                </span>
              </button>
              <KioskHeaderClock />
            </div>
          </div>
        </div>

        <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-ds-secondary">
          <div
            className="h-full rounded-full bg-[var(--ds-chrome-gradient)] transition-[width] duration-500"
            style={{ width: `${Math.min(100, Math.max(0, h.percentComplete))}%` }}
          />
        </div>
      </header>

      {handoverMain && currentRot?.body.kind === "handover_notes" ? (
        <div className="flex min-h-0 flex-1 flex-col">
          <HandoverNotesKioskPage cards={[...currentRot.body.cards]} />
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-4 p-4 lg:flex-row lg:gap-5 lg:p-5">
          <aside className="flex w-full shrink-0 flex-col lg:w-[min(100%,22rem)]">
            {activeWork ? (
              <KioskPanelFrame title={activeWork.title} className="min-h-[12rem] flex-1 lg:min-h-0">
                <KioskSectionBody section={activeWork} />
              </KioskPanelFrame>
            ) : (
              <KioskPanelFrame title={"Today's assignments"} className="min-h-[8rem]">
                <p className="text-sm text-ds-muted">Enable the “Active work” widget on the Project tab to show assignments here.</p>
              </KioskPanelFrame>
            )}
          </aside>

          <main className="flex min-h-0 min-w-0 flex-1 flex-col">
            {taskBoard ? (
              <KioskPanelFrame title={taskBoard.title} className="flex min-h-0 flex-1 flex-col">
                <KioskSectionBody section={taskBoard} />
              </KioskPanelFrame>
            ) : (
              <KioskPanelFrame title="Task board" className="flex-1">
                <p className="text-sm text-ds-muted">Add the “Task board” widget in kiosk configuration.</p>
              </KioskPanelFrame>
            )}

            {rotCount > 1 &&
            currentRot &&
            currentRot.id !== taskBoard?.id &&
            currentRot.body.kind !== "handover_notes" ? (
              <div className="relative mt-4 min-h-0 flex-1">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={currentRot.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
                    className="min-h-0"
                  >
                    <KioskPanelFrame title={`${currentRot.title} · rotating`} className="min-h-[10rem]">
                      <KioskSectionBody section={currentRot} />
                    </KioskPanelFrame>
                  </motion.div>
                </AnimatePresence>
              </div>
            ) : null}
          </main>

          <aside className="flex w-full shrink-0 flex-col gap-4 lg:w-[min(100%,24rem)]">
            {teamInsights ? (
              <KioskPanelFrame title={teamInsights.title} className="min-h-0 flex-1">
                <KioskSectionBody section={teamInsights} />
              </KioskPanelFrame>
            ) : (
              <KioskPanelFrame title="Team insights" className="min-h-0 flex-1">
                <TeamInsightsPanel data={view.teamInsightsPanel} />
              </KioskPanelFrame>
            )}
          </aside>
        </div>
      )}

      {rotCount > 1 ? (
        <footer className="shrink-0 border-t border-ds-border bg-ds-secondary/30 px-4 py-3">
          <KioskRotateFooter
            activeIndex={rotIndex}
            total={rotCount}
            showCountdownRing
            rotationKey={rotIndex}
            intervalMs={15_000}
          />
        </footer>
      ) : null}
    </div>
  );

  return body;
}
