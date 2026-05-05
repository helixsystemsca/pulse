"use client";

/**
 * Full-screen welcome overlay after sign-in: centered card, Panorama logo, and ocean-wave progress.
 * Shown at most once per browser tab session (`sessionStorage`), so refreshes skip the animation.
 */

import { AnimatePresence, motion } from "framer-motion";
import Image from "next/image";
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";
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

/** Minimum time the ocean wave is visible (fast API / warm Render otherwise flashes past). */
const MIN_WAVE_DISPLAY_MS = 5000;
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

function WaveTile({ uid }: { uid: string }) {
  const fill = `oceanWaveFill-${uid}`;
  const foam = `oceanWaveFoam-${uid}`;
  return (
    <svg
      className="h-full w-1/2 shrink-0"
      viewBox="0 0 400 72"
      preserveAspectRatio="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id={fill} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#8fd9d4" stopOpacity="0.92" />
          <stop offset="45%" stopColor="#2c8f82" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#3d5a80" stopOpacity="0.65" />
        </linearGradient>
        <linearGradient id={foam} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ecfeff" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#2c8f82" stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* Period 400: Q + T chain keeps y equal at x=0 and x=400 for seamless tiling */}
      <path fill={`url(#${fill})`} d="M0 40 Q100 24 200 40 T400 40 L400 72 L0 72 Z" />
      <path fill={`url(#${foam})`} d="M0 36 Q100 20 200 36 T400 36 L400 42 L0 42 Z" />
    </svg>
  );
}

/** Seamless ocean wave along the card bottom while loading (CSS keyframes for reliable motion). */
function OceanWaveBar() {
  const gid = useId().replace(/:/g, "");
  return (
    <div
      className="pointer-events-none absolute inset-x-0 bottom-0 z-[2] h-[3.25rem] overflow-hidden sm:h-16"
      aria-hidden
    >
      <div
        className={cn(
          "flex h-full w-[200%] will-change-transform",
          "animate-welcome-ocean motion-reduce:animate-none",
        )}
      >
        <WaveTile uid={`${gid}-a`} />
        <WaveTile uid={`${gid}-b`} />
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
}: WelcomeLoaderModalProps) {
  const [hydrated, setHydrated] = useState(false);
  const [skipEntirely, setSkipEntirely] = useState(false);
  const [open, setOpen] = useState(true);
  const [phase, setPhase] = useState<WelcomePhase>("loading");
  const loadingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const welcomeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** When the overlay first shows the loading wave for this visit (for minimum wave duration). */
  const waveSessionStartRef = useRef<number | null>(null);

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
    if (!hydrated || skipEntirely || !open) return;
    if (waveSessionStartRef.current === null) {
      waveSessionStartRef.current = Date.now();
    }
  }, [hydrated, skipEntirely, open]);

  // After the dashboard is ready: keep the wave at least MIN_WAVE_DISPLAY_MS total, then switch to welcome.
  useEffect(() => {
    if (!hydrated || skipEntirely || !isReady) return;
    if (loadingTimerRef.current) clearTimeout(loadingTimerRef.current);
    setPhase("loading");
    const anchor = waveSessionStartRef.current ?? Date.now();
    const elapsed = Date.now() - anchor;
    const waitMs = Math.max(LOADING_PHASE_MS, MIN_WAVE_DISPLAY_MS - elapsed);
    loadingTimerRef.current = setTimeout(() => {
      setPhase("welcome");
    }, waitMs);
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
              className="pointer-events-none relative w-full max-w-lg overflow-hidden rounded-[22px] border border-[rgba(76,96,133,0.18)] bg-[#f8fafc] text-center shadow-[0_20px_55px_rgba(76,96,133,0.14)] sm:max-w-xl"
              initial={{ opacity: 0, scale: 0.985, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.99, y: 6 }}
              transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
            >
              <div
                className={[
                  "relative z-[3] px-7 pt-9 text-center sm:px-10 sm:pt-10",
                  phase === "loading" ? "pb-16 sm:pb-18" : "pb-10 sm:pb-12",
                ].join(" ")}
              >
                <div className="relative mx-auto h-[6.5rem] w-[6.5rem] sm:h-28 sm:w-28">
                  <Image
                    src="/images/panoramalogo2.png"
                    alt=""
                    fill
                    priority
                    sizes="(max-width: 640px) 104px, 112px"
                    className="object-contain object-center"
                  />
                </div>

              {phase === "loading" ? (
                <>
                  <h1
                    id="welcome-loader-title"
                    className="mt-6 font-headline text-xl font-extrabold tracking-tight text-[#1f2a44] sm:text-2xl"
                  >
                    Preparing your workspace...
                  </h1>
                  <p className="mt-2 text-sm font-medium text-[#51647a]">
                    Gathering the latest from your operation
                  </p>
                </>
              ) : (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                >
                  <h1
                    id="welcome-loader-title"
                    className="mt-6 font-headline text-xl font-extrabold tracking-tight text-[#1f2a44] sm:text-2xl"
                  >
                    {welcomeLine}
                  </h1>
                  <p className="mt-2 text-sm font-medium text-[#51647a]">
                    {welcomeSub}
                  </p>
                </motion.div>
              )}
              </div>

              {phase === "loading" ? <OceanWaveBar /> : null}
            </motion.div>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );

  return createPortal(overlay, document.body);
}
