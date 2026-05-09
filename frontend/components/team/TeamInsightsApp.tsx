"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, Download, Flame, Sparkles, Trophy } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { PageBody } from "@/components/ui/PageBody";
import { Card } from "@/components/pulse/Card";
import { fetchTeamInsights, type TeamInsightsActivity, type TeamInsightsWorker } from "@/lib/teamInsightsService";
import { WorkerRow } from "@/components/team/WorkerRow";
import { WorkerProfileModal } from "@/components/team/WorkerProfileModal";
import { cn } from "@/lib/cn";
import { buttonVariants } from "@/styles/button-variants";

type SortKey = "xp" | "level" | "streak";
type RoleFilter = "all" | "worker" | "lead" | "supervisor";

function ActivityRow({ row }: { row: TeamInsightsActivity }) {
  return (
    <button
      type="button"
      className="flex w-full items-start justify-between gap-3 rounded-xl border border-ds-border bg-white px-4 py-3 text-left shadow-[var(--ds-shadow-card)] transition-[transform,box-shadow,background-color] hover:-translate-y-[1px] hover:bg-[#F7F9FB] hover:shadow-[var(--ds-shadow-card-hover)] dark:bg-ds-surface-primary"
    >
      <div className="min-w-0">
        <p className="truncate text-sm font-extrabold text-ds-foreground">{row.userName}</p>
        <p className="mt-0.5 text-xs text-ds-muted">{row.message}</p>
      </div>
      <span className="shrink-0 text-[11px] font-semibold text-ds-muted">{new Date(row.createdAt).toLocaleString()}</span>
    </button>
  );
}

export function TeamInsightsApp() {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [workers, setWorkers] = useState<TeamInsightsWorker[]>([]);
  const [activity, setActivity] = useState<TeamInsightsActivity[]>([]);
  const [summary, setSummary] = useState<{
    totalTeamXp: number;
    activeStreaks: number;
    topPerformerName?: string | null;
    topPerformerWeekXp: number;
    mostImprovedName?: string | null;
    mostImprovedDelta: number;
  } | null>(null);

  const [sort, setSort] = useState<SortKey>("xp");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [openProfileUserId, setOpenProfileUserId] = useState<string | null>(null);
  const [dateFilter, setDateFilter] = useState("this_week");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setErr(null);
      try {
        const res = await fetchTeamInsights();
        if (cancelled) return;
        setWorkers(res.workers ?? []);
        setActivity(res.recentActivity ?? []);
        setSummary(res.summary ?? null);
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : "Failed to load Team Insights");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    const base = workers.filter((w) => {
      if (roleFilter === "all") return true;
      const r = (w.role || "").toLowerCase();
      return r === roleFilter;
    });
    const sorted = [...base];
    sorted.sort((a, b) => {
      if (sort === "level") return (b.level ?? 1) - (a.level ?? 1);
      if (sort === "streak") return (b.streak ?? 0) - (a.streak ?? 0);
      return (b.totalXp ?? 0) - (a.totalXp ?? 0);
    });
    return sorted;
  }, [workers, sort, roleFilter]);

  const badgeCount = useMemo(() => {
    const uniq = new Set<string>();
    for (const w of workers) {
      for (const b of w.badges ?? []) uniq.add(b.id);
    }
    return uniq.size;
  }, [workers]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Team Insights"
        description="Celebrate progress. Build a stronger team."
        icon={Sparkles}
        actions={
          <>
            <div className="relative">
              <select
                className={cn(buttonVariants({ surface: "light", intent: "secondary" }), "appearance-none px-4 py-2.5 pr-10 text-sm font-semibold")}
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                aria-label="Date filter"
              >
                <option value="this_week">This Week</option>
              </select>
              <ChevronDown
                className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ds-muted"
                aria-hidden
              />
            </div>
            <button
              type="button"
              className={cn(buttonVariants({ surface: "light", intent: "secondary" }), "inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold")}
            >
              <Download className="h-4 w-4" aria-hidden />
              Export
            </button>
          </>
        }
      />

      <PageBody>
        {err ? (
          <div className="rounded-xl border border-ds-border bg-ds-primary px-4 py-3 text-sm font-medium text-ds-danger shadow-sm">
            {err}
          </div>
        ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Card
          padding="md"
          className="group transition-[transform,box-shadow] hover:-translate-y-[1px] hover:shadow-[var(--ds-shadow-card-hover)]"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-ds-muted">Team XP Earned</p>
              <p className="mt-2 font-headline text-2xl font-extrabold text-ds-foreground tabular-nums">
                {summary?.totalTeamXp ?? 0}
                <span className="ml-1 text-sm font-bold text-ds-muted">XP</span>
              </p>
              <p className="mt-1 text-xs font-semibold text-ds-muted">+18% vs last week</p>
            </div>
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-ds-secondary/60 text-[#2B4C7E]">
              <Sparkles className="h-5 w-5" aria-hidden />
            </span>
          </div>
        </Card>

        <Card
          padding="md"
          className="group transition-[transform,box-shadow] hover:-translate-y-[1px] hover:shadow-[var(--ds-shadow-card-hover)]"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-ds-muted">Active Streaks</p>
              <p className="mt-2 flex items-center gap-2 font-headline text-2xl font-extrabold text-ds-foreground tabular-nums">
                <Flame className="h-5 w-5 text-amber-400" aria-hidden />
                {summary?.activeStreaks ?? 0}
              </p>
              <p className="mt-1 text-xs font-semibold text-ds-muted">+12% vs last week</p>
            </div>
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-400/15 text-amber-500">
              <Flame className="h-5 w-5" aria-hidden />
            </span>
          </div>
        </Card>

        <Card
          padding="md"
          className="group transition-[transform,box-shadow] hover:-translate-y-[1px] hover:shadow-[var(--ds-shadow-card-hover)]"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-ds-muted">Top Performer</p>
              <p className="mt-2 truncate text-sm font-extrabold text-ds-foreground">{summary?.topPerformerName ?? "—"}</p>
              <p className="mt-1 text-xs font-semibold text-ds-muted tabular-nums">{summary?.topPerformerWeekXp ?? 0} XP</p>
            </div>
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#2B4C7E]/10 text-[#2B4C7E]">
              <Trophy className="h-5 w-5" aria-hidden />
            </span>
          </div>
        </Card>

        <Card
          padding="md"
          className="group transition-[transform,box-shadow] hover:-translate-y-[1px] hover:shadow-[var(--ds-shadow-card-hover)]"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-ds-muted">Most Improved</p>
              <p className="mt-2 truncate text-sm font-extrabold text-ds-foreground">{summary?.mostImprovedName ?? "—"}</p>
              <p className="mt-1 text-xs font-semibold text-ds-muted tabular-nums">+{summary?.mostImprovedDelta ?? 0} XP</p>
            </div>
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#36F1CD]/15 text-[#0E7C66]">
              <Sparkles className="h-5 w-5" aria-hidden />
            </span>
          </div>
        </Card>

        <Card
          padding="md"
          className="group transition-[transform,box-shadow] hover:-translate-y-[1px] hover:shadow-[var(--ds-shadow-card-hover)]"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-ds-muted">Badges Unlocked</p>
              <p className="mt-2 font-headline text-2xl font-extrabold text-ds-foreground tabular-nums">{badgeCount}</p>
              <p className="mt-1 text-xs font-semibold text-ds-muted">+14% vs last week</p>
            </div>
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-ds-secondary/60 text-[#2B4C7E]">
              <Sparkles className="h-5 w-5" aria-hidden />
            </span>
          </div>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card padding="lg" className="lg:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-headline text-base font-extrabold text-ds-foreground">Team Performance</p>
              <p className="mt-1 text-xs text-ds-muted">{filtered.length} members</p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1 rounded-xl border border-ds-border bg-ds-secondary/30 p-1">
                {(["all", "worker", "lead", "supervisor"] as const).map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setRoleFilter(k)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-bold ${
                      roleFilter === k ? "bg-white text-ds-foreground shadow-sm" : "text-ds-muted hover:text-ds-foreground"
                    }`}
                  >
                    {k === "all" ? "All" : k === "worker" ? "Workers" : k === "lead" ? "Leads" : "Supervisors"}
                  </button>
                ))}
              </div>

              <div className="relative">
                <select
                  className={cn(buttonVariants({ surface: "light", intent: "secondary" }), "appearance-none px-4 py-2 pr-10 text-xs font-semibold")}
                  value={sort}
                  onChange={(e) => setSort(e.target.value as SortKey)}
                  aria-label="Sort"
                >
                  <option value="xp">XP (High to Low)</option>
                  <option value="level">Level</option>
                  <option value="streak">Streak</option>
                </select>
                <ChevronDown
                  className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ds-muted"
                  aria-hidden
                />
              </div>
            </div>
          </div>

          <div className="mt-4 space-y-2">
            {loading ? <p className="text-sm text-ds-muted">Loading…</p> : null}
            {!loading && filtered.length === 0 ? <p className="text-sm text-ds-muted">No matching team members.</p> : null}
            {!loading
              ? filtered.map((w, idx) => (
                  <WorkerRow key={w.userId} worker={w} rank={idx + 1} onClick={() => setOpenProfileUserId(w.userId)} />
                ))
              : null}
          </div>
        </Card>

        <Card padding="lg">
          <p className="font-headline text-base font-extrabold text-ds-foreground">Recent Activity</p>
          <p className="mt-1 text-xs text-ds-muted">Wins, momentum, and milestones — always show why.</p>
          <div className="mt-4 space-y-2">
            {loading ? <p className="text-sm text-ds-muted">Loading…</p> : null}
            {!loading && activity.length === 0 ? <p className="text-sm text-ds-muted">No activity yet.</p> : null}
            {!loading ? activity.slice(0, 8).map((a) => <ActivityRow key={`${a.userId}-${a.createdAt}`} row={a} />) : null}
          </div>
        </Card>
      </div>

      <Card
        padding="lg"
        className="overflow-hidden border-0 bg-[linear-gradient(120deg,#36F1CD_0%,#4C6085_80%)] text-white shadow-[var(--ds-shadow-card-hover)]"
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15">
              <Trophy className="h-6 w-6" aria-hidden />
            </span>
            <div>
              <p className="text-base font-extrabold">Great work, team!</p>
              <p className="mt-1 text-sm text-white/90">Keep up the momentum. Every task, every day, makes a difference.</p>
            </div>
          </div>
          <button
            type="button"
            className="inline-flex items-center justify-center rounded-lg border border-sky-200/45 bg-sky-200/14 px-4 py-2.5 text-sm font-semibold text-white shadow-[inset_0_1px_0_rgba(186,230,253,0.35),0_6px_22px_rgba(15,23,42,0.38),0_0_0_1px_rgba(0,0,0,0.06)_inset] backdrop-blur-sm transition-[background-color,box-shadow,border-color,transform] hover:border-sky-200/70 hover:bg-sky-300/28 hover:shadow-[inset_0_1px_0_rgba(186,230,253,0.5),0_8px_28px_rgba(15,23,42,0.48),0_0_0_1px_rgba(0,0,0,0.08)_inset] active:scale-[0.98] active:bg-sky-400/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-200/80 focus-visible:ring-offset-2 focus-visible:ring-offset-[color-mix(in_srgb,var(--ds-palette-ice-deep)_45%,transparent)]"
          >
            View Leaderboard
          </button>
        </div>
      </Card>

        <WorkerProfileModal userId={openProfileUserId} open={Boolean(openProfileUserId)} onClose={() => setOpenProfileUserId(null)} />
      </PageBody>
    </div>
  );
}

