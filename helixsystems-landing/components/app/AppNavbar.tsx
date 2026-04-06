"use client";

/**
 * Sticky top bar: Pulse logo, login CTA, or user menu (profile/settings/sign-out links).
 */
import { usePathname } from "next/navigation";
import Link from "next/link";
import { Activity, ChevronDown, LogOut, Settings, User } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useOnboardingOptional } from "@/components/onboarding/OnboardingProvider";
import { usePulseAuth } from "@/hooks/usePulseAuth";
import { navigateToPulseLogin, pulseApp, pulseRoutes } from "@/lib/pulse-app";
import { clearSession } from "@/lib/pulse-session";
import { ThemeToggle } from "@/components/theme/ThemeToggle";

function initialsFrom(email: string, fullName: string | null | undefined): string {
  if (fullName?.trim()) {
    const parts = fullName.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return parts[0].slice(0, 2).toUpperCase();
  }
  const local = email.split("@")[0] ?? "";
  return local.slice(0, 2).toUpperCase() || "—";
}

const HEADER =
  "sticky top-0 z-50 h-16 shrink-0 border-b border-gray-200 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.04)] backdrop-blur-sm supports-[backdrop-filter]:bg-white/90 dark:border-[#1F2937] dark:bg-[#0B0F14]/95 dark:shadow-[0_1px_3px_rgba(0,0,0,0.25)] supports-[backdrop-filter]:dark:bg-[#0B0F14]/90";

export function AppNavbar() {
  const pathname = usePathname();
  const { authed, session } = usePulseAuth();
  const onboarding = useOnboardingOptional();
  const [userOpen, setUserOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  const logoHref = authed ? pulseApp.to(pulseRoutes.overview) : pulseRoutes.pulseLanding;

  useEffect(() => {
    if (!userOpen) return;
    const close = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserOpen(false);
      }
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [userOpen]);

  const signOut = useCallback(() => {
    clearSession();
    setUserOpen(false);
    navigateToPulseLogin();
  }, []);

  return (
    <header className={HEADER}>
      <nav
        className="flex h-full w-full items-center justify-between gap-4 px-3 sm:px-5 lg:px-8"
        aria-label="Main"
      >
        <div className="flex min-w-0 items-center">
          <Link
            href={logoHref}
            className="flex min-w-0 items-center gap-2.5 font-headline text-lg font-bold tracking-tight text-gray-900 no-underline hover:text-blue-600 sm:text-xl dark:text-gray-100 dark:hover:text-blue-400"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-gray-200 bg-gray-50 text-blue-600 shadow-sm dark:border-[#1F2937] dark:bg-[#111827] dark:text-blue-400 dark:shadow-[0_2px_8px_rgba(0,0,0,0.35)]">
              <Activity className="h-4 w-4" strokeWidth={2} aria-hidden />
            </span>
            <span className="font-semibold">Pulse</span>
          </Link>
        </div>

        <div className="flex items-center gap-2">
          {authed ? <ThemeToggle /> : null}
          {authed &&
          onboarding?.state?.onboarding_enabled &&
          !onboarding.state.onboarding_completed &&
          !onboarding.loading ? (
            <button
              type="button"
              onClick={() => onboarding.setChecklistExpanded(true)}
              className="inline-flex max-w-[7rem] truncate rounded-lg border border-sky-200/90 bg-sky-50 px-2 py-1.5 text-[11px] font-semibold text-[#1e4a8a] shadow-sm hover:bg-sky-100/90 dark:border-blue-500/30 dark:bg-blue-500/15 dark:text-blue-300 dark:hover:bg-blue-500/25 sm:max-w-none sm:px-2.5 sm:text-xs"
            >
              Resume setup
            </button>
          ) : null}
          {!authed ? (
            pathname !== "/login" ? (
              <Link
                href={pulseApp.login()}
                className="rounded-lg px-2 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-100 dark:text-gray-100 dark:hover:bg-white/10 sm:px-3"
              >
                Login
              </Link>
            ) : null
          ) : (
            <div className="relative" ref={userMenuRef}>
              <button
                type="button"
                onClick={() => setUserOpen((o) => !o)}
                className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white py-1 pl-1.5 pr-1.5 shadow-sm hover:bg-gray-50 dark:border-[#1F2937] dark:bg-[#111827] dark:hover:bg-[#0F172A] sm:py-1.5 sm:pl-2 sm:pr-2.5"
                aria-expanded={userOpen}
                aria-haspopup="menu"
              >
                <span
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-xs font-bold text-gray-900 ring-1 ring-gray-200 dark:bg-[#0F172A] dark:text-gray-100 dark:ring-[#1F2937]"
                  title={session?.email}
                >
                  {session ? initialsFrom(session.email, session.full_name) : "?"}
                </span>
                <span className="hidden max-w-[11rem] truncate text-sm font-medium text-gray-500 dark:text-gray-400 md:block">
                  {session?.email}
                </span>
                <ChevronDown className="h-4 w-4 shrink-0 text-gray-500 dark:text-gray-400" aria-hidden />
              </button>
              {userOpen ? (
                <div
                  className="absolute right-0 mt-1 w-52 rounded-lg border border-gray-200 bg-white py-1 shadow-lg dark:border-[#1F2937] dark:bg-[#111827] dark:shadow-[0_8px_24px_rgba(0,0,0,0.45)]"
                  role="menu"
                >
                  <Link
                    href={pulseApp.to(pulseRoutes.overview)}
                    className="flex items-center gap-2 px-3 py-2 text-sm text-gray-900 hover:bg-gray-50 dark:text-gray-100 dark:hover:bg-[#0F172A]"
                    onClick={() => setUserOpen(false)}
                    role="menuitem"
                  >
                    <User className="h-4 w-4 text-gray-500 dark:text-gray-400" strokeWidth={2} aria-hidden />
                    Profile
                  </Link>
                  <Link
                    href={pulseApp.to(pulseRoutes.overview)}
                    className="flex items-center gap-2 px-3 py-2 text-sm text-gray-900 hover:bg-gray-50 dark:text-gray-100 dark:hover:bg-[#0F172A]"
                    onClick={() => setUserOpen(false)}
                    role="menuitem"
                  >
                    <Settings className="h-4 w-4 text-gray-500 dark:text-gray-400" strokeWidth={2} aria-hidden />
                    Settings
                  </Link>
                  <button
                    type="button"
                    onClick={signOut}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-900 hover:bg-gray-50 dark:text-gray-100 dark:hover:bg-[#0F172A]"
                    role="menuitem"
                  >
                    <LogOut className="h-4 w-4 text-gray-500 dark:text-gray-400" strokeWidth={2} aria-hidden />
                    Sign out
                  </button>
                </div>
              ) : null}
            </div>
          )}
        </div>
      </nav>
    </header>
  );
}
