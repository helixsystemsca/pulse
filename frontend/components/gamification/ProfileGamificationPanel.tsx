"use client";

import { Loader2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { WowXpBar } from "@/components/gamification/WowXpBar";
import {
  getGamificationMe,
  managerAwardXp,
  patchAvatarBorder,
  type GamificationMe,
} from "@/lib/gamificationService";
import { parseClientApiError } from "@/lib/parse-client-api-error";
import { sessionHasAnyRole } from "@/lib/pulse-roles";
import { usePulseAuth } from "@/hooks/usePulseAuth";
import { cn } from "@/lib/cn";
import { buttonVariants } from "@/styles/button-variants";

const BORDERS: { id: string; label: string }[] = [
  { id: "bronze", label: "Bronze" },
  { id: "silver", label: "Silver" },
  { id: "gold", label: "Gold" },
  { id: "elite", label: "Elite" },
];

export function ProfileGamificationPanel() {
  const [data, setData] = useState<GamificationMe | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [borderBusy, setBorderBusy] = useState(false);
  const [awardUserId, setAwardUserId] = useState("");
  const [awardAmt, setAwardAmt] = useState("25");
  const [awardReason, setAwardReason] = useState("");
  const [awardBusy, setAwardBusy] = useState(false);

  const { session } = usePulseAuth();
  const canAward = session ? sessionHasAnyRole(session, "manager", "company_admin") : false;

  const load = useCallback(async () => {
    if (!session?.sub) return;
    setLoading(true);
    setErr(null);
    try {
      setData(await getGamificationMe());
    } catch (e) {
      setErr(parseClientApiError(e).message);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [session?.sub]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onBorder(id: string | null) {
    setBorderBusy(true);
    setErr(null);
    try {
      await patchAvatarBorder(id);
      await load();
    } catch (e) {
      setErr(parseClientApiError(e).message);
    } finally {
      setBorderBusy(false);
    }
  }

  async function onAward() {
    if (!awardUserId.trim() || !awardReason.trim()) return;
    setAwardBusy(true);
    setErr(null);
    try {
      await managerAwardXp(awardUserId.trim(), Number(awardAmt) || 0, awardReason.trim());
      setAwardUserId("");
      setAwardReason("");
      await load();
    } catch (e) {
      setErr(parseClientApiError(e).message);
    } finally {
      setAwardBusy(false);
    }
  }

  if (loading) {
    return (
      <section className="ds-card-elevated flex items-center gap-2 border border-ds-border p-5">
        <Loader2 className="h-4 w-4 animate-spin text-ds-muted" aria-hidden />
        <span className="text-sm text-ds-muted">Loading gamification…</span>
      </section>
    );
  }

  if (!data) {
    return err ? (
      <section className="rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-100">
        {err}
      </section>
    ) : null;
  }

  const a = data.analytics;
  const unlocked = new Set(a.unlockedAvatarBorders ?? []);

  return (
    <section className="ds-card-elevated space-y-5 border border-ds-border p-5">
      <div>
        <h2 className="text-sm font-bold text-ds-foreground">Experience &amp; recognition</h2>
        <p className="mt-1 text-sm text-ds-muted">Level, XP segments, streak, badges, and avatar border (unlocks at levels 10 / 20 / 30 / 50).</p>
      </div>
      {err ? <p className="text-sm text-ds-danger">{err}</p> : null}
      {a.totalXp === 0 ? (
        <div className="rounded-md border border-ds-border bg-ds-secondary px-5 py-6 text-center space-y-3">
          <p className="text-2xl">🏁</p>
          <p className="text-sm font-bold text-ds-foreground">You&apos;re just getting started</p>
          <p className="text-xs text-ds-muted max-w-xs mx-auto leading-relaxed">
            Complete your first task to earn XP and start building your streak. Your stats will appear here.
          </p>
          <a
            href="/worker"
            className="inline-flex items-center gap-1.5 rounded-md bg-ds-accent px-4 py-2 text-xs font-bold text-ds-accent-foreground hover:bg-ds-accent/90"
          >
            View my tasks →
          </a>
        </div>
      ) : (
        <WowXpBar
          totalXp={a.totalXp}
          level={a.level}
          xpIntoLevel={a.xpIntoLevel}
          xpToNextLevel={a.xpToNextLevel}
          showTotals
        />
      )}
      <div className="flex flex-wrap items-center gap-2 text-xs text-ds-muted">
        <span className="font-semibold text-ds-foreground">Streak:</span> {a.streak ?? 0} day(s)
      </div>
      <div>
        <h3 className="text-xs font-bold uppercase tracking-wider text-ds-muted">Avatar border</h3>
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={borderBusy}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold ${!a.avatarBorder ? "bg-ds-success/20 text-ds-foreground" : "border border-ds-border bg-ds-secondary text-ds-muted"}`}
            onClick={() => void onBorder(null)}
          >
            Default
          </button>
          {BORDERS.map((b) => (
            <button
              key={b.id}
              type="button"
              disabled={borderBusy || !unlocked.has(b.id)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                a.avatarBorder === b.id ? "bg-ds-success/20 text-ds-foreground" : "border border-ds-border bg-ds-secondary text-ds-muted"
              } ${!unlocked.has(b.id) ? "opacity-40" : ""}`}
              onClick={() => void onBorder(b.id)}
            >
              {b.label}
            </button>
          ))}
        </div>
      </div>
      <div>
        <h3 className="text-xs font-bold uppercase tracking-wider text-ds-muted">Badges</h3>
        <ul className="mt-2 grid gap-2 sm:grid-cols-2">
          {data.unlockedBadges.map((b) => (
            <li key={b.id} className="rounded-lg border border-ds-border bg-ds-secondary/40 px-3 py-2 text-sm">
              <p className="font-semibold text-ds-foreground">{b.name}</p>
              <p className="text-xs text-ds-muted">{b.description}</p>
            </li>
          ))}
          {data.unlockedBadges.length === 0 ? <li className="text-sm text-ds-muted">No badges yet — keep completing work on time.</li> : null}
        </ul>
      </div>
      {canAward ? (
        <div className="rounded-lg border border-ds-border bg-ds-secondary/30 p-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-ds-muted">Award bonus XP</h3>
          <div className="mt-2 grid gap-2 sm:grid-cols-3">
            <input
              className="rounded-md border border-ds-border bg-ds-primary px-2 py-2 text-sm"
              placeholder="User ID"
              value={awardUserId}
              onChange={(e) => setAwardUserId(e.target.value)}
            />
            <input
              className="rounded-md border border-ds-border bg-ds-primary px-2 py-2 text-sm"
              type="number"
              min={1}
              max={500}
              value={awardAmt}
              onChange={(e) => setAwardAmt(e.target.value)}
            />
            <input
              className="rounded-md border border-ds-border bg-ds-primary px-2 py-2 text-sm sm:col-span-3"
              placeholder="Reason shown to the operator"
              value={awardReason}
              onChange={(e) => setAwardReason(e.target.value)}
            />
          </div>
          <button type="button" className={cn(buttonVariants({ surface: "light", intent: "accent" }), "mt-3 px-4 py-2 text-sm")} disabled={awardBusy} onClick={() => void onAward()}>
            {awardBusy ? "Sending…" : "Award XP"}
          </button>
        </div>
      ) : null}
    </section>
  );
}
