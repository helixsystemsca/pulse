"use client";

import { Award } from "lucide-react";
import { BadgeMedal } from "@/components/operations/xp/BadgeMedal";
import { Card } from "@/components/pulse/Card";
import type { BadgeDto } from "@/lib/gamificationService";

export function AchievementGrid({
  catalog,
  loading,
}: {
  catalog: BadgeDto[];
  loading?: boolean;
}) {
  const sorted = [...catalog].sort((a, b) => {
    const au = a.unlockedAt ? 0 : 1;
    const bu = b.unlockedAt ? 0 : 1;
    if (au !== bu) return au - bu;
    return a.name.localeCompare(b.name);
  });

  return (
    <Card
      padding="lg"
      variant="elevated"
      className="transition-[box-shadow] duration-200 hover:shadow-[var(--ds-shadow-card-hover)]"
    >
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-ds-secondary text-ds-accent">
          <Award className="h-5 w-5" aria-hidden />
        </span>
        <div>
          <p className="font-headline text-base font-extrabold text-ds-foreground">Achievements</p>
          <p className="mt-1 text-xs text-ds-muted">Earned through reliability, compliance, and quality — not volume alone.</p>
        </div>
      </div>

      <ul className="mt-5 grid gap-2 sm:grid-cols-2">
        {loading ? (
          <li className="h-20 animate-pulse rounded-xl bg-ds-secondary/70 sm:col-span-2" />
        ) : sorted.length === 0 ? (
          <li className="rounded-xl border border-dashed border-ds-border px-4 py-6 text-center text-sm text-ds-muted sm:col-span-2">
            Achievements will appear as you meet operational milestones.
          </li>
        ) : (
          sorted.slice(0, 12).map((b) => {
            const locked = Boolean(b.isLocked) && !b.unlockedAt;
            return (
              <li key={b.id} className="flex flex-col gap-1">
                <BadgeMedal badge={b} locked={locked} size="sm" showRarityLabel className="h-full shadow-sm" />
                {b.xpReward ? (
                  <p className="text-center text-[10px] font-semibold tabular-nums text-ds-muted">+{b.xpReward} XP on earn</p>
                ) : null}
              </li>
            );
          })
        )}
      </ul>
    </Card>
  );
}
