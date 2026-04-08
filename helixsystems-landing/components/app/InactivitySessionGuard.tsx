"use client";

/**
 * Logs the user out after a period of no pointer/keyboard/scroll activity.
 * Shows a warning shortly before logout so they can reset the idle clock.
 */
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { usePulseAuth } from "@/hooks/usePulseAuth";
import { navigateToPulseLogin } from "@/lib/pulse-app";
import { clearSession } from "@/lib/pulse-session";

const THROTTLE_MS = 1000;
const IDLE_MS = 10 * 60 * 1000;
const WARNING_MS = 9 * 60 * 1000;

const PUBLIC_PATH_PREFIXES = ["/login", "/invite", "/reset-password"];

function isPublicPath(pathname: string | null): boolean {
  if (!pathname) return true;
  return PUBLIC_PATH_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export function InactivitySessionGuard() {
  const pathname = usePathname();
  const { authed } = usePulseAuth();
  const [warningOpen, setWarningOpen] = useState(false);
  const warnTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastThrottleRef = useRef(0);

  const clearTimers = useCallback(() => {
    if (warnTimerRef.current != null) {
      clearTimeout(warnTimerRef.current);
      warnTimerRef.current = null;
    }
    if (idleTimerRef.current != null) {
      clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
    }
  }, []);

  const performLogout = useCallback(() => {
    clearTimers();
    setWarningOpen(false);
    clearSession();
    navigateToPulseLogin();
  }, [clearTimers]);

  const armTimers = useCallback(() => {
    clearTimers();
    setWarningOpen(false);
    warnTimerRef.current = setTimeout(() => {
      setWarningOpen(true);
    }, WARNING_MS);
    idleTimerRef.current = setTimeout(() => {
      performLogout();
    }, IDLE_MS);
  }, [clearTimers, performLogout]);

  const onActivity = useCallback(() => {
    const now = Date.now();
    if (now - lastThrottleRef.current < THROTTLE_MS) return;
    lastThrottleRef.current = now;
    armTimers();
  }, [armTimers]);

  useEffect(() => {
    if (!authed || isPublicPath(pathname)) {
      clearTimers();
      setWarningOpen(false);
      return;
    }

    armTimers();

    window.addEventListener("mousemove", onActivity);
    window.addEventListener("keydown", onActivity);
    window.addEventListener("click", onActivity);
    window.addEventListener("scroll", onActivity, { passive: true });
    window.addEventListener("touchstart", onActivity, { passive: true });

    return () => {
      clearTimers();
      window.removeEventListener("mousemove", onActivity);
      window.removeEventListener("keydown", onActivity);
      window.removeEventListener("click", onActivity);
      window.removeEventListener("scroll", onActivity);
      window.removeEventListener("touchstart", onActivity);
    };
  }, [authed, pathname, armTimers, onActivity, clearTimers]);

  const stayLoggedIn = useCallback(() => {
    onActivity();
  }, [onActivity]);

  if (!warningOpen) return null;

  return (
    <div
      className="ds-modal-backdrop fixed inset-0 z-[100] flex items-center justify-center p-4 backdrop-blur-[2px]"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="inactivity-warning-title"
      aria-describedby="inactivity-warning-desc"
    >
      <div className="w-full max-w-md rounded-md border border-slate-200 bg-white p-6 shadow-xl">
        <h2 id="inactivity-warning-title" className="font-headline text-lg font-bold text-pulse-navy">
          Session expiring soon
        </h2>
        <p id="inactivity-warning-desc" className="mt-2 text-sm leading-relaxed text-pulse-muted">
          You will be signed out shortly due to inactivity. Choose <strong className="font-semibold text-pulse-navy">Stay signed in</strong> to continue your session, or sign out now.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={stayLoggedIn}
            className="rounded-md bg-pulse-accent px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-pulse-accent-hover"
          >
            Stay signed in
          </button>
          <button
            type="button"
            onClick={performLogout}
            className="rounded-md border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-pulse-navy hover:bg-slate-50"
          >
            Sign out now
          </button>
        </div>
      </div>
    </div>
  );
}
