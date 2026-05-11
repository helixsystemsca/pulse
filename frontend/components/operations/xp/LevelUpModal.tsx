"use client";

import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import type { BadgeDto } from "@/lib/gamificationService";
import { BadgeMedal } from "@/components/operations/xp/BadgeMedal";
import { useLevelUpSequence } from "@/hooks/useXpMotionHooks";
import { cn } from "@/lib/cn";

export function LevelUpModal({
  open,
  level,
  titleLine,
  subtitle,
  badges,
  onClose,
}: {
  open: boolean;
  level: number;
  titleLine: string;
  subtitle?: string;
  badges: BadgeDto[];
  onClose: () => void;
}) {
  const seq = useLevelUpSequence();

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => onClose(), seq.autoCloseMs);
    return () => window.clearTimeout(t);
  }, [open, onClose, seq.autoCloseMs]);

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-[130] flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: seq.backdropDuration }}
        >
          <button
            type="button"
            className="absolute inset-0 bg-slate-950/45 backdrop-blur-[2px]"
            aria-label="Dismiss level up"
            onClick={onClose}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="xp-level-up-heading"
            className="relative max-w-md overflow-hidden rounded-3xl border border-amber-200/35 bg-gradient-to-b from-[#1a1520] via-[#121018] to-[#0a0a0c] p-8 shadow-[0_32px_120px_-24px_rgba(0,0,0,0.75)] dark:border-amber-400/25"
            initial={{ scale: 0.94, opacity: 0, y: 10 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.96, opacity: 0, y: 6 }}
            transition={seq.reduced ? { duration: 0.2 } : { type: "spring", stiffness: 280, damping: 28 }}
          >
            {!seq.reduced ? (
              <div
                className="pointer-events-none absolute -inset-24 opacity-55 blur-3xl"
                style={{
                  background:
                    "radial-gradient(circle at 50% 40%, rgba(251,191,36,0.35), transparent 55%), radial-gradient(circle at 30% 70%, rgba(250,204,21,0.12), transparent 45%)",
                }}
              />
            ) : null}

            <div className="relative flex flex-col items-center text-center">
              <motion.div
                className="relative grid h-28 w-28 place-items-center rounded-full border border-amber-300/40 bg-gradient-to-b from-amber-100/15 to-transparent"
                initial={{ scale: 0.85, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: seq.ringDuration, ease: [0.22, 1, 0.36, 1] }}
              >
                {!seq.reduced ? (
                  <motion.span
                    className="pointer-events-none absolute inset-0 rounded-full bg-[radial-gradient(circle_at_50%_50%,rgba(251,191,36,0.35),transparent_62%)]"
                    initial={{ opacity: 0, scale: 0.85 }}
                    animate={{ opacity: [0, 0.85, 0], scale: [0.85, 1.05, 1.12] }}
                    transition={{ duration: seq.burstDuration > 0 ? seq.burstDuration : 0.42, ease: "easeOut" }}
                  />
                ) : null}
                <motion.span
                  className="font-headline text-4xl font-black tabular-nums text-amber-100 drop-shadow-[0_0_18px_rgba(251,191,36,0.45)]"
                  initial={{ scale: 0.6, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: seq.reduced ? 0 : 0.12, type: "spring", stiffness: 220, damping: 18 }}
                >
                  {level}
                </motion.span>
              </motion.div>

              <motion.p
                className="mt-6 text-[11px] font-bold uppercase tracking-[0.28em] text-amber-200/80"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: seq.titleStagger }}
              >
                Level achieved
              </motion.p>
              <motion.h2
                id="xp-level-up-heading"
                className="mt-2 font-headline text-2xl font-extrabold tracking-tight text-white"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: seq.titleStagger * 2 }}
              >
                {titleLine}
              </motion.h2>
              {subtitle ? (
                <motion.p
                  className="mt-2 text-sm text-slate-300"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: seq.titleStagger * 3 }}
                >
                  {subtitle}
                </motion.p>
              ) : null}

              {badges.length > 0 ? (
                <motion.div
                  className="mt-6 w-full space-y-2"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: seq.titleStagger * 4 }}
                >
                  <p className="flex items-center justify-center gap-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    <Sparkles className="h-3.5 w-3.5 text-amber-200/90" aria-hidden />
                    Unlocked
                  </p>
                  <div className="max-h-40 space-y-2 overflow-y-auto pr-1">
                    {badges.slice(0, 3).map((b) => (
                      <BadgeMedal key={b.id} badge={b} size="sm" showRarityLabel />
                    ))}
                  </div>
                </motion.div>
              ) : null}

              <button
                type="button"
                className={cn(
                  "mt-8 rounded-full border border-white/15 bg-white/10 px-5 py-2 text-xs font-bold text-white transition hover:bg-white/15",
                )}
                onClick={onClose}
              >
                Continue
              </button>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
