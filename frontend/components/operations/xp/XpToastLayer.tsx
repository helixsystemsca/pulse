"use client";

import { AnimatePresence, motion } from "framer-motion";
import type { XpToastModel } from "@/components/operations/xp/XpFeedbackContext";
import { useReducedEffects } from "@/hooks/useReducedEffects";
import { useXPAnimation } from "@/lib/motion/xpMotion";
import { cn } from "@/lib/cn";

export function XpToastLayer({
  toasts,
  onDismiss,
}: {
  toasts: XpToastModel[];
  onDismiss: (id: string) => void;
}) {
  const { reduced } = useReducedEffects();
  const anim = useXPAnimation(reduced);

  return (
    <div
      className="pointer-events-none fixed bottom-6 right-6 z-[120] flex max-w-[min(92vw,320px)] flex-col items-end gap-2"
      aria-live="polite"
    >
      <AnimatePresence initial={false}>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            layout
            initial={{ opacity: 0, y: 14, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -18, scale: 0.98 }}
            transition={reduced ? { duration: 0.18 } : { type: "spring", stiffness: 420, damping: 32 }}
            className="pointer-events-auto"
            onAnimationComplete={() => {
              /* parent timer removes; avoid double-dismiss */
            }}
          >
            <div
              className={cn(
                "relative overflow-hidden rounded-2xl border border-white/35 bg-white/75 px-4 py-3 shadow-[0_16px_48px_-20px_rgba(15,23,42,0.45)] backdrop-blur-md dark:border-white/10 dark:bg-[#0f172a]/82",
                anim.enableShimmer && "xp-toast-shimmer",
              )}
            >
              <div className="flex flex-col gap-0.5">
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                  {t.caption ?? "Experience"}
                </p>
                <p className="font-headline text-lg font-extrabold tabular-nums text-[#1e3a5f] dark:text-[#e2e8f0]">
                  +{t.amount} XP
                </p>
              </div>
              <button
                type="button"
                className="absolute right-2 top-2 rounded-md px-1.5 py-0.5 text-[10px] font-semibold text-slate-500 opacity-0 transition-opacity hover:bg-black/5 hover:opacity-100 dark:text-slate-400 dark:hover:bg-white/10"
                onClick={() => onDismiss(t.id)}
              >
                Dismiss
              </button>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
