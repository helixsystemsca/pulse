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
      className="mb-6 flex flex-wrap gap-1 rounded-md border border-ds-border bg-ds-secondary p-1 shadow-sm"
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
                ? "border-b-2 border-ds-success bg-ds-primary text-ds-foreground"
                : "border-b-2 border-transparent text-ds-muted hover:bg-ds-primary hover:text-ds-foreground"
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
