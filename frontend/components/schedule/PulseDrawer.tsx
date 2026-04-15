"use client";

import type { ReactNode } from "react";
import { X } from "lucide-react";

type PulseDrawerProps = {
  open: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  /** Wider settings drawer */
  wide?: boolean;
  /** Render as a centered modal instead of right-side drawer. */
  placement?: "right" | "center";
  labelledBy?: string;
  /** Stack above shift drawer when both could interact */
  elevated?: boolean;
  /**
   * When true, the panel spans from below the app navbar (`h-16`) to the bottom so it does not cover the shell header.
   */
  belowAppHeader?: boolean;
};

/** Right-side panel: reference layout (light shell, subtle border, soft shadow). */
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
  if (!open) return null;

  const HEADER_OFFSET = "4rem"; // matches app navbar height (h-16)
  const HEADER_GAP = "12px";
  const rightPanelLayout = belowAppHeader
    ? `top-[calc(${HEADER_OFFSET}+${HEADER_GAP})] bottom-0 max-h-[calc(100dvh-${HEADER_OFFSET}-${HEADER_GAP})] min-h-0`
    : "top-0 h-full";
  const centeredMaxH = belowAppHeader
    ? `max-h-[calc(100dvh-${HEADER_OFFSET}-${HEADER_GAP}-2rem)]`
    : "max-h-[calc(100dvh-2rem)]";

  return (
    <div
      className={`fixed inset-0 ${elevated ? "z-[90]" : "z-[80]"} ${
        placement === "center" ? "flex items-center justify-center p-4" : ""
      }`}
    >
      <button
        type="button"
        className="ds-modal-backdrop absolute inset-0 backdrop-blur-[2px]"
        aria-label="Close panel"
        onClick={onClose}
      />
      <aside
        className={`${
          placement === "center"
            ? `relative flex w-full flex-col overflow-hidden rounded-xl border border-pulseShell-border bg-pulseShell-surface shadow-[0_18px_60px_rgba(15,23,42,0.20)] ${centeredMaxH} ${
                wide ? "max-w-2xl" : "max-w-[520px]"
              }`
            : `absolute right-0 flex w-full flex-col border-l border-pulseShell-border bg-pulseShell-surface shadow-[0_0_28px_rgba(15,23,42,0.08)] transition-transform duration-200 ease-out dark:shadow-[0_0_36px_rgba(0,0,0,0.32)] ${rightPanelLayout} ${
                wide ? "sm:max-w-2xl" : "sm:max-w-[440px]"
              }`
        }`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
      >
        <header className="shrink-0 border-b border-pulseShell-border px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h2 id={labelledBy} className="text-lg font-bold tracking-tight text-[#2B4C7E] dark:text-blue-300">
                {title}
              </h2>
              {subtitle ? (
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{subtitle}</p>
              ) : null}
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
        <div className="min-h-0 flex-1 overflow-y-auto bg-pulseShell-header-row/80 px-6 py-5 dark:bg-pulseShell-canvas">
          {children}
        </div>
        {footer ? (
          <footer className="shrink-0 border-t border-pulseShell-border bg-pulseShell-surface px-6 py-4">
            {footer}
          </footer>
        ) : null}
      </aside>
    </div>
  );
}
