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
}: PulseDrawerProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80]">
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/35 backdrop-blur-[2px]"
        aria-label="Close panel"
        onClick={onClose}
      />
      <aside
        className={`absolute right-0 top-0 flex h-full w-full flex-col border-l border-slate-200/90 bg-white shadow-[0_0_40px_rgba(15,23,42,0.12)] transition-transform duration-200 ease-out ${
          wide ? "sm:max-w-2xl" : "sm:max-w-[440px]"
        }`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
      >
        <header className="shrink-0 border-b border-slate-100 px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h2 id={labelledBy} className="text-lg font-bold tracking-tight text-[#2B4C7E]">
                {title}
              </h2>
              {subtitle ? <p className="mt-1 text-sm text-pulse-muted">{subtitle}</p> : null}
            </div>
            <button
              type="button"
              className="shrink-0 rounded-lg p-2 text-pulse-muted transition-colors hover:bg-slate-100 hover:text-pulse-navy"
              onClick={onClose}
              aria-label="Close"
            >
              <X className="h-5 w-5" strokeWidth={2} />
            </button>
          </div>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto bg-[#fafbfc] px-6 py-5">{children}</div>
        {footer ? <footer className="shrink-0 border-t border-slate-100 bg-white px-6 py-4">{footer}</footer> : null}
      </aside>
    </div>
  );
}
