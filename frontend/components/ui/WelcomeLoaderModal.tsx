"use client";

/**
 * Full-screen welcome overlay after sign-in: centered card, tenant/platform mark, and a slim progress bar.
 * Shown at most once per browser tab session (`sessionStorage`), so refreshes skip the animation.
 */

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CinematicLogoImage } from "@/components/branding/CinematicLogoImage";
import { usePulseAuth } from "@/hooks/usePulseAuth";
import { resolveAuthModalBrand } from "@/lib/branding/auth-brand";
import { cn } from "@/lib/cn";
import {
  dispatchWelcomeOverlayClosed,
  isWelcomeOverlayDismissed,
  markWelcomeOverlayDismissed,
  PULSE_WELCOME_SESSION_KEY,
} from "@/lib/pulse-session";

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
  /** Fires once after the personalized welcome line has been shown and the overlay closes normally. */
  onWelcomeComplete?: () => void;
};

/** Minimum time the loader is visible (fast API / warm Render otherwise flashes past). */
const MIN_LOADER_DISPLAY_MS = 5000;
/** Minimum time after `isReady` before the personalized line (so “preparing” never feels instant). */
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

/** Determinate bar under the copy (CSS sheen; static under reduced motion). */
function WorkspaceProgressBar({ progress }: { progress: number }) {
  const p = Math.max(0, Math.min(100, progress));
  return (
    <div
      className="mx-auto mt-5 w-[min(14.5rem,calc(100%-0.5rem))]"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(p)}
      aria-label="Loading your workspace"
    >
      <div className="relative h-1.5 overflow-hidden rounded-full bg-[rgba(76,96,133,0.2)]">
        <div
          className="h-full min-w-[12%] rounded-full motion-safe:transition-[width] motion-safe:duration-200 motion-safe:ease-out"
          style={{
            width: `${Math.max(12, p)}%`,
            background:
              "linear-gradient(90deg, #2c3a55 0%, #0ea5e9 55%, #1ea896 100%)",
          }}
        />
        <span
          className="pointer-events-none absolute inset-y-0 left-0 w-[38%] bg-gradient-to-r from-transparent via-white/65 to-transparent motion-safe:animate-welcome-progress-sheen motion-reduce:hidden"
          aria-hidden
        />
      </div>
    </div>
  );
}

export function WelcomeLoaderModal({
  userName,
  isReady,
  criticalCount = 0,
  warningCount = 0,
  storageKey = PULSE_WELCOME_SESSION_KEY,
  onWelcomeComplete,
}: WelcomeLoaderModalProps) {
  const { session } = usePulseAuth();
  const dismissedOnMount = isWelcomeOverlayDismissed(storageKey);
  const [hydrated, setHydrated] = useState(false);
  const [skipEntirely, setSkipEntirely] = useState(dismissedOnMount);
  const [open, setOpen] = useState(!dismissedOnMount);
  const [phase, setPhase] = useState<WelcomePhase>("loading");
  /** 0–100: progress bar fills left-to-right while preparing; completes when data is ready. */
  const [loadProgress, setLoadProgress] = useState(0);
  const loadingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const welcomeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** When the overlay first shows the loader for this visit (for minimum display duration). */
  const loaderSessionStartRef = useRef<number | null>(null);
  const isReadyForLoaderRef = useRef(isReady);
  /** True once this mount actually displayed the overlay (used to persist on early navigation). */
  const overlayVisitedRef = useRef(false);
  isReadyForLoaderRef.current = isReady;

  useEffect(() => {
    setHydrated(true);
    if (dismissedOnMount) {
      dispatchWelcomeOverlayClosed();
    }
  }, [dismissedOnMount]);

  useEffect(() => {
    if (open) overlayVisitedRef.current = true;
  }, [open]);

  useEffect(() => {
    return () => {
      if (overlayVisitedRef.current && !isWelcomeOverlayDismissed(storageKey)) {
        markWelcomeOverlayDismissed(storageKey);
      }
    };
  }, [storageKey]);

  useEffect(() => {
    if (!hydrated || skipEntirely) return;
    const root = document.documentElement;
    if (open) root.classList.add("pulse-welcome-blur");
    return () => root.classList.remove("pulse-welcome-blur");
  }, [hydrated, open, skipEntirely]);

  useEffect(() => {
    if (!hydrated || skipEntirely || !open) return;
    if (loaderSessionStartRef.current === null) {
      loaderSessionStartRef.current = Date.now();
    }
  }, [hydrated, skipEntirely, open]);

  // Progress fill: eases toward a cap while waiting, then runs to 100% once `isReady` (ref avoids resetting elapsed).
  useEffect(() => {
    if (!hydrated || skipEntirely || !open || phase !== "loading") return;
    const start = Date.now();
    const tick = () => {
      const elapsed = Date.now() - start;
      const ready = isReadyForLoaderRef.current;
      setLoadProgress((prev) => {
        if (ready) {
          const n = prev + (100 - prev) * 0.22 + 0.35;
          return n >= 99.85 ? 100 : n;
        }
        const cap = 88;
        const eased = cap * (1 - Math.exp(-elapsed / 4200));
        return Math.max(prev, Math.min(cap, eased));
      });
    };
    const id = window.setInterval(tick, 48);
    return () => window.clearInterval(id);
  }, [hydrated, skipEntirely, open, phase]);

  // After the dashboard is ready: keep the loader at least MIN_LOADER_DISPLAY_MS total, then switch to welcome.
  useEffect(() => {
    if (!hydrated || skipEntirely || !open || !isReady) return;
    if (loadingTimerRef.current) clearTimeout(loadingTimerRef.current);
    setPhase("loading");
    const anchor = loaderSessionStartRef.current ?? Date.now();
    const elapsed = Date.now() - anchor;
    const waitMs = Math.max(LOADING_PHASE_MS, MIN_LOADER_DISPLAY_MS - elapsed);
    loadingTimerRef.current = setTimeout(() => {
      setPhase("welcome");
      markWelcomeOverlayDismissed(storageKey);
    }, waitMs);
    return () => {
      if (loadingTimerRef.current) clearTimeout(loadingTimerRef.current);
      loadingTimerRef.current = null;
    };
  }, [hydrated, isReady, skipEntirely, open, storageKey]);

  // After the welcome line is shown, dismiss and mark session so we do not show again.
  useEffect(() => {
    if (!hydrated || skipEntirely || !open || !isReady || phase !== "welcome") return;
    if (welcomeTimerRef.current) clearTimeout(welcomeTimerRef.current);
    welcomeTimerRef.current = setTimeout(() => {
      markWelcomeOverlayDismissed(storageKey);
      setSkipEntirely(true);
      setOpen(false);
      dispatchWelcomeOverlayClosed();
      onWelcomeComplete?.();
    }, WELCOME_PHASE_MS);
    return () => {
      if (welcomeTimerRef.current) clearTimeout(welcomeTimerRef.current);
      welcomeTimerRef.current = null;
    };
  }, [hydrated, isReady, skipEntirely, storageKey, phase, onWelcomeComplete]);

  if (!hydrated || skipEntirely) {
    return null;
  }

  const first = firstNameOnly(userName);
  const welcomeLine = `${timeOfDayGreeting()}, ${first}`;
  const welcomeSub = "You’re all set to jump back in.";
  const brand = resolveAuthModalBrand({
    hostname: window.location.hostname,
    companyName: session?.company?.name,
    logoUrl: session?.company?.logo_url,
  });
  const vernonMark = brand.kind === "vernon";

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
              className="pointer-events-none relative mx-auto w-fit max-w-[calc(100dvw-3rem)] overflow-hidden rounded-[22px] border border-[rgba(76,96,133,0.18)] bg-[#f8fafc] text-center shadow-[0_20px_55px_rgba(76,96,133,0.14)]"
              initial={{ opacity: 0, scale: 0.985, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.99, y: 6 }}
              transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="relative z-[3] px-[3px] pb-7 pt-5 text-center sm:pb-8 sm:pt-6">
                <div
                  className={cn(
                    vernonMark
                      ? "relative mx-auto h-[5.25rem] w-[min(18rem,calc(100vw-6rem))] sm:h-[5.75rem] sm:w-[20rem]"
                      : "relative mx-auto h-[9.3rem] w-[9.3rem] sm:h-[9.9rem] sm:w-[9.9rem]",
                    phase === "loading" && "motion-safe:animate-welcome-logo-pulse",
                  )}
                >
                  <CinematicLogoImage
                    src={brand.cinematicSrc}
                    alt={brand.cinematicAlt}
                    sizes={vernonMark ? "(max-width: 640px) 288px, 320px" : "(max-width: 640px) 158px, 173px"}
                    priority
                    className="object-contain object-center"
                  />
                </div>

              {phase === "loading" ? (
                <div className="mt-5 px-[0.25in]">
                  <h1
                    id="welcome-loader-title"
                    className="whitespace-nowrap font-headline text-xl font-extrabold tracking-tight text-[#1f2a44] sm:text-2xl"
                  >
                    Preparing your workspace...
                  </h1>
                  <p className="mt-1.5 whitespace-nowrap text-sm font-medium text-[#51647a]">
                    Loading your workspace
                  </p>
                  <WorkspaceProgressBar progress={loadProgress} />
                </div>
              ) : (
                <motion.div
                  className="mt-5 px-[0.25in]"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                >
                  <h1
                    id="welcome-loader-title"
                    className="whitespace-nowrap font-headline text-xl font-extrabold tracking-tight text-[#1f2a44] sm:text-2xl"
                  >
                    {welcomeLine}
                  </h1>
                  <p className="mt-1.5 whitespace-nowrap text-sm font-medium text-[#51647a]">
                    {welcomeSub}
                  </p>
                </motion.div>
              )}
              </div>
            </motion.div>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );

  return createPortal(overlay, document.body);
}
