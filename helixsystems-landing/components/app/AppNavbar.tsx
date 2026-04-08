"use client";

/**
 * Sticky top bar: Pulse logo, login CTA, or user menu (profile/settings/sign-out links).
 */
import { usePathname } from "next/navigation";
import Link from "next/link";
import { Activity, ChevronDown, Image as ImageIcon, LogOut, Settings } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useOnboardingOptional } from "@/components/onboarding/OnboardingProvider";
import { usePulseAuth } from "@/hooks/usePulseAuth";
import { navigateToPulseLogin, pulseApp, pulseRoutes } from "@/lib/pulse-app";
import { clearSession } from "@/lib/pulse-session";
import { UserProfileAvatarPreview } from "@/components/profile/UserProfileAvatarPreview";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { sessionHasAnyRole } from "@/lib/pulse-roles";

/** Shell tokens: `--pulse-header-*` in globals.css (light glass · dark blueprint bar). */
const HEADER =
  "sticky top-0 z-50 h-16 shrink-0 border-b backdrop-blur-md border-[var(--pulse-header-border)] bg-[var(--pulse-header-bg)] shadow-[var(--pulse-header-shadow)]";

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
            className="flex min-w-0 items-center gap-2.5 font-headline text-lg font-bold tracking-tight text-ds-foreground no-underline hover:text-ds-success sm:text-xl"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-ds-border bg-ds-secondary text-ds-success shadow-[var(--ds-shadow-card)]">
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
              className="inline-flex max-w-[7rem] truncate rounded-md border border-sky-200/90 bg-sky-50 px-2 py-1.5 text-[11px] font-semibold text-[#1e4a8a] shadow-sm hover:bg-sky-100/90 dark:border-blue-500/30 dark:bg-blue-500/15 dark:text-blue-300 dark:hover:bg-blue-500/25 sm:max-w-none sm:px-2.5 sm:text-xs"
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
                className="flex items-center gap-2 rounded-md border border-ds-border bg-ds-primary py-1 pl-1.5 pr-1.5 shadow-[var(--ds-shadow-card)] transition-colors hover:bg-ds-secondary sm:py-1.5 sm:pl-2 sm:pr-2.5"
                aria-expanded={userOpen}
                aria-haspopup="menu"
              >
                <span title={session?.email} className="shrink-0">
                  {session ? (
                    <UserProfileAvatarPreview
                      avatarUrl={session.avatar_url}
                      nameFallback={session.full_name || session.email}
                      sizeClassName="h-8 w-8"
                      fallback="initials"
                      className="!border-gray-200 !bg-gray-100 !text-gray-900 !ring-1 !ring-gray-200 dark:!border-[#1F2937] dark:!bg-[#0F172A] dark:!text-gray-100 dark:!ring-[#1F2937]"
                    />
                  ) : (
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-xs font-bold text-gray-900 ring-1 ring-gray-200 dark:bg-[#0F172A] dark:text-gray-100 dark:ring-[#1F2937]">
                      ?
                    </span>
                  )}
                </span>
                <span className="hidden max-w-[11rem] truncate text-sm font-medium text-ds-muted md:block">
                  {session?.email}
                </span>
                <ChevronDown className="h-4 w-4 shrink-0 text-ds-muted" aria-hidden />
              </button>
              {userOpen ? (
                <div
                  className="absolute right-0 mt-1 w-56 rounded-md border border-ds-border bg-ds-elevated py-1 shadow-[var(--ds-shadow-diffuse)]"
                  role="menu"
                >
                  <Link
                    href={pulseApp.to("/dashboard/profile-settings")}
                    className="flex items-center gap-2 px-3 py-2 text-sm text-ds-foreground hover:bg-ds-secondary"
                    onClick={() => setUserOpen(false)}
                    role="menuitem"
                  >
                    <Settings className="h-4 w-4 text-ds-muted" strokeWidth={2} aria-hidden />
                    Profile Settings
                  </Link>
                  {session && sessionHasAnyRole(session, "company_admin") ? (
                    <Link
                      href={pulseApp.to("/dashboard/organization")}
                      className="flex items-center gap-2 px-3 py-2 text-sm text-ds-foreground hover:bg-ds-secondary"
                      onClick={() => setUserOpen(false)}
                      role="menuitem"
                    >
                      <ImageIcon className="h-4 w-4 text-ds-muted" strokeWidth={2} aria-hidden />
                      Organization & branding
                    </Link>
                  ) : null}
                  <button
                    type="button"
                    onClick={signOut}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-ds-foreground hover:bg-ds-secondary"
                    role="menuitem"
                  >
                    <LogOut className="h-4 w-4 text-ds-muted" strokeWidth={2} aria-hidden />
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
