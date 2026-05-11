"use client";

import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { BadgeDto } from "@/lib/gamificationService";
import { BadgeMedal } from "@/components/operations/xp/BadgeMedal";
import { useAchievementReveal } from "@/hooks/useXpMotionHooks";

export function AchievementRevealLayer({
  queue,
  onShift,
}: {
  queue: BadgeDto[];
  onShift: () => void;
}) {
  const current = queue[0];
  const reveal = useAchievementReveal();

  useEffect(() => {
    if (!current) return;
    const dwell = reveal.reduced ? 1200 : 2000;
    const t = window.setTimeout(() => onShift(), dwell);
    return () => window.clearTimeout(t);
  }, [current, onShift, reveal.reduced]);

  return (
    <AnimatePresence mode="wait">
      {current ? (
        <motion.div
          key={current.id}
          className="fixed inset-0 z-[125] flex items-end justify-center p-4 pb-10 sm:items-center sm:pb-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <div className="absolute inset-0 bg-slate-950/35 backdrop-blur-[1px]" aria-hidden />
          <motion.div
            role="status"
            className="relative w-full max-w-md"
            initial={reveal.card.initial}
            animate={reveal.card.animate}
            transition={reveal.card.transition}
          >
            <div className="rounded-2xl border border-white/20 bg-white/90 p-1 shadow-2xl backdrop-blur-md dark:border-white/10 dark:bg-[#0b1220]/92">
              <div className="rounded-xl bg-gradient-to-br from-slate-50 to-white p-4 dark:from-[#111827] dark:to-[#0b1220]">
                <p className="text-center text-[10px] font-bold uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
                  Achievement unlocked
                </p>
                <motion.div className="mt-3" {...(reveal.iconPulse ? { animate: reveal.iconPulse } : {})}>
                  <BadgeMedal badge={current} showRarityLabel />
                </motion.div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
