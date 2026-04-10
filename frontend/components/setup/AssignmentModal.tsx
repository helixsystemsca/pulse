"use client";

import { X } from "lucide-react";

const overlay =
  "ds-modal-backdrop fixed inset-0 z-50 flex items-end justify-center p-4 backdrop-blur-[2px] sm:items-center sm:p-6";
const sheet =
  "w-full max-w-md rounded-md border border-slate-200/90 bg-white p-6 shadow-card-lg";

export function AssignmentModal({
  open,
  title,
  description,
  children,
  onClose,
}: {
  open: boolean;
  title: string;
  description?: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  if (!open) return null;
  return (
    <div className={overlay} role="dialog" aria-modal="true" aria-labelledby="assign-modal-title">
      <div className={sheet}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="assign-modal-title" className="text-lg font-semibold text-pulse-navy">
              {title}
            </h2>
            {description ? <p className="mt-1 text-sm text-pulse-muted">{description}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-pulse-muted hover:bg-slate-100 hover:text-pulse-navy"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="mt-5">{children}</div>
      </div>
    </div>
  );
}
