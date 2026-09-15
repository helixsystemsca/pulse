"use client";

/**
 * Brief full-screen overlay after explicit sign-out (same blur shell as welcome).
 */
import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import { resolveAuthModalBrand } from "@/lib/branding/auth-brand";
import { CinematicLogoImage } from "@/components/branding/CinematicLogoImage";
import { HelixMarketingLogo } from "@/components/branding/HelixMarketingLogo";
import { helixMarketingHref } from "@/lib/pulse-app";
import {
  PULSE_LOGOUT_SUCCESS_DISPLAY_MS,
  PULSE_LOGOUT_SUCCESS_EVENT,
  PULSE_LOGOUT_SUCCESS_EXIT_MS,
} from "@/lib/pulse-logout-ui";

export function LogoutSuccessModal() {
  const [hydrated, setHydrated] = useState(false);
  const [open, setOpen] = useState(false);
  const titleId = useId();

  useEffect(() => {
    setHydrated(true);
  }, []);

  const onLogoutUi = useCallback(() => setOpen(true), []);

  useEffect(() => {
    if (!hydrated) return;
    window.addEventListener(PULSE_LOGOUT_SUCCESS_EVENT, onLogoutUi);
    return () => window.removeEventListener(PULSE_LOGOUT_SUCCESS_EVENT, onLogoutUi);
  }, [hydrated, onLogoutUi]);

  useEffect(() => {
    if (!hydrated || !open) return;
    const root = document.documentElement;
    root.classList.add("pulse-welcome-blur");
    const t = window.setTimeout(() => setOpen(false), PULSE_LOGOUT_SUCCESS_DISPLAY_MS);
    return () => {
      root.classList.remove("pulse-welcome-blur");
      window.clearTimeout(t);
    };
  }, [hydrated, open]);

  if (!hydrated) return null;

  const brand = resolveAuthModalBrand({
    hostname: window.location.hostname,
  });
  const vernonMark = brand.kind === "vernon";

  const overlay = (
    <AnimatePresence>
      {open ? (
        <motion.div
          key="logout-success-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          className="auth-background pointer-events-none fixed inset-0 z-[200] flex min-h-[100dvh] items-center justify-center p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: PULSE_LOGOUT_SUCCESS_EXIT_MS / 1000, ease: [0.4, 0, 0.2, 1] }}
        >
          <motion.div
            className="relative w-full max-w-md overflow-hidden rounded-[22px] border border-[rgba(76,96,133,0.18)] bg-[#f8fafc] px-8 py-10 text-center shadow-[0_20px_55px_rgba(76,96,133,0.14)] sm:px-10"
            initial={{ opacity: 0, scale: 0.98, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.99, y: 4 }}
            transition={{ duration: 0.38, ease: [0.16, 1, 0.3, 1] }}
          >
            <div
              className={
                vernonMark
                  ? "relative mx-auto h-16 w-[min(16rem,calc(100vw-6rem))] sm:h-[4.5rem] sm:w-[18rem]"
                  : "relative mx-auto h-20 w-20 sm:h-24 sm:w-24"
              }
            >
              <CinematicLogoImage
                src={brand.cinematicSrc}
                alt={brand.cinematicAlt}
                sizes={vernonMark ? "288px" : "96px"}
                priority
                className="object-contain object-center"
              />
            </div>
            {vernonMark ? (
              <a
                href={helixMarketingHref("/")}
                target="_blank"
                rel="noopener noreferrer"
                className="pointer-events-auto mt-3 flex items-center justify-center gap-2 text-[11px] font-medium text-[#7a8aa0] no-underline"
              >
                <span className="uppercase tracking-[0.14em]">Powered by</span>
                <HelixMarketingLogo variant="compact" className="opacity-90" />
              </a>
            ) : null}
            <h1 id={titleId} className="mt-6 font-headline text-xl font-extrabold tracking-tight text-[#1f2a44] sm:text-2xl">
              You&apos;re signed out
            </h1>
            <p className="mt-2 text-sm font-medium text-[#51647a]">See you next time.</p>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );

  return createPortal(overlay, document.body);
}
