"use client";

import { Flame } from "lucide-react";
import { useResolvedAvatarSrc } from "@/lib/useResolvedAvatarSrc";
import { XPBar } from "@/components/team/XPBar";
import type { TeamInsightsWorker } from "@/lib/teamInsightsService";

function rolePill(role: string): string {
  const r = (role || "worker").toLowerCase();
  if (r === "supervisor") return "bg-[#2B4C7E]/10 text-[#2B4C7E]";
  if (r === "lead") return "bg-[#36F1CD]/15 text-[#0E7C66]";
  return "bg-ds-secondary text-ds-muted";
}

function borderRing(border: string | null | undefined): string {
  const b = (border ?? "").toLowerCase();
  if (b === "elite") return "ring-2 ring-[#36F1CD] shadow-[0_0_0_1px_rgba(54,241,205,0.25)]";
  if (b === "gold") return "ring-2 ring-amber-400/90 shadow-[0_0_0_1px_rgba(251,191,36,0.2)]";
  if (b === "silver") return "ring-2 ring-slate-300 dark:ring-slate-400";
  if (b === "bronze") return "ring-2 ring-amber-800/50 dark:ring-amber-700/80";
  return "ring-1 ring-ds-border";
}

function titleForLevel(level: number): string {
  if (level >= 30) return "Veteran Operator";
  if (level >= 20) return "Team Anchor";
  if (level >= 12) return "Reliable Operator";
  if (level >= 6) return "Rising Star";
  return "Getting Started";
}

export function WorkerRow({
  worker,
  rank,
  onClick,
}: {
  worker: TeamInsightsWorker;
  rank: number;
  onClick: () => void;
}) {
  const src = useResolvedAvatarSrc(worker.avatarUrl ?? null);
  const required = worker.xpIntoLevel + worker.xpToNextLevel;
  return (
    <button
      type="button"
      onClick={onClick}
      className="group ds-card-primary flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
    >
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ds-secondary text-xs font-extrabold text-ds-muted tabular-nums">
          {rank}
        </div>
        <div className={`h-11 w-11 shrink-0 overflow-hidden rounded-xl bg-ds-secondary/30 ${borderRing(worker.avatarBorder)}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {src ? <img src={src} alt="" className="h-11 w-11 object-cover" /> : null}
        </div>
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2">
            <p className="truncate text-sm font-extrabold text-ds-foreground">{worker.fullName}</p>
            <span className={`inline-flex shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold uppercase ${rolePill(worker.role)}`}>
              {worker.role}
            </span>
          </div>
          <p className="mt-0.5 truncate text-xs text-ds-muted">
            Level {worker.level} – {titleForLevel(worker.level)}
          </p>
        </div>
      </div>

      <div className="hidden w-[260px] shrink-0 sm:block">
        <XPBar currentXP={worker.xpIntoLevel} requiredXP={required} size="sm" labelMode="fraction" />
      </div>

      <div className="hidden shrink-0 items-center gap-2 sm:flex">
        <div className="flex items-center gap-1 text-xs font-semibold text-ds-muted">
          <Flame className="h-4 w-4 text-amber-400" aria-hidden />
          <span className="tabular-nums">{worker.streak}</span>
          <span className="hidden md:inline">day streak</span>
        </div>
        <div className="ml-2 flex items-center gap-1">
          {(worker.badges ?? []).slice(0, 3).map((b) => (
            <span
              key={b.id}
              title={b.name}
              className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-ds-border bg-ds-secondary/30 text-[11px] font-extrabold text-[#2B4C7E]"
            >
              {b.name.slice(0, 1).toUpperCase()}
            </span>
          ))}
        </div>
      </div>
    </button>
  );
}

