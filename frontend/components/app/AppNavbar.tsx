"use client";

/**
 * Sticky top bar: product logo, login CTA, or user menu (profile/settings/sign-out links).
 */
import { usePathname } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { ChevronDown, Image as ImageIcon, LogOut, Settings } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { usePulseAuth } from "@/hooks/usePulseAuth";
import { navigateToPulseLogin, pulseApp, pulseRoutes } from "@/lib/pulse-app";
import { clearSession } from "@/lib/pulse-session";
import { UserProfileAvatarPreview } from "@/components/profile/UserProfileAvatarPreview";
import { sessionHasAnyRole } from "@/lib/pulse-roles";
import { cn } from "@/lib/cn";
export function AppNavbar() {
  const pathname = usePathname();
  const { authed, session } = usePulseAuth();
  const [userOpen, setUserOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  const logoHref = authed ? pulseApp.to(pulseRoutes.overview) : pulseRoutes.pulseLanding;
  void session;

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
      <nav className="flex w-full items-center justify-between gap-4" aria-label="Main">
        <div className="flex min-w-0 items-center">
          <Link
            href={logoHref}
            className="flex min-w-0 shrink-0 items-center gap-1.5 sm:gap-2 no-underline hover:opacity-[0.97]"
            aria-label="Home"
          >
            <span className="inline-flex shrink-0 items-center leading-none">
              <Image
                src="/images/panoramalogo2.png"
                alt=""
                width={280}
                height={96}
                priority
                className="h-9 w-auto max-w-[10.5rem] object-contain object-left sm:h-10 sm:max-w-[12rem]"
              />
            </span>
            <span
              className={cn(
                "font-panoramaBrand min-w-0 whitespace-nowrap text-[clamp(1.3125rem,2.75vw,1.875rem)] leading-none tracking-[0.04em]",
                "text-[#1f3a4a] dark:text-[#b8cad6]",
              )}
            >
              <span className="font-semibold">panorama</span> <span className="font-medium">pulse</span>
            </span>
          </Link>
        </div>

        <div className="flex items-stretch gap-2">
          {/* TEMP: ThemeToggle hidden — restore `{authed ? <ThemeToggle /> : null}` when re-enabling */}
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
                className="flex items-center gap-2 rounded-md border border-ds-border bg-ds-primary py-0.5 pl-1.5 pr-1.5 shadow-[var(--ds-shadow-card)] transition-colors hover:bg-ds-secondary sm:py-1 sm:pl-2 sm:pr-2.5"
                aria-expanded={userOpen}
                aria-haspopup="menu"
              >
                <span title={session?.email} className="shrink-0">
                  {session ? (
                    <UserProfileAvatarPreview
                      avatarUrl={session.avatar_url}
                      nameFallback={session.full_name || session.email}
                      sizeClassName="h-7 w-7"
                      fallback="initials"
                      className="!border-gray-200 !bg-gray-100 !text-gray-900 !ring-1 !ring-gray-200 dark:!border-ds-border dark:!bg-ds-secondary dark:!text-gray-100 dark:!ring-ds-border"
                    />
                  ) : (
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gray-100 text-xs font-bold text-gray-900 ring-1 ring-gray-200 dark:bg-ds-secondary dark:text-gray-100 dark:ring-ds-border">
                      ?
                    </span>
                  )}
                </span>
                <span className="hidden max-w-[11rem] truncate text-left md:block">
                  <span className="block truncate text-sm font-semibold text-ds-foreground">
                    {session?.full_name?.trim() || session?.email?.split("@")[0] || "Account"}
                  </span>
                  <span className="block truncate text-[11px] font-semibold capitalize text-ds-muted">
                    {session ? session.role?.replace(/_/g, " ") || "member" : ""}
                  </span>
                </span>
                <ChevronDown className="h-4 w-4 shrink-0 text-ds-muted" aria-hidden />
              </button>
              {userOpen ? (
                <div
                  className="absolute right-0 z-50 mt-1 w-56 rounded-md border border-ds-border bg-ds-elevated py-1 shadow-[var(--ds-shadow-diffuse)]"
                  role="menu"
                >
                  {session?.email ? (
                    <div className="px-3 pb-2 pt-2">
                      <p className="truncate text-xs font-semibold text-ds-muted">{session.email}</p>
                    </div>
                  ) : null}
                  <div className="h-px w-full bg-ds-border" aria-hidden />
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
  );
}
