"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Check, Loader2, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { buttonVariants } from "@/styles/button-variants";

export type WorkRequestCreateSubmitPhase = "idle" | "loading" | "success" | "error";

type WorkRequestCreateSubmitButtonProps = {
  phase: WorkRequestCreateSubmitPhase;
  onClick: () => void;
  disabled?: boolean;
  idleLabel?: string;
  loadingLabel?: string;
  successSrLabel?: string;
};

const labelMotion = {
  initial: { opacity: 0, y: 6, scale: 0.92 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: -4, scale: 0.92 },
  transition: { duration: 0.18, ease: [0.22, 1, 0.36, 1] },
};

export function WorkRequestCreateSubmitButton({
  phase,
  onClick,
  disabled = false,
  idleLabel = "Create request",
  loadingLabel = "Saving",
  successSrLabel = "Request created",
}: WorkRequestCreateSubmitButtonProps) {
  const pending = phase === "loading" || phase === "success";
  const locked = disabled || pending;

  return (
    <motion.button
      type="button"
      layout
      disabled={locked}
      aria-busy={phase === "loading"}
      aria-disabled={locked}
      aria-live="polite"
      onClick={onClick}
      initial={false}
      animate={
        phase === "success"
          ? {
              backgroundColor: "rgb(22 163 74)",
              borderColor: "rgb(21 128 61)",
              scale: [1, 0.94, 1.02, 1],
              boxShadow: "0 0 22px rgba(34, 197, 94, 0.42)",
            }
          : phase === "error"
            ? {
                backgroundColor: "rgb(220 38 38)",
                borderColor: "rgb(185 28 28)",
                x: [0, -5, 5, -3, 3, 0],
                boxShadow: "0 0 0px transparent",
                scale: 1,
              }
            : {
                backgroundColor: "var(--ds-accent)",
                borderColor: "transparent",
                x: 0,
                scale: 1,
                boxShadow: "0 0 0px transparent",
              }
      }
      transition={{
        backgroundColor: { duration: 0.22, ease: "easeOut" },
        borderColor: { duration: 0.22 },
        x: { duration: 0.42, ease: "easeInOut" },
        scale: { duration: 0.48, times: [0, 0.35, 0.7, 1], ease: [0.22, 1, 0.36, 1] },
        boxShadow: { duration: 0.28 },
      }}
      whileHover={
        phase === "idle" && !disabled
          ? { scale: 1.02, boxShadow: "0 4px 14px rgba(43, 76, 126, 0.22)" }
          : undefined
      }
      whileTap={phase === "idle" && !disabled ? { scale: 0.98 } : undefined}
      className={cn(
        buttonVariants({ surface: "light", intent: "accent" }),
        "relative min-w-[11rem] overflow-hidden border px-5 py-2.5 text-white transition-colors",
        phase === "success" && "!text-white",
        phase === "error" && "!text-white",
      )}
    >
      <AnimatePresence mode="wait" initial={false}>
        {phase === "loading" ? (
          <motion.span
            key="loading"
            className="inline-flex items-center justify-center gap-2"
            {...labelMotion}
          >
            <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
            <span className="text-sm font-semibold">{loadingLabel}</span>
          </motion.span>
        ) : phase === "success" ? (
          <motion.span
            key="success"
            className="inline-flex items-center justify-center"
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          >
            <Check className="h-5 w-5" strokeWidth={2.5} aria-hidden />
            <span className="sr-only">{successSrLabel}</span>
          </motion.span>
        ) : phase === "error" ? (
          <motion.span
            key="error"
            className="inline-flex items-center justify-center"
            {...labelMotion}
          >
            <X className="h-5 w-5" strokeWidth={2.5} aria-hidden />
            <span className="sr-only">Could not create request</span>
          </motion.span>
        ) : (
          <motion.span
            key="idle"
            className="text-sm font-semibold"
            {...labelMotion}
          >
            {idleLabel}
          </motion.span>
        )}
      </AnimatePresence>
    </motion.button>
  );
}
