"use client";

import { useEffect, useState } from "react";

export type XpToastPayload = { amount: number; reason: string; at: number };

export function XpGainToast({ toast, onDone }: { toast: XpToastPayload | null; onDone: () => void }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!toast) {
      setVisible(false);
      return;
    }
    setVisible(true);
    const t = window.setTimeout(() => {
      setVisible(false);
      onDone();
    }, 2400);
    return () => window.clearTimeout(t);
  }, [toast, onDone]);

  if (!toast) return null;

  return (
    <div
      className={`pointer-events-none fixed right-4 top-20 z-[200] max-w-sm transition-all duration-500 ease-out ${
        visible ? "translate-y-0 opacity-100" : "-translate-y-3 opacity-0"
      }`}
      role="status"
    >
      <div className="rounded-xl border border-ds-border bg-ds-primary/95 px-4 py-3 shadow-lg backdrop-blur-sm">
        <p className="text-sm font-extrabold text-ds-success">+{toast.amount} XP</p>
        <p className="mt-0.5 text-xs font-medium text-ds-muted">{toast.reason}</p>
      </div>
    </div>
  );
}
