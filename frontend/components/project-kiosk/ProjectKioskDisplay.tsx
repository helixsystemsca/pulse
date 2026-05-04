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
import { Fragment, useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { KioskRotateFooter } from "@/components/dashboard/DashboardChrome";
import { HandoverNotesKioskPage } from "@/components/project-kiosk/HandoverNotesKioskPage";
import { SafetyRemindersKioskPage } from "@/components/project-kiosk/SafetyRemindersKioskPage";
import { UserProfileAvatarPreview } from "@/components/profile/UserProfileAvatarPreview";
import type {
  KioskOnShiftWorkerCard,
  KioskProjectOwnerHint,
  KioskSection,
  KioskShiftBand,
  KioskSupervisorsOnSite,
  ProjectKioskView,
  TeamHighlight,
  TeamInsightMemberRow,
  TeamInsightsPanelData,
  TeamInsightTag,
} from "@/lib/project-kiosk/types";
import { getProjectKioskView, sortRotatingSections } from "@/lib/project-kiosk/buildProjectKioskView";
import { useProjectKioskRealtime } from "@/lib/project-kiosk/useProjectKioskRealtime";
import { cn } from "@/lib/cn";
import { DASH } from "@/styles/dashboardTheme";

function formatTargetDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso.includes("T") ? iso : `${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function KioskHeaderClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const tick = () => setNow(new Date());
    tick();
    const t = window.setInterval(tick, 1000);
    return () => window.clearInterval(t);
  }, []);
  const h = now.getHours();
  const m = now.getMinutes();
  const timeStr = `${h}:${String(m).padStart(2, "0")}`;
  const dateStr = now.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  return (
    <div className="shrink-0 text-right tabular-nums">
      <p className="font-headline text-lg font-bold tracking-tight text-ds-foreground sm:text-xl">{timeStr}</p>
      <p className="mt-0.5 text-[10px] font-semibold leading-tight text-ds-muted sm:text-[11px]">{dateStr}</p>
    </div>
  );
}

const KIOSK_SHIFT_BANDS: KioskShiftBand[] = ["day", "afternoon", "night"];

const KIOSK_SHIFT_BAND_LABEL: Record<KioskShiftBand, string> = {
  day: "Day",
  afternoon: "Afternoon",
  night: "Night",
};

function KioskSupervisorsOnSiteGrid({ data }: { data: KioskSupervisorsOnSite }) {
  const rowsWithCoverage = data.rows.filter((row) =>
    KIOSK_SHIFT_BANDS.some((b) => row.namesByBand[b].length > 0),
  );
  const bandsInUse = KIOSK_SHIFT_BANDS.filter((b) =>
    rowsWithCoverage.some((row) => row.namesByBand[b].length > 0),
  );

  return (
    <div className="min-w-0 max-w-[min(100%,28rem)]">
      <p className={cn(DASH.sectionLabel, "mb-1 leading-none")}>Supervisors on site</p>
      {rowsWithCoverage.length === 0 ? (
        <p className="max-w-xs text-[10px] font-medium leading-snug text-ds-muted sm:text-[11px]">
          No managers, supervisors, or leads rostered on this project for today.
        </p>
      ) : (
        <div
          className="grid gap-x-2 gap-y-0.5 text-[10px] leading-snug sm:text-[11px]"
          style={{ gridTemplateColumns: `auto repeat(${bandsInUse.length}, minmax(0, 1fr))` }}
        >
          <div />
          {bandsInUse.map((b) => (
            <div key={b} className="font-bold uppercase tracking-wide text-ds-muted">
              {KIOSK_SHIFT_BAND_LABEL[b]}
            </div>
          ))}
          {rowsWithCoverage.map((row) => (
            <Fragment key={row.roleLabel}>
              <div className="whitespace-nowrap pr-1 font-semibold text-ds-foreground">{row.roleLabel}</div>
              {bandsInUse.map((b) => {
                const names = row.namesByBand[b];
                return (
                  <div key={`${row.roleLabel}-${b}`} className="min-w-0 break-words text-ds-foreground">
                    {names.length ? names.join(" · ") : ""}
                  </div>
                );
              })}
            </Fragment>
          ))}
        </div>
      )}
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

function TeamInsightsMemberRow({ member, dense }: { member: TeamInsightMemberRow; dense?: boolean }) {
  const initials = initialsFromName(member.displayName);
  const bg = avatarBgForId(member.workerId);
  const sz = dense ? "h-10 w-10" : "h-12 w-12";
  const textName = dense ? "text-sm" : "text-base";
  return (
    <div className={cn("border-b border-ds-border last:border-b-0 last:pb-0", dense ? "py-2.5" : "py-4")}>
      <div className="flex gap-3">
        {member.avatarUrl ? (
          <UserProfileAvatarPreview
            avatarUrl={member.avatarUrl}
            nameFallback={member.displayName}
            sizeClassName={sz}
            fallback="initials"
            className="!border-0 !bg-transparent !p-0 !text-[13px] !ring-2 !ring-white"
          />
        ) : (
          <div
            className={cn("flex shrink-0 items-center justify-center rounded-full font-bold text-white shadow-sm", sz, dense ? "text-xs" : "text-sm")}
            style={{ backgroundColor: bg }}
          >
            {initials}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className={cn("truncate font-headline font-bold text-ds-foreground", textName)}>{member.displayName}</p>
          <p className={cn("text-ds-muted", dense ? "mt-0.5 text-[11px]" : "mt-0.5 text-sm")}>{member.roleLabel}</p>
          {member.tags.length > 0 ? (
            <div className={cn("flex flex-wrap gap-1.5", dense ? "mt-1.5" : "mt-2.5 gap-2")}>
              {member.tags.slice(0, dense ? 3 : 8).map((t) => (
                <TeamInsightTagPill key={`${member.workerId}-${t.label}`} tag={t} />
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function TeamInsightsPanel({ data, dense }: { data: TeamInsightsPanelData; dense?: boolean }) {
  const { stats, members } = data;
  const shownMembers = dense ? members.slice(0, 8) : members;
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="grid shrink-0 grid-cols-2 overflow-hidden rounded-lg border border-ds-border bg-ds-primary">
        <div className={cn("border-b border-r border-ds-border text-center", dense ? "px-3 py-2" : "px-4 py-3 sm:px-5 sm:py-4")}>
          <p
            className={cn(
              "font-headline font-bold tabular-nums text-teal-800 dark:text-teal-200",
              dense ? "text-xl" : "text-2xl",
            )}
          >
            {stats.total}
          </p>
          <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-ds-muted">Total tasks</p>
        </div>
        <div className={cn("border-b border-ds-border text-center", dense ? "px-3 py-2" : "px-4 py-3 sm:px-5 sm:py-4")}>
          <p
            className={cn(
              "font-headline font-bold tabular-nums text-emerald-700 dark:text-emerald-300",
              dense ? "text-xl" : "text-2xl",
            )}
          >
            {stats.completed}
          </p>
          <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-ds-muted">Completed</p>
        </div>
        <div className={cn("border-r border-ds-border text-center", dense ? "px-3 py-2" : "px-4 py-3 sm:px-5 sm:py-4")}>
          <p
            className={cn(
              "font-headline font-bold tabular-nums text-teal-700 dark:text-teal-200",
              dense ? "text-xl" : "text-2xl",
            )}
          >
            {stats.inProgress}
          </p>
          <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-ds-muted">In progress</p>
        </div>
        <div className={cn("text-center", dense ? "px-3 py-2" : "px-4 py-3 sm:px-5 sm:py-4")}>
          <p
            className={cn(
              "font-headline font-bold tabular-nums text-rose-600 dark:text-rose-300",
              dense ? "text-xl" : "text-2xl",
            )}
          >
            {stats.blocked}
          </p>
          <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-ds-muted">Blocked</p>
        </div>
      </div>

      <div className={cn("mt-4 min-h-0 flex-1", dense ? "overflow-hidden" : "overflow-y-auto pr-1")}>
        {shownMembers.length === 0 ? (
          <p className="py-6 text-center text-sm text-ds-muted">No assignees on this project yet.</p>
        ) : (
          shownMembers.map((m) => <TeamInsightsMemberRow key={m.workerId} dense={dense} member={m} />)
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

const ON_SHIFT_RAIL_MAX = 10;

function OnShiftWorkersRail({
  workers,
  hint,
}: {
  workers: KioskOnShiftWorkerCard[];
  hint: KioskProjectOwnerHint;
}) {
  const shown = workers.slice(0, ON_SHIFT_RAIL_MAX);
  const extra = workers.length - shown.length;
  return (
    <KioskPanelFrame title="Who's on shift" className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden">
        {workers.length === 0 ? (
          <p className="text-sm leading-snug text-ds-muted">
            No one is rostered on this project for today yet. When schedule assignments or shifts are published, they
            appear here.
          </p>
        ) : (
          <>
            {shown.map((w) => {
              const first = w.firstName.trim() || w.displayName.trim().split(/\s+/)[0] || w.displayName;
              return (
                <div
                  key={w.workerId}
                  className="shrink-0 rounded-lg border border-ds-border bg-ds-primary px-2.5 py-2 shadow-[var(--ds-shadow-card)]"
                >
                  <div className="flex gap-2.5">
                    {w.avatarUrl ? (
                      <UserProfileAvatarPreview
                        avatarUrl={w.avatarUrl}
                        nameFallback={w.displayName}
                        sizeClassName="h-9 w-9 shrink-0"
                        fallback="initials"
                        className="!ring-1 !ring-ds-border"
                      />
                    ) : (
                      <div
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white shadow-sm"
                        style={{ backgroundColor: avatarBgForId(w.workerId) }}
                      >
                        {initialsFromName(w.displayName)}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-headline text-sm font-bold text-ds-foreground">{first}</p>
                      {w.shiftSummary ? (
                        <p className="truncate text-[11px] text-ds-muted">{w.shiftSummary}</p>
                      ) : null}
                      {w.assignedTaskTitles.length > 0 ? (
                        <ul className="mt-1 space-y-0.5 text-[11px] font-medium leading-snug text-ds-foreground">
                          {w.assignedTaskTitles.slice(0, 4).map((t) => (
                            <li key={t} className="truncate border-l-2 border-ds-accent/50 pl-2">
                              {t}
                            </li>
                          ))}
                          {w.assignedTaskTitles.length > 4 ? (
                            <li className="truncate pl-2 text-ds-muted">+{w.assignedTaskTitles.length - 4} more</li>
                          ) : null}
                        </ul>
                      ) : (
                        <p className="mt-1 text-[11px] leading-snug text-ds-muted">
                          No tasks assigned today — see {hint.displayName} ({hint.roleLabel}).
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            {extra > 0 ? (
              <p className="shrink-0 text-center text-[11px] font-semibold text-ds-muted">+{extra} more on shift</p>
            ) : null}
          </>
        )}
      </div>
    </KioskPanelFrame>
  );
}

function KioskSectionBody({ section, dense }: { section: KioskSection; dense?: boolean }) {
  const b = section.body;
  if (b.kind === "metrics") {
    return (
      <div className="grid min-h-0 gap-3 overflow-hidden sm:grid-cols-2">
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
      <div className="grid min-h-0 flex-1 gap-2 overflow-hidden lg:grid-cols-4 lg:gap-3">
        {b.columns.map((c) => (
          <div key={c.label} className={cn(DASH.cardBase, "flex min-h-0 min-w-0 flex-col")}>
            <div
              className="h-[3px] w-full shrink-0 bg-[color-mix(in_srgb,var(--ds-accent)_55%,transparent)]"
              aria-hidden
            />
            <div className={cn(DASH.cardInner, "flex min-h-0 flex-1 flex-col py-3", dense && "py-2.5")}>
              <p className="shrink-0 text-[11px] font-extrabold uppercase tracking-wide text-ds-accent">{c.label}</p>
              <ul className="mt-2 min-h-0 flex-1 space-y-1.5 overflow-hidden">
                {c.items.length === 0 ? <li className="text-sm text-ds-muted">—</li> : null}
                {c.items.map((t) => (
                  <li
                    key={t}
                    className="truncate rounded-lg border border-ds-border bg-ds-secondary/50 px-2.5 py-1.5 text-xs font-semibold text-ds-foreground sm:px-3 sm:text-sm"
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
      <div className="grid min-h-0 gap-3 overflow-hidden md:grid-cols-2">
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
      <ul className="min-h-0 flex-1 space-y-2 overflow-hidden">
        {b.lines.map((line) => {
          const { title, assignee } = splitAssignmentLine(line);
          return (
            <li
              key={line}
              className="flex min-h-0 items-start justify-between gap-3 rounded-lg border border-ds-border bg-ds-primary px-3 py-2 shadow-[var(--ds-shadow-card)]"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-ds-foreground">{title}</p>
                {assignee ? <p className="mt-0.5 truncate text-xs text-ds-muted">{assignee}</p> : null}
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
    return (
      <div className="min-h-0 flex-1 overflow-hidden">
        <HighlightStripLight highlights={b.highlights} large />
      </div>
    );
  }
  if (b.kind === "team_insights_panel") {
    const strip = (b.highlights ?? []).slice(0, 4);
    return (
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
        {strip.length > 0 ? (
          <div className="min-h-0 max-h-[42%] shrink-0 overflow-hidden">
            <HighlightStripLight highlights={strip} large />
          </div>
        ) : null}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <TeamInsightsPanel data={{ stats: b.stats, members: b.members }} dense={Boolean(dense)} />
        </div>
      </div>
    );
  }
  if (b.kind === "handover_notes") {
    return <HandoverNotesKioskPage cards={[...b.cards]} />;
  }
  if (b.kind === "safety_reminders") {
    return <SafetyRemindersKioskPage subtitle={b.subtitle} cards={b.cards} />;
  }
  return null;
}

function KioskPanelFrame({ title, children, className }: { title: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn(DASH.cardBase, "flex min-h-0 flex-col", className)}>
      <div className="h-[3px] w-full shrink-0 bg-ds-border" aria-hidden />
      <div className={cn(DASH.cardInner, "flex min-h-0 flex-1 flex-col")}>
        <p className={DASH.sectionLabel}>{title}</p>
        <div className="mt-3 flex min-h-0 flex-1 flex-col overflow-hidden">{children}</div>
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

  useEffect(() => {
    const prev = document.title;
    const name = view?.header.projectName?.trim();
    document.title = name ? `${name} | Panorama` : "Project kiosk | Panorama";
    return () => {
      document.title = prev;
    };
  }, [view?.header.projectName]);

  useProjectKioskRealtime({
    projectId,
    enabled: Boolean(projectId),
    onInvalidate: () => void reload(),
  });

  const kioskPanels = useMemo(() => {
    if (!view) return [];
    return sortRotatingSections([...view.lockedSections, ...view.rotatingSections]);
  }, [view]);

  const rotCount = kioskPanels.length;

  const currentRot = useMemo(() => {
    if (!kioskPanels.length) return null;
    return kioskPanels[rotIndex % kioskPanels.length] ?? null;
  }, [kioskPanels, rotIndex]);

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
  const targetDateClass =
    h.targetEndTone === "danger" ? "text-ds-danger"
    : h.targetEndTone === "warning" ? "text-ds-warning"
    : "text-ds-accent";

  const body = (
    <div
      className={cn(
        DASH.page,
        "flex h-[100dvh] max-h-[100dvh] flex-col overflow-hidden bg-ds-bg text-ds-foreground",
      )}
    >
      <header className="shrink-0 border-b border-ds-border bg-ds-primary px-2.5 py-1.5 shadow-[var(--ds-shadow-card)] sm:px-3 sm:py-1.5">
        <div className="flex flex-wrap items-start gap-x-3 gap-y-1.5 xl:flex-nowrap xl:justify-between">
          <div className="flex min-w-0 shrink-0 items-start gap-2.5">
            <div className="relative mt-0.5 h-10 w-10 shrink-0 sm:h-11 sm:w-11">
              <Image
                src="/images/panoramalogo2.png"
                alt=""
                fill
                priority
                sizes="48px"
                className="object-contain"
              />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-ds-muted sm:text-[11px]">
                {h.facilityLabel}
              </p>
              <h1 className="mt-0.5 text-balance font-headline text-base font-semibold leading-tight tracking-tight text-ds-foreground sm:text-lg md:text-xl">
                {h.projectName}
              </h1>
            </div>
          </div>

          <div className="flex min-w-0 flex-1 flex-wrap items-start justify-start gap-x-0 gap-y-1.5 divide-x divide-ds-border/60 xl:justify-end [&>div]:px-2.5 [&>div:first-child]:border-l-0 [&>div:first-child]:pl-0 max-xl:[&>div:first-child]:pl-0 sm:[&>div]:px-3">
            <div className="flex flex-col gap-0 border-l-0 pl-0">
              <p className={cn(DASH.sectionLabel, "leading-none")}>Today</p>
              <p className="mt-0.5 text-sm font-bold tabular-nums text-ds-accent sm:text-base">{h.todayLabel}</p>
            </div>

            <div className="flex flex-col gap-0">
              <p className={cn(DASH.sectionLabel, "leading-none")}>Project start</p>
              <p className="mt-0.5 text-sm font-bold tabular-nums text-ds-foreground sm:text-base">
                {formatTargetDate(h.projectStartDate)}
              </p>
              {h.projectDurationCaption ? (
                <p className="mt-0.5 text-[10px] font-medium text-ds-muted">{h.projectDurationCaption}</p>
              ) : null}
            </div>

            <div className="flex flex-col items-stretch gap-0 text-left xl:min-w-[7.5rem] xl:items-end xl:text-right">
              <p className={cn(DASH.sectionLabel, "leading-none xl:text-right")}>Target completion</p>
              <p className={cn("mt-0.5 text-sm font-bold tabular-nums sm:text-base", targetDateClass)}>
                {formatTargetDate(h.targetEndDate)}
              </p>
              <p className={cn("mt-0.5 text-xs font-semibold tabular-nums leading-tight xl:text-right", targetToneClass)}>
                {h.targetEndCaption}
              </p>
            </div>

            <div className="min-w-0 flex-1 xl:max-w-md xl:flex-initial">
              <KioskSupervisorsOnSiteGrid data={h.supervisorsOnSite} />
            </div>

            <div className="flex flex-col gap-0.5">
              <p className={cn(DASH.sectionLabel, "leading-none")}>Completion</p>
              <p className="font-headline text-lg font-bold tabular-nums text-ds-accent sm:text-xl">{h.percentComplete}%</p>
              <div className="mt-1 h-1.5 w-full max-w-[7.5rem] overflow-hidden rounded-full bg-ds-secondary sm:max-w-[9rem]">
                <div
                  className="h-full rounded-full bg-[var(--ds-chrome-gradient)] transition-[width] duration-500"
                  style={{ width: `${Math.min(100, Math.max(0, h.percentComplete))}%` }}
                />
              </div>
            </div>

            <div className="ml-auto flex shrink-0 flex-col items-end gap-1 border-l-0 pl-0 sm:ml-0 xl:border-l xl:border-ds-border/60 xl:pl-2.5">
              <button
                type="button"
                onClick={() => void exit()}
                className="rounded-md border border-ds-border bg-ds-secondary px-2 py-1 text-[9px] font-bold uppercase tracking-wide text-ds-foreground hover:bg-ds-secondary/80"
              >
                <span className="inline-flex items-center gap-1">
                  <LogOut className="h-3 w-3" aria-hidden />
                  Exit
                </span>
              </button>
              <KioskHeaderClock />
            </div>
          </div>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden p-3 sm:p-4 lg:flex-row lg:gap-4 lg:p-5">
        <aside className="flex w-full shrink-0 flex-col overflow-hidden lg:w-[min(100%,20rem)] lg:max-w-[22rem]">
          <OnShiftWorkersRail hint={view.projectOwnerHint} workers={view.onShiftWorkers} />
        </aside>

        <main className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          {currentRot ? (
            <AnimatePresence mode="wait">
              <motion.div
                key={currentRot.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
                className="flex min-h-0 flex-1 flex-col overflow-hidden"
              >
                {currentRot.body.kind === "handover_notes" ? (
                  <HandoverNotesKioskPage cards={[...currentRot.body.cards]} />
                ) : currentRot.body.kind === "safety_reminders" ? (
                  <SafetyRemindersKioskPage subtitle={currentRot.body.subtitle} cards={currentRot.body.cards} />
                ) : (
                  <KioskPanelFrame title={currentRot.title} className="flex min-h-0 flex-1 flex-col overflow-hidden">
                    <KioskSectionBody dense section={currentRot} />
                  </KioskPanelFrame>
                )}
              </motion.div>
            </AnimatePresence>
          ) : (
            <KioskPanelFrame title="Project kiosk" className="flex min-h-0 flex-1 flex-col overflow-hidden">
              <p className="text-sm text-ds-muted">Loading panels…</p>
            </KioskPanelFrame>
          )}
        </main>
      </div>

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
