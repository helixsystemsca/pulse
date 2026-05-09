"use client";

import { useEffect, useMemo, useState } from "react";
import { BadgeCheck, Flame, Mail, Shield, User } from "lucide-react";
import { WowXpBar } from "@/components/gamification/WowXpBar";
import { Card } from "@/components/pulse/Card";
import { fetchWorkerProfile, type WorkerProfilePayload } from "@/lib/workerProfileService";
import { useResolvedAvatarSrc } from "@/lib/useResolvedAvatarSrc";
import { humanizeRole } from "@/lib/pulse-roles";

export type WorkerProfileMode = "insights" | "admin";

function roleTitle(role: string) {
  const r = (role || "worker").trim();
  if (!r) return humanizeRole("worker");
  return humanizeRole(r);
}

function borderRing(border: string | null | undefined): string {
  const b = (border ?? "").toLowerCase();
  if (b === "elite") return "ring-2 ring-[#36F1CD] shadow-[0_0_0_1px_rgba(54,241,205,0.25)]";
  if (b === "gold") return "ring-2 ring-amber-400/90 shadow-[0_0_0_1px_rgba(251,191,36,0.2)]";
  if (b === "silver") return "ring-2 ring-slate-300 dark:ring-slate-400";
  if (b === "bronze") return "ring-2 ring-amber-800/50 dark:ring-amber-700/80";
  return "ring-1 ring-ds-border";
}

export function WorkerProfile({
  userId,
  mode,
  adminControls,
}: {
  userId: string;
  mode: WorkerProfileMode;
  adminControls?: React.ReactNode;
}) {
  const [data, setData] = useState<WorkerProfilePayload | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setErr(null);
      try {
        const res = await fetchWorkerProfile(userId);
        if (!cancelled) setData(res);
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : "Failed to load profile");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const avatarSrc = useResolvedAvatarSrc(data?.avatarUrl ?? null);
  const badges = useMemo(() => (data?.badges ?? []).slice(0, mode === "admin" ? 0 : 24), [data?.badges, mode]);

  if (loading) {
    return <p className="text-sm text-ds-muted">Loading…</p>;
  }
  if (err) {
    return <p className="text-sm font-medium text-ds-danger">{err}</p>;
  }
  if (!data) {
    return <p className="text-sm text-ds-muted">Profile unavailable.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className={`h-16 w-16 overflow-hidden rounded-2xl bg-ds-secondary/30 ${borderRing(data.avatarBorder)}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {avatarSrc ? <img src={avatarSrc} alt="" className="h-16 w-16 object-cover" /> : null}
          </div>
          <div className="min-w-0">
            <p className="truncate font-headline text-xl font-extrabold text-ds-foreground">{data.fullName}</p>
            <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-ds-muted">
              <span className="inline-flex items-center gap-1.5">
                <User className="h-4 w-4" aria-hidden />
                {roleTitle(data.role)}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Mail className="h-4 w-4" aria-hidden />
                {data.email}
              </span>
              {mode === "insights" ? (
                <span className="inline-flex items-center gap-1.5 font-semibold text-ds-foreground/80">
                  Lv {data.level}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-ds-muted">
                  <Shield className="h-4 w-4" aria-hidden />
                  Admin view
                </span>
              )}
            </div>
          </div>
        </div>

        {mode === "admin" && adminControls ? (
          <div className="w-full lg:w-auto">{adminControls}</div>
        ) : null}
      </div>

      {mode === "insights" ? (
        <Card padding="md">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-ds-foreground">XP Progress</p>
            <div className="inline-flex items-center gap-2 text-xs font-semibold text-ds-muted">
              <Flame className="h-4 w-4 text-amber-400" aria-hidden />
              <span className="tabular-nums">{data.streak}</span> streak (best {data.bestStreak})
            </div>
          </div>
          <div className="mt-3">
            <WowXpBar totalXp={data.totalXp} level={data.level} size="md" />
            <p className="mt-2 text-xs text-ds-muted">
              <span className="font-semibold text-ds-foreground/90">{data.xpIntoLevel}</span> /{" "}
              <span className="font-semibold text-ds-foreground/90">{data.xpIntoLevel + data.xpToNextLevel}</span> XP ·{" "}
              <span className="font-semibold">{data.xpToNextLevel}</span> to next level
            </p>
          </div>
        </Card>
      ) : null}

      {mode === "insights" ? (
        <Card padding="md">
          <p className="text-sm font-semibold text-ds-foreground">Badges</p>
          {badges.length === 0 ? (
            <p className="mt-2 text-sm text-ds-muted">No badges yet.</p>
          ) : (
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {badges.map((b) => (
                <div
                  key={b.id}
                  className="flex items-start gap-2 rounded-lg border border-ds-border bg-ds-secondary/20 px-3 py-2"
                >
                  <BadgeCheck className="mt-0.5 h-4 w-4 text-ds-success" aria-hidden />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-ds-foreground">{b.name}</p>
                    <p className="mt-0.5 line-clamp-2 text-xs text-ds-muted">{b.description}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      ) : null}

      {mode === "insights" ? (
        <Card padding="md">
          <p className="text-sm font-semibold text-ds-foreground">Recent XP</p>
          {data.recentXp.length === 0 ? (
            <p className="mt-2 text-sm text-ds-muted">No XP events yet.</p>
          ) : (
            <div className="mt-3 space-y-2">
              {data.recentXp.map((r) => (
                <div
                  key={r.id}
                  className="flex items-start justify-between gap-3 rounded-lg border border-ds-border bg-ds-secondary/20 px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-ds-foreground tabular-nums">+{r.amount} XP</p>
                    <p className="mt-0.5 text-xs text-ds-muted">{r.reason ?? r.reasonCode}</p>
                  </div>
                  <span className="shrink-0 text-[11px] font-semibold text-ds-muted">
                    {new Date(r.createdAt).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>
      ) : null}
    </div>
  );
}

