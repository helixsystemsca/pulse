"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/dashboard/maintenance/work-orders", label: "Work orders" },
  { href: "/dashboard/maintenance/preventative", label: "Preventative" },
  { href: "/dashboard/maintenance/procedures", label: "Procedures" },
  { href: "/dashboard/maintenance/work-requests", label: "Work requests" },
] as const;

export function MaintenanceSubnav() {
  const pathname = usePathname();
  return (
    <nav
      className="mb-6 flex flex-wrap gap-1 rounded-md border border-pulse-border bg-white/80 p-1 shadow-sm dark:border-slate-700 dark:bg-slate-900/60"
      aria-label="Maintenance"
    >
      {tabs.map((t) => {
        const active = pathname === t.href || pathname.startsWith(`${t.href}/`);
        return (
          <Link
            key={t.href}
            href={t.href}
            prefetch={false}
            className={`rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
              active
                ? "bg-pulse-accent text-white shadow-sm"
                : "text-pulse-muted hover:bg-slate-100 dark:hover:bg-slate-800"
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
