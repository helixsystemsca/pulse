"use client";

import { Award, Lock } from "lucide-react";
import { motion } from "framer-motion";
import type { BadgeDto } from "@/lib/gamificationService";
import { cn } from "@/lib/cn";
import { useReducedEffects } from "@/hooks/useReducedEffects";

const RARITY: Record<string, { ring: string; glow: string; label: string; pill: string }> = {
  common: {
    ring: "border-emerald-300/60 dark:border-emerald-600/45",
    glow: "shadow-[inset_0_1px_0_rgba(255,255,255,0.35)]",
    label: "Common",
    pill:
      "border border-emerald-200/90 bg-emerald-50 text-emerald-900 dark:border-emerald-600/40 dark:bg-emerald-950/55 dark:text-emerald-200",
  },
  rare: {
    ring: "border-blue-400/55 dark:border-blue-500/45",
    glow: "shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_0_20px_rgba(59,130,246,0.18)]",
    label: "Rare",
    pill:
      "border border-blue-200/90 bg-blue-50 text-blue-900 dark:border-blue-500/40 dark:bg-blue-950/55 dark:text-blue-200",
  },
  epic: {
    ring: "border-violet-400/60 dark:border-violet-400/45",
    glow:
      "shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_0_0_1px_rgba(139,92,246,0.2),0_0_24px_rgba(139,92,246,0.2)]",
    label: "Epic",
    pill:
      "border border-violet-200/90 bg-violet-50 text-violet-900 dark:border-violet-500/40 dark:bg-violet-950/55 dark:text-violet-200",
  },
  legendary: {
    ring: "border-orange-700/55 dark:border-orange-500/50",
    glow:
      "shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_0_0_1px_rgba(194,65,12,0.2),0_0_28px_rgba(234,88,12,0.22)]",
    label: "Legendary",
    pill:
      "border border-orange-400/85 bg-orange-200/90 text-orange-950 dark:border-orange-600/50 dark:bg-orange-950/65 dark:text-orange-200",
  },
};

function normalizeRarity(r?: string | null) {
  const k = (r || "common").toLowerCase();
  if (k === "uncommon") return RARITY.rare;
  return RARITY[k] ?? RARITY.common;
}

export function BadgeMedal({
  badge,
  locked,
  size = "md",
  className,
  showRarityLabel,
}: {
  badge: Pick<BadgeDto, "name" | "description" | "rarity" | "category">;
  locked?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
  showRarityLabel?: boolean;
}) {
  const { reduced } = useReducedEffects();
  const r = normalizeRarity(badge.rarity);
  const isLg = size === "lg";
  const isSm = size === "sm";
  const iconBox = isLg ? "h-14 w-14" : isSm ? "h-9 w-9" : "h-11 w-11";
  const rarityKey = (badge.rarity || "common").toLowerCase();
  const highRarity = rarityKey === "epic" || rarityKey === "legendary";

  return (
    <motion.div
      layout
      whileHover={reduced || locked ? undefined : { y: -2 }}
      transition={{ type: "spring", stiffness: 380, damping: 28 }}
      className={cn(
        "relative flex flex-col rounded-2xl border bg-gradient-to-br from-white/90 via-white/70 to-slate-100/90 p-3 dark:from-[#141c2a]/95 dark:via-[#101826]/95 dark:to-[#0c1018]/95",
        r.ring,
        r.glow,
        locked && "opacity-[0.52]",
        className,
      )}
    >
      {!reduced && !locked && highRarity ? (
        <span
          className="pointer-events-none absolute inset-0 rounded-2xl opacity-40 xp-badge-shimmer"
          aria-hidden
        />
      ) : null}
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "relative grid shrink-0 place-items-center rounded-xl border border-white/50 bg-gradient-to-b from-slate-100 to-slate-200/90 text-[#2B4C7E] dark:border-white/10 dark:from-[#1e293b] dark:to-[#0f172a] dark:text-[#7dd3fc]",
            iconBox,
          )}
        >
          <Award className={isLg ? "h-7 w-7" : isSm ? "h-4 w-4" : "h-5 w-5"} aria-hidden />
          {locked ? (
            <span className="absolute -bottom-1 -right-1 grid h-5 w-5 place-items-center rounded-full border border-ds-border bg-ds-secondary text-ds-muted">
              <Lock className="h-3 w-3" aria-hidden />
            </span>
          ) : null}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate font-headline text-sm font-extrabold text-ds-foreground">{badge.name}</p>
            {showRarityLabel ? (
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider",
                  r.pill,
                )}
              >
                {r.label}
              </span>
            ) : null}
          </div>
          {badge.category ? (
            <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-ds-muted">{badge.category}</p>
          ) : null}
          <p className="mt-1 line-clamp-3 text-xs text-ds-muted">{badge.description}</p>
        </div>
      </div>
    </motion.div>
  );
}
