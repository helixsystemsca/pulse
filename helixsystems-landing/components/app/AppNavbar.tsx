"use client";

import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { Activity, ChevronDown, LogOut, Menu, Settings, User, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { usePulseAuth } from "@/hooks/usePulseAuth";
import { pulseRoutes, pulseSystemNav, pulseTenantNav } from "@/lib/pulse-app";
import { isPulseNavActive } from "@/lib/pulse-nav-active";
import { clearSession } from "@/lib/pulse-session";

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
  const router = useRouter();
  const { authed, session } = usePulseAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  const isSystemAdmin = Boolean(session?.is_system_admin || session?.role === "system_admin");
  const onSystemRoutes = pathname.startsWith("/system");
  const centerLinks = authed
    ? onSystemRoutes && isSystemAdmin
      ? pulseSystemNav
      : pulseTenantNav
    : [];

  const logoHref = authed ? pulseRoutes.overview : pulseRoutes.pulseLanding;
  const onLoginPage = pathname === "/login";

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

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const signOut = useCallback(() => {
    clearSession();
    setUserOpen(false);
    router.push(pulseRoutes.login);
  }, [router]);

  return (
    <header className="sticky top-0 z-50 h-16 shrink-0 border-b border-slate-200/80 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
      <nav
        className="mx-auto flex h-full max-w-7xl items-center justify-between gap-3 px-4 sm:gap-4 sm:px-6"
        aria-label="Main"
      >
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <Link
            href={logoHref}
            className="flex items-center gap-2.5 font-headline text-lg font-bold tracking-tight text-pulse-navy no-underline hover:text-pulse-accent sm:text-xl"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200/80 bg-slate-50 text-pulse-accent shadow-sm">
              <Activity className="h-4 w-4" strokeWidth={2} aria-hidden />
            </span>
            <span>Pulse</span>
          </Link>
        </div>

        {authed && centerLinks.length > 0 ? (
          <div className="hidden flex-1 justify-center px-2 lg:flex">
            <div className="inline-flex max-w-full items-center gap-0.5 overflow-x-auto rounded-xl border border-slate-200/90 bg-slate-50 p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
              {centerLinks.map((item) => {
                const active = isPulseNavActive(item.href, pathname);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`whitespace-nowrap rounded-lg px-3.5 py-2 text-sm font-semibold transition-colors ${
                      active
                        ? "bg-white text-pulse-navy shadow-sm ring-1 ring-slate-200/90"
                        : "text-pulse-muted hover:bg-white/80 hover:text-pulse-navy"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="hidden flex-1 lg:block" aria-hidden />
        )}

        <div className="flex items-center gap-1.5 sm:gap-2">
          {!authed ? (
            <>
              {!onLoginPage ? (
                <Link
                  href={pulseRoutes.login}
                  className="hidden rounded-lg px-3 py-2 text-sm font-semibold text-pulse-navy hover:bg-slate-50 sm:inline-flex"
                >
                  Login
                </Link>
              ) : null}
              {onLoginPage ? (
                <Link
                  href={pulseRoutes.pulseLanding}
                  className="rounded-lg bg-pulse-accent px-3 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-pulse-accent-hover sm:px-4"
                >
                  View product
                </Link>
              ) : (
                <>
                  <Link
                    href={pulseRoutes.login}
                    className="rounded-lg bg-pulse-accent px-3 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-pulse-accent-hover sm:px-4"
                  >
                    Get started
                  </Link>
                  <Link
                    href={pulseRoutes.pulseLanding}
                    className="hidden rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-pulse-navy shadow-sm hover:bg-slate-50 md:inline-flex"
                  >
                    View product
                  </Link>
                </>
              )}
            </>
          ) : (
            <>
              <div className="relative" ref={userMenuRef}>
                <button
                  type="button"
                  onClick={() => setUserOpen((o) => !o)}
                  className="flex items-center gap-2 rounded-xl border border-slate-200/90 bg-white py-1 pl-1.5 pr-1.5 shadow-sm hover:bg-slate-50 sm:py-1.5 sm:pl-2 sm:pr-2.5"
                  aria-expanded={userOpen}
                  aria-haspopup="menu"
                >
                  <span
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-pulse-navy ring-1 ring-slate-200/60"
                    title={session?.email}
                  >
                    {session ? initialsFrom(session.email, session.full_name) : "?"}
                  </span>
                  <span className="hidden max-w-[11rem] truncate text-sm font-medium text-pulse-navy md:block">
                    {session?.email}
                  </span>
                  <ChevronDown className="h-4 w-4 shrink-0 text-pulse-muted" aria-hidden />
                </button>
                {userOpen ? (
                  <div
                    className="absolute right-0 mt-1 w-52 rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
                    role="menu"
                  >
                    <Link
                      href={pulseRoutes.overview}
                      className="flex items-center gap-2 px-3 py-2 text-sm text-pulse-navy hover:bg-slate-50"
                      onClick={() => setUserOpen(false)}
                      role="menuitem"
                    >
                      <User className="h-4 w-4 text-pulse-muted" strokeWidth={2} aria-hidden />
                      Profile
                    </Link>
                    <Link
                      href={pulseRoutes.overview}
                      className="flex items-center gap-2 px-3 py-2 text-sm text-pulse-navy hover:bg-slate-50"
                      onClick={() => setUserOpen(false)}
                      role="menuitem"
                    >
                      <Settings className="h-4 w-4 text-pulse-muted" strokeWidth={2} aria-hidden />
                      Settings
                    </Link>
                    <button
                      type="button"
                      onClick={signOut}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-pulse-navy hover:bg-slate-50"
                      role="menuitem"
                    >
                      <LogOut className="h-4 w-4 text-pulse-muted" strokeWidth={2} aria-hidden />
                      Sign out
                    </button>
                  </div>
                ) : null}
              </div>

              {centerLinks.length > 0 ? (
                <button
                  type="button"
                  className="inline-flex rounded-lg p-2 text-pulse-navy hover:bg-slate-100 lg:hidden"
                  onClick={() => setMobileOpen(true)}
                  aria-label="Open menu"
                >
                  <Menu className="h-5 w-5" strokeWidth={2} />
                </button>
              ) : null}
            </>
          )}
        </div>
      </nav>

      {mobileOpen && authed && centerLinks.length > 0 ? (
        <div className="fixed inset-0 z-[60] lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/40"
            aria-label="Close menu"
            onClick={() => setMobileOpen(false)}
          />
          <div className="absolute right-0 top-0 flex h-full w-[min(100%,18rem)] flex-col border-l border-slate-200 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
              <span className="text-sm font-semibold text-pulse-navy">Menu</span>
              <button
                type="button"
                className="rounded-lg p-2 hover:bg-slate-100"
                onClick={() => setMobileOpen(false)}
                aria-label="Close"
              >
                <X className="h-5 w-5" strokeWidth={2} />
              </button>
            </div>
            <div className="flex flex-col gap-0.5 p-2">
              {centerLinks.map((item) => {
                const active = isPulseNavActive(item.href, pathname);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`rounded-lg px-3 py-2.5 text-sm font-semibold ${
                      active ? "bg-slate-100 text-pulse-navy" : "text-pulse-navy hover:bg-slate-50"
                    }`}
                    onClick={() => setMobileOpen(false)}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}
    </header>
  );
}
