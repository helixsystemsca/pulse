"use client";

/**
 * Persistent tenant-shell warning while a system administrator is impersonating a company user.
 * Exit restores the system-admin token and returns to `/system`.
 * Hidden while the system-admin modal preview is active (in-memory overlay token).
 */
import { UserRoundCog } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { getApiBaseUrl, refreshSessionWithToken } from "@/lib/api";
import { usePulseAuth } from "@/hooks/usePulseAuth";
import { getImpersonationOverlayAccessToken } from "@/lib/impersonation-overlay-token";
import { readSession } from "@/lib/pulse-session";

export function ImpersonationBanner() {
  const { session, refresh } = usePulseAuth();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [overlayPreview, setOverlayPreview] = useState(false);

  useEffect(() => {
    const sync = () => setOverlayPreview(Boolean(getImpersonationOverlayAccessToken()));
    sync();
    window.addEventListener("pulse-impersonation-overlay", sync);
    return () => window.removeEventListener("pulse-impersonation-overlay", sync);
  }, []);

  const exitImpersonation = useCallback(async () => {
    const s = readSession();
    if (!s?.access_token) return;
    setBusy(true);
    try {
      const base = getApiBaseUrl();
      if (!base) return;
      const res = await fetch(`${base}/api/v1/auth/impersonation/exit`, {
        method: "POST",
        headers: { Authorization: `Bearer ${s.access_token}` },
      });
      if (!res.ok) return;
      const data = (await res.json()) as { access_token: string };
      await refreshSessionWithToken(data.access_token, s.remember);
      refresh();
      router.push("/system");
    } finally {
      setBusy(false);
    }
  }, [refresh, router]);

  if (overlayPreview || !session?.is_impersonating) return null;

  const label = session.full_name?.trim() || session.email;

  return (
    <div
      className="sticky top-16 z-[55] flex flex-wrap items-center justify-between gap-3 border-b border-amber-500/45 bg-amber-50 px-3 py-2.5 text-sm text-amber-950 shadow-sm dark:border-amber-500/35 dark:bg-amber-950/95 dark:text-amber-100 dark:shadow-[0_2px_12px_rgba(0,0,0,0.35)] sm:px-5"
      role="status"
      aria-live="polite"
    >
      <div className="flex min-w-0 items-start gap-2.5 sm:items-center">
        <UserRoundCog className="mt-0.5 h-4 w-4 shrink-0 opacity-90 sm:mt-0" aria-hidden />
        <div className="min-w-0 leading-snug">
          <p className="font-semibold">Impersonation mode</p>
          <p className="mt-0.5 text-xs opacity-90 sm:text-sm">
            You are viewing Pulse as <span className="font-medium">{label}</span>
            {session.email && label !== session.email ? (
              <span className="text-amber-800/90 dark:text-amber-200/90"> ({session.email})</span>
            ) : null}
            . This is not a normal tenant login. Exit when finished so you return to system administration. Impersonation
            start and end are recorded in system logs for traceability.
          </p>
        </div>
      </div>
      <button
        type="button"
        disabled={busy}
        onClick={() => void exitImpersonation()}
        className="shrink-0 rounded-lg bg-amber-800 px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-amber-900 disabled:opacity-60 dark:bg-amber-600 dark:hover:bg-amber-500"
      >
        {busy ? "Exiting…" : "Exit impersonation"}
      </button>
    </div>
  );
}
