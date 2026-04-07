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
  labelledBy = "pulse-drawer-title",
  elevated = false,
  belowAppHeader = false,
}: PulseDrawerProps) {
  if (!open) return null;

  const panelLayout = belowAppHeader
    ? "top-16 bottom-0 max-h-[calc(100dvh-4rem)] min-h-0"
    : "top-0 h-full";

  return (
    <div className={`fixed inset-0 ${elevated ? "z-[90]" : "z-[80]"}`}>
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/35 backdrop-blur-[2px] dark:bg-black/55"
        aria-label="Close panel"
        onClick={onClose}
      />
      <aside
        className={`absolute right-0 flex w-full flex-col border-l border-pulseShell-border bg-pulseShell-surface shadow-[0_0_28px_rgba(15,23,42,0.08)] transition-transform duration-200 ease-out dark:shadow-[0_0_36px_rgba(0,0,0,0.32)] ${panelLayout} ${
          wide ? "sm:max-w-2xl" : "sm:max-w-[440px]"
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
              className="shrink-0 rounded-lg p-2 text-gray-500 transition-colors hover:bg-pulseShell-elevated hover:text-gray-900 dark:text-slate-400 dark:hover:bg-pulseShell-elevated dark:hover:text-slate-100"
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
