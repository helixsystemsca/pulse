"use client";

import type { ReactNode } from "react";
import { X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";
import { APP_MODAL_PORTAL_Z_BASE, APP_MODAL_PORTAL_Z_ELEVATED } from "@/components/ui/app-modal-layer";
import { drawerPanelVariants, modalBackdropVariants, modalPanelVariants, motionSpring, motionTransition } from "@/lib/motion";
import { setShellPremiumOverlay } from "@/lib/shell-premium-overlay";
import { useReducedEffects } from "@/hooks/useReducedEffects";

type PulseDrawerProps = {
  open: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
  placement?: "right" | "center";
  labelledBy?: string;
  elevated?: boolean;
  belowAppHeader?: boolean;
};

/** Right-side or centered panel with premium motion, backdrop blur, and subtle shell scale. */
export function PulseDrawer({
  open,
  title,
  subtitle,
  onClose,
  children,
  footer,
  wide,
  placement = "right",
  labelledBy = "pulse-drawer-title",
  elevated = false,
  belowAppHeader = true,
}: PulseDrawerProps) {
  const [portalReady, setPortalReady] = useState(false);
  const { reduced } = useReducedEffects();

  useLayoutEffect(() => {
    setPortalReady(true);
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
      const root = document.querySelector<HTMLElement>("[data-pulse-drawer-panel]");
      const focusable = root?.querySelector<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      focusable?.focus();
    }, 40);
    return () => window.clearTimeout(t);
  }, [open]);

  if (!portalReady) return null;

  const rightPanelLayout = belowAppHeader ? "top-0 bottom-0 max-h-full min-h-0" : "top-0 h-full";
  const centeredMaxH = belowAppHeader ? "max-h-full min-h-0" : "max-h-[calc(100dvh-2rem)] min-h-0";

  const zLayer = elevated ? APP_MODAL_PORTAL_Z_ELEVATED : APP_MODAL_PORTAL_Z_BASE;
  const shellGeom = belowAppHeader ? "fixed left-0 right-0 top-16 bottom-0" : "fixed inset-0";
  const shellOverflow =
    placement === "center" ? "overflow-y-auto overflow-x-hidden" : "overflow-hidden";
  const shellFlex =
    placement === "center" ? "flex min-h-0 flex-col items-center justify-center p-4 sm:p-6" : "";

  const instant = reduced;
  const panelTransition = instant ? motionTransition.modal : placement === "center" ? motionSpring.modal : motionSpring.drawer;

  const layer = (
    <AnimatePresence>
      {open ? (
        <div
          key="pulse-drawer-layer"
          className={`pointer-events-auto ${shellGeom} ${zLayer} ${shellOverflow} ${shellFlex}`.trim()}
        >
          <motion.button
            type="button"
            tabIndex={-1}
            className="ds-modal-backdrop absolute inset-0 backdrop-blur-[4px]"
            aria-label="Close panel"
            variants={modalBackdropVariants}
            initial={instant ? "show" : "hidden"}
            animate="show"
            exit={instant ? "show" : "hidden"}
            transition={motionTransition.modal}
            onClick={onClose}
          />
          <motion.aside
            data-pulse-drawer-panel
            className={`${
              placement === "center"
                ? `relative flex min-h-0 w-full shrink flex-col overflow-hidden rounded-xl border border-pulseShell-border bg-pulseShell-surface shadow-[0_18px_60px_rgba(15,23,42,0.20)] ${centeredMaxH} ${
                    wide ? "max-w-2xl" : "max-w-[520px]"
                  }`
                : `absolute right-0 flex min-h-0 w-full flex-col border-l border-pulseShell-border bg-pulseShell-surface shadow-[0_0_28px_rgba(15,23,42,0.08)] dark:shadow-[0_0_36px_rgba(0,0,0,0.32)] ${rightPanelLayout} ${
                    wide ? "sm:max-w-2xl" : "sm:max-w-[440px]"
                  }`
            }`}
            role="dialog"
            aria-modal="true"
            aria-labelledby={labelledBy}
            variants={placement === "center" ? modalPanelVariants : drawerPanelVariants}
            initial={instant ? "show" : "hidden"}
            animate="show"
            exit={instant ? "show" : "hidden"}
            transition={panelTransition}
          >
            <header className="shrink-0 border-b border-pulseShell-border px-6 py-5">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <h2 id={labelledBy} className="text-lg font-bold tracking-tight text-[#2B4C7E] dark:text-blue-300">
                    {title}
                  </h2>
                  {subtitle ? <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{subtitle}</p> : null}
                </div>
                <button
                  type="button"
                  className="shrink-0 rounded-lg p-2 text-ds-muted transition-colors hover:bg-ds-interactive-hover hover:text-ds-foreground dark:text-slate-400 dark:hover:text-slate-100"
                  onClick={onClose}
                  aria-label="Close"
                >
                  <X className="h-5 w-5" strokeWidth={2} />
                </button>
              </div>
            </header>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-pulseShell-header-row/80 px-6 py-5 dark:bg-pulseShell-canvas">
              {children}
            </div>
            {footer ? (
              <footer className="shrink-0 border-t border-pulseShell-border bg-pulseShell-surface px-6 py-4">
                {footer}
              </footer>
            ) : null}
          </motion.aside>
        </div>
      ) : null}
    </AnimatePresence>
  );

  return createPortal(layer, document.body);
}
