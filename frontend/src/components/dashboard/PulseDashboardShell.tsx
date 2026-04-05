"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useAdminRealtime } from "@/components/admin/AdminRealtimeProvider";
import { useFeatureAccess } from "@/components/FeatureAccess";
import {
  buildDashboardNavItems,
  dashboardPageTitle,
  isNavActive,
} from "@/lib/dashboard-nav";
import { getToken } from "@/lib/api";
import { ThemeToggle } from "@/components/theme/ThemeToggle";

type PulseDashboardShellProps = {
  children: React.ReactNode;
  /** Extra classes on `<main className="admin-content">` (e.g. wider CMMS layout). */
  contentClassName?: string;
};

export function PulseDashboardShell({ children, contentClassName = "" }: PulseDashboardShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { has, loaded } = useFeatureAccess();
  const { status } = useAdminRealtime();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!getToken()) router.replace("/login");
  }, [router]);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  const navItems = useMemo(() => buildDashboardNavItems(loaded, has), [loaded, has]);

  const title = dashboardPageTitle(pathname);
  const live = status === "live";
  const err = status === "error";

  return (
    <div className="admin-app">
      {menuOpen ? (
        <button
          type="button"
          className="admin-backdrop"
          aria-label="Close menu"
          onClick={() => setMenuOpen(false)}
        />
      ) : null}

      <aside className={`admin-sidebar ${menuOpen ? "is-open" : ""}`}>
        <div className="admin-brand">
          <div
            className="admin-brand-name"
            style={{ fontSize: "1.2rem", fontWeight: 700, letterSpacing: "-0.02em", marginTop: 0 }}
          >
            Pulse
          </div>
        </div>
        <nav className="admin-nav" aria-label="Main navigation">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`admin-nav-link ${isNavActive(pathname, item.href) ? "is-active" : ""}`}
            >
              <span className="admin-nav-icon" aria-hidden>
                {item.icon}
              </span>
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="admin-sidebar-footer">
          <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
            <Link href="/admin/settings" style={{ color: "var(--text)", fontSize: "0.88rem", fontWeight: 500 }}>
              Settings
            </Link>
            <a href="mailto:support@helixsystems.ca" style={{ color: "var(--muted)", fontSize: "0.85rem" }}>
              Support
            </a>
          </div>
          <div style={{ marginTop: "0.75rem" }}>
            <Link href="/worker" style={{ color: "var(--muted)", fontSize: "0.85rem" }}>
              Worker app →
            </Link>
          </div>
        </div>
      </aside>

      <div className="admin-main">
        <header className="admin-topbar">
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", minWidth: 0 }}>
            <button
              type="button"
              className="admin-menu-btn"
              aria-label="Open navigation"
              onClick={() => setMenuOpen(true)}
            >
              ☰
            </button>
            <h1 className="admin-topbar-title">{title}</h1>
          </div>
          <div className="admin-topbar-actions">
            <div className="admin-live-pill" title="WebSocket event stream to this tenant">
              <span className={`admin-live-dot ${live ? "is-live" : ""} ${err ? "is-error" : ""}`} />
              {status === "connecting" ? "Connecting…" : live ? "Live" : err ? "Stream error" : "Offline"}
            </div>
            <ThemeToggle />
          </div>
        </header>
        <main className={`admin-content ${contentClassName}`.trim()}>{children}</main>
      </div>
    </div>
  );
}
