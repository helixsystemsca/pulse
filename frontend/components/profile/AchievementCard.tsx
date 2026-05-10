"use client";

import { Award } from "lucide-react";
import { Card } from "@/components/pulse/Card";
import type { BadgeDto } from "@/lib/gamificationService";
import { cn } from "@/lib/cn";

export function AchievementCard({ badges, loading }: { badges: BadgeDto[]; loading?: boolean }) {
  return (
    <Card
      padding="lg"
      variant="primary"
      className={cn(
        "overflow-hidden border-0 bg-[linear-gradient(120deg,#36F1CD_0%,#4C6085_78%)] text-white shadow-[var(--ds-shadow-card-hover)]",
        "transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5",
      )}
    >
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/15 backdrop-blur-sm">
          <Award className="h-6 w-6" aria-hidden />
        </span>
        <div>
          <p className="text-base font-extrabold">Achievements &amp; badges</p>
          <p className="mt-0.5 text-sm text-white/85">Unlocked through consistent, high-quality work.</p>
        </div>
      </div>

      <ul className="mt-4 grid gap-2 sm:grid-cols-2">
        {loading ? (
          <li className="h-16 animate-pulse rounded-xl bg-white/10" />
        ) : badges.length === 0 ? (
          <li className="rounded-xl border border-white/25 bg-white/10 px-4 py-5 text-sm font-semibold text-white/90 backdrop-blur-sm sm:col-span-2">
            No badges yet — keep completing assignments on time to unlock recognition.
          </li>
        ) : (
          badges.map((b) => (
            <li
              key={b.id}
              className="rounded-xl border border-white/20 bg-white/12 px-3 py-3 text-sm backdrop-blur-md transition-colors hover:bg-white/18"
            >
              <p className="font-extrabold">{b.name}</p>
              <p className="mt-1 text-xs text-white/85">{b.description}</p>
            </li>
          ))
        )}
      </ul>
    </Card>
  );
}
