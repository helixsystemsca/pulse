"use client";

/**
 * Sticky top bar: wordmark, login CTA, or icon row (notifications, messages, settings, profile).
 */
import { usePathname } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Bell, ChevronDown, Image as ImageIcon, KeyRound, LogOut, MessageSquare, Settings } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { usePulseAuth } from "@/hooks/usePulseAuth";
import { navigateToPulseLogin, pulseApp, pulsePostLoginPath, pulseRoutes } from "@/lib/pulse-app";
import { dispatchPulseLogoutSuccessUi, pulseLogoutNavigationDelayMs } from "@/lib/pulse-logout-ui";
import { clearSession } from "@/lib/pulse-session";
import { signOutSupabaseIdentity } from "@/lib/microsoft-auth";
import { UserProfileAvatarPreview } from "@/components/profile/UserProfileAvatarPreview";
import {
  canAccessCompanyConfiguration,
  sessionHasAnyRole,
  sessionRoleDisplayLabel,
  shouldShowWorkerMandatoryPasswordBadge,
} from "@/lib/pulse-roles";
import { cn } from "@/lib/cn";


function IconBadgeCount({ count }: { count: number }) {
  if (count <= 0) return null;
  const label = count > 99 ? "99+" : String(count);
  return (
    <span
      className="pointer-events-none absolute -right-1 -top-1 flex h-[1.125rem] min-w-[1.125rem] items-center justify-center rounded-full bg-[var(--ds-accent)] px-1 text-[10px] font-bold leading-none text-white shadow-sm ring-2 ring-[var(--ds-palette-iron-grey)]"
      aria-hidden
    >
      {label}
    </span>
  );
}

export type AppNavbarProps = {
  /** Shown on the notifications bell when &gt; 0 (wire from API / store when available). */
  notificationCount?: number;
  /** Shown on the messages icon when &gt; 0. */
  messagesCount?: number;
};

export function AppNavbar({ notificationCount = 0, messagesCount = 0 }: AppNavbarProps) {
  const pathname = usePathname();
  const { authed, session } = usePulseAuth();
  const [userOpen, setUserOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  const logoHref =
    authed && session ? pulseApp.to(pulsePostLoginPath(session)) : pulseRoutes.pulseLanding;
  const isDemoViewer = session?.role === "demo_viewer";
  const isSystemAdmin = Boolean(session?.is_system_admin || session?.role === "system_admin");
  const canOpenOrgSettings = session ? isSystemAdmin || canAccessCompanyConfiguration(session) : false;
  const settingsActive =
    pathname === "/settings" ||
    pathname.startsWith("/settings/") ||
    pathname === "/dashboard/profile-settings" ||
    pathname.startsWith("/dashboard/profile-settings/");
  const showWorkerPasswordBadge = session ? shouldShowWorkerMandatoryPasswordBadge(session) : false;

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
    setUserOpen(false);
    dispatchPulseLogoutSuccessUi();
    window.setTimeout(() => {
      signOutSupabaseIdentity();
      clearSession();
      navigateToPulseLogin();
    }, pulseLogoutNavigationDelayMs());
  }, []);

  const chromeIconBtn =
    "relative flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white/85 transition-colors hover:bg-ds-chrome-hover hover:text-white active:bg-ds-chrome-active focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-200/45";

  return (
    <nav
      className="flex w-full flex-col"
      style={{
        height: "var(--pulse-header-height)",
        background: "var(--ds-palette-iron-grey)",
      }}
      aria-label="Main"
    >
      <div
        className="flex min-h-0 w-full flex-1 items-center justify-between gap-4 pr-3 sm:pr-4"
        style={{ minHeight: "var(--pulse-header-bar-height)" }}
      >
        <div className="flex min-w-0 flex-1 items-center pl-1.5 sm:pl-2">
          <Link
            href={logoHref}
            className={cn(
              "font-panoramaBrand inline-flex min-w-0 items-center gap-2 whitespace-nowrap text-[clamp(1.05rem,2.1vw,1.45rem)] uppercase leading-none text-white",
            )}
          >
            <span
              className="relative flex shrink-0 overflow-hidden rounded-md bg-white/[0.06] ring-1 ring-white/10"
              style={{
                width: "calc(var(--pulse-header-bar-height) - 10px)",
                height: "calc(var(--pulse-header-bar-height) - 10px)",
              }}
            >
              <Image
                src="/images/prwhite.png"
                alt=""
                width={48}
                height={48}
                className="h-full w-full object-contain p-1"
                priority
              />
            </span>
            <span className="inline-flex items-baseline gap-0.5">
              <span className="font-normal tracking-[0.04em]">Panorama</span>
              <span className="font-extralight tracking-[0.04em]">Rec</span>
            </span>
          </Link>
        </div>

        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
          {!authed ? (
            pathname !== "/login" ? (
              <Link
                href={pulseApp.login()}
                className="rounded-lg px-3 py-2 text-sm font-semibold text-white/95 hover:bg-ds-chrome-hover active:bg-ds-chrome-active"
              >
                Login
              </Link>
            ) : null
          ) : (
            <>
              {showWorkerPasswordBadge ? (
                <Link
                  href={pulseApp.to("/dashboard/profile-settings")}
                  className={cn(
                    "mr-1 flex min-w-0 max-w-[10rem] items-center gap-1 rounded-lg px-2 py-1.5 text-[11px] font-semibold sm:max-w-[13rem] sm:text-xs",
                    "border border-amber-400/50 bg-amber-500/15 text-amber-50 hover:bg-amber-500/25",
                  )}
                  title="Your administrator assigned a temporary password. Update it in Profile Settings."
                  aria-label="Change your temporary password — open profile settings"
                >
                  <KeyRound className="h-3.5 w-3.5 shrink-0 opacity-90 sm:h-4 sm:w-4" strokeWidth={2} aria-hidden />
                  <span className="min-w-0 truncate">Password</span>
                </Link>
              ) : null}

              <Link
                href={pulseApp.to("/monitoring")}
                className={chromeIconBtn}
                aria-label={`Notifications${notificationCount > 0 ? `, ${notificationCount} unread` : ""}`}
                title="Notifications"
              >
                <Bell className="h-[1.125rem] w-[1.125rem]" strokeWidth={1.75} aria-hidden />
                <IconBadgeCount count={notificationCount} />
              </Link>

              <Link
                href={pulseApp.to("/dashboard/profile-settings")}
                className={chromeIconBtn}
                aria-label={`Messages${messagesCount > 0 ? `, ${messagesCount} unread` : ""}`}
                title="Messages"
              >
                <MessageSquare className="h-[1.125rem] w-[1.125rem]" strokeWidth={1.75} aria-hidden />
                <IconBadgeCount count={messagesCount} />
              </Link>

              <Link
                href={pulseApp.to(canOpenOrgSettings ? "/settings" : "/dashboard/profile-settings")}
                className={cn(chromeIconBtn, settingsActive && "bg-ds-chrome-active text-white")}
                aria-label={canOpenOrgSettings ? "Organization settings" : "Profile settings"}
                title="Settings"
              >
                <Settings className="h-[1.125rem] w-[1.125rem]" strokeWidth={1.75} aria-hidden />
              </Link>

              <div className="relative pl-0.5" ref={userMenuRef}>
                <button
                  type="button"
                  onClick={() => setUserOpen((o) => !o)}
                  className="flex items-center gap-1.5 rounded-lg py-1 pl-1 pr-1 text-white transition-colors hover:bg-ds-chrome-hover active:bg-ds-chrome-active sm:gap-2 sm:pr-1.5"
                  aria-expanded={userOpen}
                  aria-haspopup="menu"
                  aria-label={isDemoViewer ? "Demo mode account menu" : "Account menu"}
                >
                  <span title={session?.email} className="shrink-0">
                    {session ? (
                      <UserProfileAvatarPreview
                        avatarUrl={isDemoViewer ? null : session.avatar_url}
                        nameFallback={
                          isDemoViewer ? "Demo Profile" : session.full_name || session.email
                        }
                        sizeClassName="h-8 w-8"
                        fallback="initials"
                        className="!border-white/25 !bg-white/15 !text-white !ring-1 !ring-white/20"
                      />
                    ) : (
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15 text-xs font-bold text-white ring-1 ring-white/25">
                        ?
                      </span>
                    )}
                  </span>
                  <span className="hidden max-w-[10rem] truncate text-left text-white/95 md:block">
                    <span className="block truncate text-sm font-semibold">
                      {isDemoViewer
                        ? "Demo Profile"
                        : session?.full_name?.trim() || session?.email?.split("@")[0] || "Account"}
                    </span>
                    <span className="block truncate text-[11px] font-medium text-white/65">
                      {isDemoViewer ? "Demo Viewer" : session ? sessionRoleDisplayLabel(session) : ""}
                    </span>
                  </span>
                  <ChevronDown className="h-4 w-4 shrink-0 text-white/70" aria-hidden />
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
            </>
          )}
        </div>
      </div>
      <div className="h-px w-full shrink-0 bg-gradient-to-r from-transparent via-white/12 to-transparent" aria-hidden />
    </nav>
  );
}
