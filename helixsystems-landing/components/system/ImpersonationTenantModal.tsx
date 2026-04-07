"use client";

/**
 * Full-screen modal: tenant Pulse preview using an impersonation JWT held only in memory
 * (`setImpersonationOverlayAccessToken`). Stored session stays system admin. Close calls
 * impersonation exit, refreshes admin tokens, and clears the overlay.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { OperationalDashboard } from "@/components/dashboard/OperationalDashboard";
import { getApiBaseUrl, isApiMode, refreshSessionWithToken } from "@/lib/api";
import { setImpersonationOverlayAccessToken } from "@/lib/impersonation-overlay-token";
import { readSession } from "@/lib/pulse-session";

export function ImpersonationTenantModal({
  accessToken,
  targetEmail,
  targetName,
  onClosed,
}: {
  accessToken: string;
  targetEmail: string;
  targetName: string | null;
  onClosed: () => void;
}) {
  const closingRef = useRef(false);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    return () => {
      setImpersonationOverlayAccessToken(null);
    };
  }, []);

  const handleClose = useCallback(async () => {
    if (closingRef.current) return;
    closingRef.current = true;
    setClosing(true);
    try {
      const base = getApiBaseUrl();
      if (base) {
        const res = await fetch(`${base}/api/v1/auth/impersonation/exit`, {
          method: "POST",
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (res.ok) {
          const data = (await res.json()) as { access_token: string };
          const remember = readSession()?.remember ?? false;
          await refreshSessionWithToken(data.access_token, remember);
        }
      }
    } finally {
      setImpersonationOverlayAccessToken(null);
      closingRef.current = false;
      setClosing(false);
      onClosed();
    }
  }, [accessToken, onClosed]);

  const label = targetName?.trim() || targetEmail;

  return (
    <div
      className="fixed inset-0 z-[200] flex flex-col bg-slate-900/40 backdrop-blur-sm dark:bg-black/50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="impersonation-modal-title"
    >
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-amber-500/40 bg-amber-50 px-4 py-3 text-amber-950 shadow-sm dark:border-amber-500/35 dark:bg-amber-950/95 dark:text-amber-100">
        <div className="min-w-0">
          <h2 id="impersonation-modal-title" className="text-sm font-semibold">
            Impersonation preview
          </h2>
          <p className="truncate text-xs opacity-90">
            Viewing as <span className="font-medium">{label}</span>
            {targetEmail && label !== targetEmail ? <span> ({targetEmail})</span> : null}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void handleClose()}
          disabled={closing}
          className="shrink-0 rounded-lg bg-amber-800 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-amber-900 disabled:opacity-60 dark:bg-amber-600 dark:hover:bg-amber-500"
        >
          {closing ? "Closing…" : "Close"}
        </button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto bg-pulse-bg p-4 md:p-6">
        {isApiMode() ? <OperationalDashboard variant="live" /> : null}
      </div>
    </div>
  );
}
