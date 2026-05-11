"use client";

import { useEffect } from "react";
import { motion, useMotionValue, useSpring } from "framer-motion";
import { TrendingUp } from "lucide-react";
import { Card } from "@/components/pulse/Card";
import { useReducedEffects } from "@/hooks/useReducedEffects";
import { cn } from "@/lib/cn";
import type { UserAnalytics } from "@/lib/gamificationService";

type Props = {
  analytics: UserAnalytics;
  className?: string;
};

export function WorkerXpCard({ analytics, className }: Props) {
  const { reduced } = useReducedEffects();
  const title = analytics.professionalTitle ?? "Operator I";
  const pl = analytics.professionalLevel ?? 1;
  const into = analytics.professionalXpInto ?? 0;
  const remaining = analytics.professionalXpToNext ?? 0;
  const span = Math.max(1, into + remaining);
  const ratio = Math.max(0, Math.min(1, into / span));
  const streak = analytics.attendanceShiftStreak ?? 0;
  const rec = analytics.recognitionsReceived ?? 0;

  const progress = useMotionValue(ratio);
  const spring = useSpring(progress, reduced ? { stiffness: 400, damping: 40 } : { stiffness: 140, damping: 24 });
  useEffect(() => {
    progress.set(ratio);
  }, [ratio, progress]);

  return (
    <Card
      padding="md"
      variant="secondary"
      className={cn(
        "border border-ds-border/80 bg-gradient-to-br from-ds-secondary/80 via-ds-primary to-ds-secondary/60 shadow-sm",
        "transition-[box-shadow,transform] duration-200 hover:shadow-[var(--ds-shadow-card-hover)]",
        className,
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-ds-muted">Operational standing</p>
          <p className="mt-1 font-headline text-lg font-extrabold text-ds-foreground">{title}</p>
          <p className="mt-0.5 text-xs text-ds-muted">Tier {pl} · {analytics.totalXp.toLocaleString()} total XP</p>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full border border-ds-border bg-ds-primary/90 px-2.5 py-1 text-[11px] font-bold text-ds-foreground">
          <TrendingUp className="h-3.5 w-3.5 text-ds-accent" aria-hidden />
          Growth
        </span>
      </div>

      <div className="mt-4">
        <div className="flex items-center justify-between text-[11px] font-semibold text-ds-muted">
          <span>Progress to next tier</span>
          <span className="tabular-nums text-ds-foreground">
            {into} / {span} XP
          </span>
        </div>
        <div className="relative mt-2 h-2 overflow-hidden rounded-full bg-ds-border/60">
          <motion.div
            className="relative h-full origin-left rounded-full bg-[color-mix(in_srgb,var(--ds-accent)_72%,var(--ds-foreground)_8%)]"
            style={{ scaleX: spring, width: "100%" }}
          />
          {!reduced ? (
            <div
              key={Math.round(ratio * 1000)}
              className="pointer-events-none absolute inset-0 xp-bar-shimmer opacity-40 mix-blend-screen"
              aria-hidden
            />
          ) : null}
        </div>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
        <div className="rounded-lg border border-ds-border/60 bg-ds-primary/50 px-3 py-2">
          <dt className="font-semibold text-ds-muted">Shift streak</dt>
          <dd className="mt-0.5 font-extrabold tabular-nums text-ds-foreground">{streak}</dd>
        </div>
        <div className="rounded-lg border border-ds-border/60 bg-ds-primary/50 px-3 py-2">
          <dt className="font-semibold text-ds-muted">Recognitions</dt>
          <dd className="mt-0.5 font-extrabold tabular-nums text-ds-foreground">{rec}</dd>
        </div>
        <div className="rounded-lg border border-ds-border/60 bg-ds-primary/50 px-3 py-2">
          <dt className="font-semibold text-ds-muted">Procedures</dt>
          <dd className="mt-0.5 font-extrabold tabular-nums text-ds-foreground">{analytics.proceduresCompleted ?? 0}</dd>
        </div>
      </dl>
    </Card>
  );
}
