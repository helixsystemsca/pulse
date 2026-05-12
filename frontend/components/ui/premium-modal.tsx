"use client";

import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";
import { APP_MODAL_PORTAL_Z_BASE } from "@/components/ui/app-modal-layer";
import { AnimatedBackdrop } from "@/components/ui/animated-backdrop";
import { modalPanelVariants, motionSpring, motionTransition } from "@/lib/motion";
import { setShellPremiumOverlay } from "@/lib/shell-premium-overlay";
import { cn } from "@/lib/cn";
import { useReducedEffects } from "@/hooks/useReducedEffects";

export type PremiumModalProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
  size?: "md" | "lg";
};

export function PremiumModal({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  className,
  size = "md",
}: PremiumModalProps) {
  const [ready, setReady] = useState(false);
  const { reduced } = useReducedEffects();

  useLayoutEffect(() => {
    setReady(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const body = document.body;
    const prevOverflow = body.style.overflow;
    const prevPaddingRight = body.style.paddingRight;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    body.style.overflow = "hidden";
    if (scrollbarWidth > 0) body.style.paddingRight = `${scrollbarWidth}px`;
    return () => {
      body.style.overflow = prevOverflow;
      body.style.paddingRight = prevPaddingRight;
    };
  }, [open]);

  useEffect(() => {
    setShellPremiumOverlay(open, { reducedMotion: Boolean(reduced) });
    return () => setShellPremiumOverlay(false);
  }, [open, reduced]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => {
      const root = document.querySelector<HTMLElement>("[data-premium-modal-panel]");
      const focusable = root?.querySelector<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      focusable?.focus();
    }, 50);
    return () => window.clearTimeout(t);
  }, [open]);

  if (!ready) return null;

  const panelTransition = reduced ? motionTransition.modal : motionSpring.modal;

  return createPortal(
    <AnimatePresence>
      {open ? (
        <div
          className={`fixed inset-0 ${APP_MODAL_PORTAL_Z_BASE} flex items-center justify-center p-4 sm:p-6`}
          role="presentation"
        >
          <AnimatedBackdrop onClick={onClose} />
          <motion.div
            data-premium-modal-panel
            role="dialog"
            aria-modal="true"
            aria-labelledby="premium-modal-title"
            className={cn(
              "relative z-[1] flex max-h-[min(92dvh,920px)] min-h-0 w-full flex-col overflow-hidden rounded-xl border border-ds-border bg-ds-primary shadow-[0_20px_60px_rgba(15,23,42,0.18)] dark:border-ds-border dark:bg-ds-secondary/95 dark:shadow-[0_24px_70px_rgba(0,0,0,0.45)]",
              size === "lg" ? "max-w-2xl" : "max-w-lg",
              className,
            )}
            variants={modalPanelVariants}
            initial={reduced ? "show" : "hidden"}
            animate="show"
            exit={reduced ? "show" : "hidden"}
            transition={panelTransition}
          >
            <header className="shrink-0 border-b border-ds-border px-5 py-4 dark:border-ds-border">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 id="premium-modal-title" className="text-lg font-bold tracking-tight text-ds-foreground">
                    {title}
                  </h2>
                  {subtitle ? <p className="mt-1 text-sm text-ds-muted">{subtitle}</p> : null}
                </div>
                <button
                  type="button"
                  className="shrink-0 rounded-lg p-2 text-ds-muted transition-colors hover:bg-ds-secondary hover:text-ds-foreground"
                  onClick={onClose}
                  aria-label="Close"
                >
                  <X className="h-5 w-5" strokeWidth={2} />
                </button>
              </div>
            </header>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4">{children}</div>
            {footer ? (
              <footer className="shrink-0 border-t border-ds-border bg-ds-secondary/30 px-5 py-3 dark:border-ds-border">
                {footer}
              </footer>
            ) : null}
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}
