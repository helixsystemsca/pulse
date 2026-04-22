"use client";

/**
 * Full-screen welcome overlay after sign-in: centered, minimal loading card + pulse animation.
 * Shown at most once per browser tab session (`sessionStorage`), so refreshes skip the animation.
 */

import { AnimatePresence, motion } from "framer-motion";
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

/** How long the pulse/“preparing” state runs before the personalized line appears. */
const LOADING_PHASE_MS = 2200;
/** How long the personalized welcome is visible before the overlay dismisses. */
const WELCOME_PHASE_MS = 2000;
const EXIT_MS = 250;

type WelcomePhase = "loading" | "welcome";

function firstNameOnly(displayName: string): string {
  const t = displayName.trim();
  if (!t) return "there";
  const part = t.split(/\s+/)[0] ?? t;
  return part.replace(/[.,:;!?$]+$/, "");
}

function timeOfDayGreeting(): string {
  const h = new Date().getHours();
  if (h < 5) return "Good evening";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function PulseLine() {
  return (
    <svg
      width="96"
      height="24"
      viewBox="0 0 96 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="block"
      aria-hidden
    >
      <defs>
        <linearGradient id="pulseStroke" x1="0" y1="0" x2="96" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#36F1CD" stopOpacity="0.1" />
          <stop offset="0.45" stopColor="#36F1CD" stopOpacity="1" />
          <stop offset="1" stopColor="#36F1CD" stopOpacity="0.1" />
        </linearGradient>
        <filter id="pulseGlow" x="-20%" y="-100%" width="140%" height="300%">
          <feGaussianBlur stdDeviation="1.6" result="blur" />
          <feColorMatrix
            in="blur"
            type="matrix"
            values="0 0 0 0 0.21  0 0 0 0 0.95  0 0 0 0 0.80  0 0 0 0.55 0"
          />
          <feMerge>
            <feMergeNode />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <motion.path
        d="M3 12 H24 L30 12 L34 6 L38 20 L42 10 L46 12 H93"
        stroke="url(#pulseStroke)"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        filter="url(#pulseGlow)"
        strokeDasharray="120"
        strokeDashoffset="120"
        animate={{ strokeDashoffset: [120, 0, -40] }}
        transition={{ duration: 1.25, repeat: Infinity, ease: "easeInOut" }}
      />
    </svg>
  );
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
  const [phase, setPhase] = useState<WelcomePhase>("loading");
  const loadingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const welcomeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  // After the dashboard is ready: show the loading/pulse state, then switch to personalized welcome.
  useEffect(() => {
    if (!hydrated || skipEntirely || !isReady) return;
    if (loadingTimerRef.current) clearTimeout(loadingTimerRef.current);
    setPhase("loading");
    loadingTimerRef.current = setTimeout(() => {
      setPhase("welcome");
    }, LOADING_PHASE_MS);
    return () => {
      if (loadingTimerRef.current) clearTimeout(loadingTimerRef.current);
      loadingTimerRef.current = null;
    };
  }, [hydrated, isReady, skipEntirely]);

  // After the welcome line is shown, dismiss and mark session so we do not show again.
  useEffect(() => {
    if (!hydrated || skipEntirely || !isReady || phase !== "welcome") return;
    if (welcomeTimerRef.current) clearTimeout(welcomeTimerRef.current);
    welcomeTimerRef.current = setTimeout(() => {
      try {
        sessionStorage.setItem(storageKey, "true");
      } catch {
        /* ignore */
      }
      setOpen(false);
    }, WELCOME_PHASE_MS);
    return () => {
      if (welcomeTimerRef.current) clearTimeout(welcomeTimerRef.current);
      welcomeTimerRef.current = null;
    };
  }, [hydrated, isReady, skipEntirely, storageKey, phase]);

  if (!hydrated || skipEntirely) {
    return null;
  }

  const first = firstNameOnly(userName);
  const welcomeLine = `${timeOfDayGreeting()}, ${first}`;
  const welcomeSub = "You’re all set to jump back in.";

  void criticalCount;
  void warningCount;

  const overlay = (
    <AnimatePresence>
      {open ? (
        <motion.div
          key="welcome-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="welcome-loader-title"
          aria-busy={phase === "loading"}
          className="pointer-events-none fixed inset-0 z-[200]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: EXIT_MS / 1000, ease: [0.4, 0, 0.2, 1] }}
        >
          <div
            className="pointer-events-none absolute inset-0 z-0"
            style={{
              background: "linear-gradient(180deg, #f1f5f9 0%, #eaf1fb 60%, #eef2f7 100%)",
            }}
            aria-hidden
          />

          <div className="pointer-events-none absolute inset-0 z-[1] flex min-h-[100dvh] items-center justify-center p-6">
            <motion.div
              className="pointer-events-none w-full max-w-2xl rounded-[22px] border border-[rgba(76,96,133,0.18)] bg-[#f8fafc] px-10 py-12 text-center shadow-[0_20px_55px_rgba(76,96,133,0.14)] sm:px-14 sm:py-14"
              initial={{ opacity: 0, scale: 0.985, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.99, y: 6 }}
              transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
            >
              <div
                className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-[rgba(54,241,205,0.25)] bg-[linear-gradient(145deg,rgba(54,241,205,0.22)_0%,rgba(76,96,133,0.18)_45%,rgba(53,71,102,0.10)_100%)] shadow-[0_10px_26px_rgba(76,96,133,0.16)]"
                aria-hidden
              >
                <svg width="34" height="34" viewBox="0 0 34 34" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect x="1" y="1" width="32" height="32" rx="10" stroke="rgba(255,255,255,0.55)" />
                  <path
                    d="M6 17 H12 L14.5 12 L18 22 L20.5 15.5 L22.5 17 H28"
                    stroke="#36F1CD"
                    strokeWidth="2.4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>

              {phase === "loading" ? (
                <>
                  <h1
                    id="welcome-loader-title"
                    className="mt-8 font-headline text-2xl font-extrabold tracking-tight text-[#1f2a44] sm:text-3xl"
                  >
                    Preparing your workspace...
                  </h1>
                  <p className="mt-2 text-sm font-medium text-[#51647a] sm:text-base">
                    Gathering the latest from your operation
                  </p>

                  <motion.div
                    className="mt-8 flex justify-center"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.12, duration: 0.35 }}
                  >
                    <PulseLine />
                  </motion.div>
                </>
              ) : (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                >
                  <h1
                    id="welcome-loader-title"
                    className="mt-8 font-headline text-2xl font-extrabold tracking-tight text-[#1f2a44] sm:text-3xl"
                  >
                    {welcomeLine}
                  </h1>
                  <p className="mt-2 text-sm font-medium text-[#51647a] sm:text-base">
                    {welcomeSub}
                  </p>
                </motion.div>
              )}
            </motion.div>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );

  return createPortal(overlay, document.body);
}
