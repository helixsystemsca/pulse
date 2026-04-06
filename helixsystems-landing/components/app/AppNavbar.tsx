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

  const isSystemAdmin = Boolean(session?.is_system_admin || session?.role === "system_admin");
  const stealthTenantChrome =
    authed &&
    !isSystemAdmin &&
    Boolean(pathname && (pathname === "/overview" || pathname.startsWith("/dashboard")));

  return (
    <header
      className={
        stealthTenantChrome
          ? "sticky top-0 z-50 h-16 shrink-0 border-b border-stealth-border bg-stealth-main/95 shadow-[0_1px_3px_rgba(0,0,0,0.35)] backdrop-blur-sm supports-[backdrop-filter]:bg-stealth-main/90"
          : "sticky top-0 z-50 h-16 shrink-0 border-b border-slate-200/80 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.04)] dark:border-slate-800 dark:bg-slate-900/95 dark:shadow-[0_1px_3px_rgba(0,0,0,0.25)]"
      }
    >
      <nav
        className="flex h-full w-full items-center justify-between gap-4 px-3 sm:px-5 lg:px-8"
        aria-label="Main"
      >
        <div className="flex min-w-0 items-center">
          <Link
            href={logoHref}
            className={
              stealthTenantChrome
                ? "flex min-w-0 items-center gap-2.5 font-headline text-lg font-bold tracking-tight text-stealth-primary no-underline hover:text-stealth-accent sm:text-xl"
                : "flex min-w-0 items-center gap-2.5 font-headline text-lg font-bold tracking-tight text-pulse-navy no-underline hover:text-pulse-accent sm:text-xl dark:text-slate-100 dark:hover:text-sky-400"
            }
          >
            <span
              className={
                stealthTenantChrome
                  ? "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-stealth-border bg-stealth-card text-stealth-accent shadow-stealth-card"
                  : "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200/80 bg-slate-50 text-pulse-accent shadow-sm"
              }
            >
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
              className={
                stealthTenantChrome
                  ? "inline-flex max-w-[7rem] truncate rounded-lg border border-stealth-border bg-stealth-card px-2 py-1.5 text-[11px] font-semibold text-stealth-accent shadow-stealth-card hover:bg-stealth-border/30 sm:max-w-none sm:px-2.5 sm:text-xs"
                  : "inline-flex max-w-[7rem] truncate rounded-lg border border-sky-200/80 bg-sky-50/90 px-2 py-1.5 text-[11px] font-semibold text-[#1e4a8a] shadow-sm hover:bg-sky-100/90 sm:max-w-none sm:px-2.5 sm:text-xs"
              }
            >
              Resume setup
            </button>
          ) : null}
          {!authed ? (
            pathname !== "/login" ? (
              <Link
                href={pulseApp.login()}
                className={
                  stealthTenantChrome
                    ? "rounded-lg px-2 py-2 text-sm font-semibold text-stealth-primary hover:bg-stealth-card sm:px-3"
                    : "rounded-lg px-2 py-2 text-sm font-semibold text-pulse-navy hover:bg-slate-50 dark:text-slate-100 dark:hover:bg-slate-800 sm:px-3"
                }
              >
                Login
              </Link>
            ) : null
          ) : (
            <div className="relative" ref={userMenuRef}>
              <button
                type="button"
                onClick={() => setUserOpen((o) => !o)}
                className={
                  stealthTenantChrome
                    ? "flex items-center gap-2 rounded-xl border border-stealth-border bg-stealth-card py-1 pl-1.5 pr-1.5 shadow-stealth-card hover:bg-stealth-border/30 sm:py-1.5 sm:pl-2 sm:pr-2.5"
                    : "flex items-center gap-2 rounded-xl border border-slate-200/90 bg-white py-1 pl-1.5 pr-1.5 shadow-sm hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:hover:bg-slate-700 sm:py-1.5 sm:pl-2 sm:pr-2.5"
                }
                aria-expanded={userOpen}
                aria-haspopup="menu"
              >
                <span
                  className={
                    stealthTenantChrome
                      ? "flex h-8 w-8 items-center justify-center rounded-full bg-stealth-main text-xs font-bold text-stealth-primary ring-1 ring-stealth-border"
                      : "flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-pulse-navy ring-1 ring-slate-200/60 dark:bg-slate-700 dark:text-slate-100 dark:ring-slate-600"
                  }
                  title={session?.email}
                >
                  {session ? initialsFrom(session.email, session.full_name) : "?"}
                </span>
                <span
                  className={
                    stealthTenantChrome
                      ? "hidden max-w-[11rem] truncate text-sm font-medium text-stealth-secondary md:block"
                      : "hidden max-w-[11rem] truncate text-sm font-medium text-pulse-navy dark:text-slate-200 md:block"
                  }
                >
                  {session?.email}
                </span>
                <ChevronDown
                  className={`h-4 w-4 shrink-0 ${stealthTenantChrome ? "text-stealth-muted" : "text-pulse-muted"}`}
                  aria-hidden
                />
              </button>
              {userOpen ? (
                <div
                  className={
                    stealthTenantChrome
                      ? "absolute right-0 mt-1 w-52 rounded-lg border border-stealth-border bg-stealth-card py-1 shadow-stealth-card"
                      : "absolute right-0 mt-1 w-52 rounded-lg border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-600 dark:bg-slate-900"
                  }
                  role="menu"
                >
                  <Link
                    href={pulseApp.to(pulseRoutes.overview)}
                    className={
                      stealthTenantChrome
                        ? "flex items-center gap-2 px-3 py-2 text-sm text-stealth-primary hover:bg-stealth-main/80"
                        : "flex items-center gap-2 px-3 py-2 text-sm text-pulse-navy hover:bg-slate-50 dark:text-slate-100 dark:hover:bg-slate-800"
                    }
                    onClick={() => setUserOpen(false)}
                    role="menuitem"
                  >
                    <User
                      className={`h-4 w-4 ${stealthTenantChrome ? "text-stealth-muted" : "text-pulse-muted"}`}
                      strokeWidth={2}
                      aria-hidden
                    />
                    Profile
                  </Link>
                  <Link
                    href={pulseApp.to(pulseRoutes.overview)}
                    className={
                      stealthTenantChrome
                        ? "flex items-center gap-2 px-3 py-2 text-sm text-stealth-primary hover:bg-stealth-main/80"
                        : "flex items-center gap-2 px-3 py-2 text-sm text-pulse-navy hover:bg-slate-50 dark:text-slate-100 dark:hover:bg-slate-800"
                    }
                    onClick={() => setUserOpen(false)}
                    role="menuitem"
                  >
                    <Settings
                      className={`h-4 w-4 ${stealthTenantChrome ? "text-stealth-muted" : "text-pulse-muted"}`}
                      strokeWidth={2}
                      aria-hidden
                    />
                    Settings
                  </Link>
                  <button
                    type="button"
                    onClick={signOut}
                    className={
                      stealthTenantChrome
                        ? "flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-stealth-primary hover:bg-stealth-main/80"
                        : "flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-pulse-navy hover:bg-slate-50 dark:text-slate-100 dark:hover:bg-slate-800"
                    }
                    role="menuitem"
                  >
                    <LogOut
                      className={`h-4 w-4 ${stealthTenantChrome ? "text-stealth-muted" : "text-pulse-muted"}`}
                      strokeWidth={2}
                      aria-hidden
                    />
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
