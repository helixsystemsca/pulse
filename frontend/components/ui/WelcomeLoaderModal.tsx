"use client";

/**
 * Full-screen welcome overlay after sign-in: matches web login canvas + frosted card, with calm progress + status.
 * Shown at most once per browser tab session (`sessionStorage`), so refreshes skip the animation.
 */

import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, AlertTriangle, Check } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { PULSE_WELCOME_SESSION_KEY } from "@/lib/pulse-session";

/** @deprecated Use `PULSE_WELCOME_SESSION_KEY` from `@/lib/pulse-session`. */
export const WELCOME_SESSION_STORAGE_KEY = PULSE_WELCOME_SESSION_KEY;

export type WelcomeLoaderModalProps = {
  userName: string;
  /** Flip to true when critical dashboard / route data has finished loading. */
  isReady: boolean;
  /** High-severity alert count from ops context (e.g. dashboard). */
  criticalCount?: number;
  /** Medium-severity alert count from ops context. */
  warningCount?: number;
  /** Override session key if needed (default matches product brief). */
  storageKey?: string;
};

const WELCOME_HOLD_MS = 4000;
const EXIT_MS = 300;

/** Minimum counts for alert-aware status row copy. */
const CRITICAL_GREETING_THRESHOLD = 1;
const WARNING_GREETING_THRESHOLD = 1;

type WelcomeTimeBand = "morning" | "afternoon" | "evening";

function welcomeTimeBand(date = new Date()): WelcomeTimeBand {
  const h = date.getHours();
  if (h < 12) return "morning";
  if (h < 17) return "afternoon";
  return "evening";
}

/** Short second-line copy under the time-based greeting; tone leans by local time of day. */
const welcomeMessages: Record<WelcomeTimeBand, readonly string[]> = {
  morning: [
    "Let's make today count.",
    "Focus mode: on.",
    "You've got momentum—keep it going.",
    "Let's get after it.",
    "Today's a good day to win.",
    "Let's build something great.",
    "Another step forward.",
    "Locked in.",
  ],
  afternoon: [
    "You're in control today.",
    "Small wins add up.",
    "Let's build something great.",
    "Progress over perfection.",
    "Execute with intent.",
    "Stay sharp.",
    "Make it happen.",
    "Keep pushing forward.",
    "Locked in.",
    "Focus mode: on.",
  ],
  evening: [
    "Progress over perfection.",
    "Another step forward.",
    "Small wins add up.",
    "Keep pushing forward.",
    "You're in control today.",
    "Let's build something great.",
  ],
};

export function pickWelcomeMessage(date = new Date()): string {
  const band = welcomeTimeBand(date);
  const list = welcomeMessages[band];
  const i = Math.floor(Math.random() * list.length);
  return list[i] ?? "Let's make today count.";
}

function firstNameOnly(displayName: string): string {
  const t = displayName.trim();
  if (!t) return "there";
  return t.split(/\s+/)[0] ?? t;
}

/** Local time-of-day line for the welcome overlay (not UTC). */
export function timeOfDayGreeting(date = new Date()): string {
  const h = date.getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function WelcomeRipples() {
  const rings = [520, 640, 760, 880, 1000, 1120];
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {rings.map((size, i) => (
        <div
          key={size}
          className="absolute left-1/2 top-[22%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-[color-mix(in_srgb,var(--ds-text-primary)_8%,transparent)] dark:border-white/10"
          style={{
            width: size,
            height: size,
            opacity: 0.22 - i * 0.025,
          }}
        />
      ))}
    </div>
  );
}

function MiniDotLoader() {
  return (
    <div className="flex shrink-0 items-center gap-1.5" aria-hidden>
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="h-2 w-2 rounded-full bg-[color-mix(in_srgb,#4c6085_35%,transparent)] dark:bg-ds-muted/70"
          animate={{ opacity: [0.25, 0.95, 0.25], scale: [0.92, 1, 0.92] }}
          transition={{
            duration: 1.4,
            repeat: Infinity,
            delay: i * 0.2,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
}

type StatusKind = "ok" | "warning" | "critical" | "loading";

function statusForPhase(
  phase: "loading" | "ready",
  criticalCount: number,
  warningCount: number,
): { kind: StatusKind; message: string } {
  if (phase === "loading") {
    return { kind: "loading", message: "Connecting to your workspace…" };
  }
  if (criticalCount >= CRITICAL_GREETING_THRESHOLD) {
    return {
      kind: "critical",
      message: "Some items need attention before you dive in",
    };
  }
  if (warningCount >= WARNING_GREETING_THRESHOLD) {
    return {
      kind: "warning",
      message: "A few alerts are worth a quick look",
    };
  }
  return { kind: "ok", message: "All systems running smoothly" };
}

export function WelcomeLoaderModal({
  userName,
  isReady,
  criticalCount = 0,
  warningCount = 0,
  storageKey = PULSE_WELCOME_SESSION_KEY,
}: WelcomeLoaderModalProps) {
  const [hydrated, setHydrated] = useState(false);
  const [skipEntirely, setSkipEntirely] = useState(false);
  const [open, setOpen] = useState(true);
  const [content, setContent] = useState<"loading" | "ready">("loading");
  const [welcomeSubline, setWelcomeSubline] = useState("");
  const welcomeLinePickedRef = useRef(false);

  useEffect(() => {
    setHydrated(true);
    try {
      if (sessionStorage.getItem(storageKey) === "true") {
        setSkipEntirely(true);
        setOpen(false);
      }
    } catch {
      /* private mode or storage blocked — still show welcome once */
    }
  }, [storageKey]);

  useEffect(() => {
    if (!hydrated || skipEntirely) return;
    const root = document.documentElement;
    if (open) root.classList.add("pulse-welcome-blur");
    return () => root.classList.remove("pulse-welcome-blur");
  }, [hydrated, open, skipEntirely]);

  useEffect(() => {
    if (!hydrated || skipEntirely || !isReady) return;

    if (!welcomeLinePickedRef.current) {
      welcomeLinePickedRef.current = true;
      setWelcomeSubline(pickWelcomeMessage());
    }

    setContent("ready");
    const t = setTimeout(() => {
      try {
        sessionStorage.setItem(storageKey, "true");
      } catch {
        /* ignore */
      }
      setOpen(false);
    }, WELCOME_HOLD_MS);

    return () => clearTimeout(t);
  }, [hydrated, isReady, skipEntirely, storageKey]);

  if (!hydrated || skipEntirely) {
    return null;
  }

  const firstName = firstNameOnly(userName);
  const greeting = timeOfDayGreeting();
  const phase = content;
  const status = statusForPhase(phase, criticalCount, warningCount);

  /** Severity tint on the icon only; body copy stays neutral like the rest of the card. */
  const statusIconClass =
    status.kind === "critical"
      ? "text-ds-danger"
      : status.kind === "warning"
        ? "text-ds-warning"
        : status.kind === "loading"
          ? "text-ds-muted"
          : "text-ds-success";

  const overlay = (
    <AnimatePresence>
      {open ? (
        <motion.div
          key="welcome-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="welcome-loader-title"
          aria-busy={content === "loading"}
          className="pointer-events-none fixed inset-0 z-[200] min-h-0 min-w-0"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: EXIT_MS / 1000, ease: [0.4, 0, 0.2, 1] }}
        >
          {/* Full-bleed canvas (separate from flex centering layer below). */}
          <div
            className="auth-background login-web-canvas pointer-events-none absolute inset-0 z-0 min-h-[100dvh] min-w-0"
            aria-hidden
          >
            <div className="auth-shell-inner relative h-full min-h-[100dvh] min-w-0 w-full">
              <WelcomeRipples />
            </div>
          </div>

          {/* Dedicated centering layer: only the card participates in flex layout. */}
          <div className="pointer-events-none absolute inset-0 z-[1] flex min-h-[100dvh] min-w-0 items-center justify-center p-5 sm:p-8">
            <motion.div
              className="pointer-events-none relative w-full max-w-xl shrink-0 rounded-[1.35rem] bg-[linear-gradient(180deg,rgba(207,231,255,0.85)_0%,rgba(230,236,245,0.55)_100%)] p-[1px] shadow-[0_20px_50px_rgba(76,96,133,0.12)] dark:bg-ds-border dark:p-px dark:shadow-[0_16px_40px_rgba(0,0,0,0.25)]"
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98, y: 4 }}
              transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="rounded-[1.3rem] border border-white/80 bg-white px-7 py-8 text-ds-foreground dark:border-ds-border dark:bg-ds-surface-primary sm:px-9 sm:py-9">
                <div className="flex items-center gap-5">
                  <div
                    className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-[color-mix(in_srgb,#4c6085_18%,transparent)] bg-white shadow-sm dark:border-ds-border dark:bg-ds-secondary"
                    aria-hidden
                  >
                    <img src="/images/pulse-mark.svg" width={56} height={56} alt="" className="h-14 w-14" />
                  </div>

                  <div className="min-w-0 flex-1 text-left">
                    <AnimatePresence mode="wait" initial={false}>
                      {content === "loading" ? (
                        <motion.div
                          key="loading-copy"
                          initial={{ opacity: 0, y: 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -3 }}
                          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                        >
                          <p
                            id="welcome-loader-title"
                            className="font-headline text-base font-extrabold leading-snug tracking-tight text-[#3f5274] dark:text-ds-foreground sm:text-lg"
                          >
                            Preparing your workspace…
                          </p>
                          <p className="mt-1.5 text-sm font-medium leading-relaxed text-[#5a6d82] dark:text-ds-muted sm:text-[15px]">
                            Gathering the latest from your operation
                          </p>
                        </motion.div>
                      ) : (
                        <motion.div
                          key="ready-copy"
                          initial={{ opacity: 0, y: 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -3 }}
                          transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
                        >
                          <h2
                            id="welcome-loader-title"
                            className="font-headline text-xl font-extrabold leading-snug tracking-tight text-[#2f3d52] dark:text-ds-foreground sm:text-2xl"
                          >
                            {greeting}, {firstName}
                          </h2>
                          <p className="mt-2 font-headline text-base font-medium text-[#5a6d82] dark:text-ds-muted sm:text-[17px]">
                            {welcomeSubline || "Let's make today count."}
                          </p>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  <MiniDotLoader />
                </div>

                <div className="mt-8">
                  <p className="mb-2.5 text-[11px] font-bold uppercase tracking-[0.14em] text-[color-mix(in_srgb,var(--ds-text-primary)_72%,transparent)] dark:text-ds-muted sm:text-xs">
                    {content === "loading" ? "Loading" : "Ready"}
                  </p>
                  <div className="h-1.5 overflow-hidden rounded-full bg-[color-mix(in_srgb,#4c6085_12%,transparent)] dark:bg-white/15">
                    <motion.div
                      className="h-full rounded-full bg-[#4c6085] dark:bg-[#556b8e]"
                      initial={false}
                      animate={
                        content === "loading"
                          ? { width: ["30%", "68%", "38%", "62%", "30%"] }
                          : { width: "100%" }
                      }
                      transition={
                        content === "loading"
                          ? {
                              duration: 4.2,
                              repeat: Infinity,
                              ease: [0.45, 0, 0.55, 1],
                            }
                          : {
                              duration: 0.9,
                              ease: [0.22, 1, 0.36, 1],
                            }
                      }
                      style={{ originX: 0 }}
                    />
                  </div>
                </div>

                <motion.div
                  className="mt-6 flex items-start gap-2.5 text-left text-sm font-medium leading-relaxed text-[#5a6d82] dark:text-ds-muted"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.12, duration: 0.35 }}
                >
                  {status.kind === "critical" ? (
                    <AlertTriangle
                      className={`mt-0.5 h-4 w-4 shrink-0 opacity-90 ${statusIconClass}`}
                      strokeWidth={2}
                      aria-hidden
                    />
                  ) : status.kind === "warning" ? (
                    <AlertCircle
                      className={`mt-0.5 h-4 w-4 shrink-0 opacity-90 ${statusIconClass}`}
                      strokeWidth={2}
                      aria-hidden
                    />
                  ) : status.kind === "loading" ? (
                    <motion.span
                      className="mt-0.5 block h-4 w-4 shrink-0 rounded-full border-2 border-[color-mix(in_srgb,#4c6085_22%,transparent)] border-t-[#4c6085] dark:border-ds-border dark:border-t-[color-mix(in_srgb,var(--ds-text-primary)_70%,transparent)]"
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1.8, repeat: Infinity, ease: "linear" }}
                      aria-hidden
                    />
                  ) : (
                    <Check
                      className={`mt-0.5 h-4 w-4 shrink-0 opacity-90 ${statusIconClass}`}
                      strokeWidth={2.5}
                      aria-hidden
                    />
                  )}
                  <span>{status.message}</span>
                </motion.div>
              </div>
            </motion.div>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );

  return createPortal(overlay, document.body);
}
