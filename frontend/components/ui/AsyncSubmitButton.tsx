"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Check, Loader2, X } from "lucide-react";
import type { MouseEventHandler, ReactNode } from "react";
import type { AsyncSubmitPhase } from "@/hooks/useAsyncSubmitPhase";
import { cn } from "@/lib/cn";
import { buttonVariants, type ButtonIntent, type ButtonSurface } from "@/styles/button-variants";

const labelMotion = {
  initial: { opacity: 0, y: 6, scale: 0.92 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: -4, scale: 0.92 },
  transition: { duration: 0.18, ease: [0.22, 1, 0.36, 1] as const },
};

export type AsyncSubmitButtonProps = {
  phase: AsyncSubmitPhase;
  onClick?: MouseEventHandler<HTMLButtonElement>;
  disabled?: boolean;
  /** Idle label when `children` is not a string. */
  idleLabel?: string;
  loadingLabel?: string;
  successSrLabel?: string;
  errorSrLabel?: string;
  /** Show short success text beside the checkmark (e.g. "Saved"). */
  showSuccessLabel?: boolean;
  successLabel?: string;
  intent?: ButtonIntent;
  surface?: ButtonSurface;
  className?: string;
  minWidth?: string;
  children?: ReactNode;
  type?: "button" | "submit" | "reset";
  form?: string;
  name?: string;
  value?: string;
  title?: string;
  id?: string;
};

export function AsyncSubmitButton({
  phase,
  onClick,
  disabled = false,
  idleLabel,
  loadingLabel = "Saving",
  successSrLabel = "Saved",
  errorSrLabel = "Could not save",
  showSuccessLabel = false,
  successLabel = "Saved",
  intent = "accent",
  surface = "light",
  className,
  minWidth = "min-w-[8.5rem]",
  type = "button",
  children,
  form,
  name,
  value,
  title,
  id,
}: AsyncSubmitButtonProps) {
  const pending = phase === "loading" || phase === "success";
  const locked = disabled || pending;
  const idleText =
    idleLabel ?? (typeof children === "string" ? children : showSuccessLabel ? "Save" : "Submit");

  return (
    <motion.button
      type={type}
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
        buttonVariants({ surface, intent }),
        "relative overflow-hidden border px-5 py-2.5 text-white transition-colors",
        minWidth,
        phase === "success" && "!text-white",
        phase === "error" && "!text-white",
        className,
      )}
      form={form}
      name={name}
      value={value}
      title={title}
      id={id}
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
            className="inline-flex items-center justify-center gap-1.5"
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          >
            <Check className="h-5 w-5" strokeWidth={2.5} aria-hidden />
            {showSuccessLabel ? (
              <span className="text-sm font-semibold">{successLabel}</span>
            ) : null}
            <span className="sr-only">{successSrLabel}</span>
          </motion.span>
        ) : phase === "error" ? (
          <motion.span key="error" className="inline-flex items-center justify-center" {...labelMotion}>
            <X className="h-5 w-5" strokeWidth={2.5} aria-hidden />
            <span className="sr-only">{errorSrLabel}</span>
          </motion.span>
        ) : (
          <motion.span key="idle" className="inline-flex items-center justify-center gap-2 text-sm font-semibold" {...labelMotion}>
            {typeof children === "string" || children == null ? idleText : children}
          </motion.span>
        )}
      </AnimatePresence>
    </motion.button>
  );
}
