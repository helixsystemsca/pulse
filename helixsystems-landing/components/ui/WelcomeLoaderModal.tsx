"use client";

/**
 * Full-screen welcome overlay after sign-in: engine warm-up copy + loader, then personalized welcome.
 * Shown at most once per browser tab session (`sessionStorage`), so refreshes skip the animation.
 */

import { AnimatePresence, motion } from "framer-motion";
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
          <div
            className="pointer-events-none absolute inset-0 bg-slate-900/25 backdrop-blur-[2px]"
            aria-hidden
          />

          <motion.div
            layout
            className="pointer-events-none relative w-full max-w-md rounded-2xl border border-pulse-border bg-white px-8 py-10 shadow-card-lg"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          >
            <div
              className="pointer-events-none absolute left-0 top-0 h-1 w-full rounded-t-2xl bg-gradient-to-r from-pulse-accent/80 via-pulse-accent to-helix-primary/70"
              aria-hidden
            />

            <AnimatePresence mode="wait" initial={false}>
              {content === "loading" ? (
                <motion.div
                  key="loading"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.25 }}
                  className="flex flex-col items-center text-center"
                >
                  <h2
                    id="welcome-loader-title"
                    className="font-headline text-xl font-semibold tracking-tight text-pulse-navy sm:text-2xl"
                  >
                    Firing up the engine
                  </h2>
                  <p className="mt-2 text-sm text-pulse-muted">Just a moment…</p>

                  <div className="mt-8 flex items-center gap-1.5" aria-hidden>
                    {[0, 1, 2].map((i) => (
                      <motion.span
                        key={i}
                        className="h-2 w-2 rounded-full bg-pulse-accent"
                        animate={{ opacity: [0.35, 1, 0.35], y: [0, -4, 0] }}
                        transition={{
                          duration: 0.9,
                          repeat: Infinity,
                          delay: i * 0.18,
                          ease: "easeInOut",
                        }}
                      />
                    ))}
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="ready"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.28 }}
                  className="flex flex-col items-center text-center"
                >
                  <h2
                    id="welcome-loader-title"
                    className="font-headline text-xl font-semibold tracking-tight text-pulse-navy sm:text-2xl dark:text-slate-100"
                  >
                    {greeting}, {firstName}
                  </h2>
                  <p className="mt-3 font-headline text-lg font-semibold text-pulse-navy sm:text-xl dark:text-slate-200">
                    Let&apos;s get to work
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
