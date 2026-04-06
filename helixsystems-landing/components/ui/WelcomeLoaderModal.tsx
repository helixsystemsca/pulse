"use client";

/**
 * Full-screen welcome overlay after sign-in: glass system-widget style with calm progress + status.
 * Shown at most once per browser tab session (`sessionStorage`), so refreshes skip the animation.
 */

import { AnimatePresence, motion } from "framer-motion";
import { Activity, AlertCircle, AlertTriangle, Check } from "lucide-react";
import { useEffect, useRef, useState } from "react";
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

/** Minimum counts to swap the time-of-day line for alert-aware copy. */
const CRITICAL_GREETING_THRESHOLD = 1;
const WARNING_GREETING_THRESHOLD = 1;

const criticalMessages = [
  "A few things need you sooner than later",
  "Operations pinged — worth a quick sweep",
  "We’ve got some red on the board — let’s triage",
  "Heads up: a couple of urgent items are waving",
];

const warningMessages = [
  "Nothing scary — just a few yellow flags up",
  "Mostly calm, with a little nudge from alerts",
  "A gentle tap from ops — worth a peek",
  "Light housekeeping on the board today",
];

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

function pickContextGreeting(criticalCount: number, warningCount: number): string {
  if (criticalCount >= CRITICAL_GREETING_THRESHOLD) {
    return criticalMessages[Math.floor(Math.random() * criticalMessages.length)] ?? timeOfDayGreeting();
  }
  if (warningCount >= WARNING_GREETING_THRESHOLD) {
    return warningMessages[Math.floor(Math.random() * warningMessages.length)] ?? timeOfDayGreeting();
  }
  return timeOfDayGreeting();
}

function MiniDotLoader() {
  return (
    <div className="flex shrink-0 items-center gap-1 pt-0.5" aria-hidden>
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="h-1.5 w-1.5 rounded-full bg-slate-600/70 dark:bg-white/45"
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
  const [headlineGreeting, setHeadlineGreeting] = useState("");
  const greetingPickedRef = useRef(false);

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
    if (!hydrated || skipEntirely || !isReady) return;

    if (!greetingPickedRef.current) {
      greetingPickedRef.current = true;
      setHeadlineGreeting(pickContextGreeting(criticalCount, warningCount));
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
  }, [hydrated, isReady, skipEntirely, storageKey, criticalCount, warningCount]);

  if (!hydrated || skipEntirely) {
    return null;
  }

  const firstName = firstNameOnly(userName);
  const greeting = headlineGreeting || timeOfDayGreeting();
  const phase = content;
  const status = statusForPhase(phase, criticalCount, warningCount);

  const statusRowClass =
    status.kind === "critical"
      ? "text-red-400/95"
      : status.kind === "warning"
        ? "text-amber-300/95"
        : status.kind === "loading"
          ? "text-slate-500 dark:text-white/45"
          : "text-emerald-400/90";

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          key="welcome-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="welcome-loader-title"
          aria-busy={content === "loading"}
          className="pointer-events-none fixed inset-0 z-[200] flex items-center justify-center p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: EXIT_MS / 1000, ease: [0.4, 0, 0.2, 1] }}
        >
          {/* Dimmed canvas — gradient, not solid black */}
          <div
            className="pointer-events-none absolute inset-0 bg-gradient-to-br from-slate-900/50 via-slate-800/35 to-slate-950/45 backdrop-blur-[3px] dark:from-slate-950/45 dark:via-slate-900/40 dark:to-slate-950/50"
            aria-hidden
          />

          <motion.div
            layout
            className="pointer-events-none relative w-full max-w-md rounded-[24px] border border-white/[0.15] bg-white/[0.08] px-7 py-7 shadow-[0_10px_40px_rgba(0,0,0,0.25)] backdrop-blur-xl dark:bg-[rgba(18,24,33,0.7)] dark:backdrop-blur-2xl sm:px-8 sm:py-8"
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: 4 }}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
          >
            <div
              className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent dark:via-white/15"
              aria-hidden
            />

            <div className="flex gap-4">
              <div
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/15 bg-white/[0.06] dark:bg-white/[0.05]"
                aria-hidden
              >
                <Activity
                  className="h-5 w-5 text-slate-700/90 dark:text-white/80"
                  strokeWidth={1.75}
                />
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
                        className="font-headline text-[15px] font-semibold leading-snug tracking-tight text-slate-800/95 dark:text-white/[0.92] sm:text-base"
                      >
                        Preparing your workspace…
                      </p>
                      <p className="mt-1 text-xs font-normal leading-relaxed text-slate-600/90 dark:text-white/50">
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
                        className="font-headline text-[17px] font-semibold leading-snug tracking-tight text-slate-800/95 dark:text-white/[0.92] sm:text-lg"
                      >
                        {greeting}, {firstName}
                      </h2>
                      <p className="mt-1.5 font-headline text-sm font-medium text-slate-700/90 dark:text-white/70">
                        Let&apos;s get to work!
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <MiniDotLoader />
            </div>

            <div className="mt-6">
              <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-slate-500/80 dark:text-white/40">
                {content === "loading" ? "Loading" : "Ready"}
              </p>
              <div className="h-1 overflow-hidden rounded-full bg-black/[0.08] dark:bg-white/10">
                <motion.div
                  className="h-full rounded-full bg-gradient-to-r from-cyan-400/55 via-teal-500/45 to-teal-400/50 dark:from-cyan-400/50 dark:via-teal-500/40 dark:to-cyan-500/45"
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
              className={`mt-5 flex items-start gap-2 text-left text-xs font-medium leading-relaxed ${statusRowClass}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.12, duration: 0.35 }}
            >
              {status.kind === "critical" ? (
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 opacity-90" strokeWidth={2} aria-hidden />
              ) : status.kind === "warning" ? (
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 opacity-90" strokeWidth={2} aria-hidden />
              ) : status.kind === "loading" ? (
                <motion.span
                  className="mt-0.5 block h-3.5 w-3.5 shrink-0 rounded-full border-2 border-slate-400/45 border-t-slate-700/80 dark:border-white/25 dark:border-t-white/70"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1.8, repeat: Infinity, ease: "linear" }}
                  aria-hidden
                />
              ) : (
                <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 opacity-90" strokeWidth={2.5} aria-hidden />
              )}
              <span>{status.message}</span>
            </motion.div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
