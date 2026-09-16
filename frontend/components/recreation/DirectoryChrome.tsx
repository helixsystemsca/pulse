"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/recreation/people", label: "Staff" },
  { href: "/recreation/contacts", label: "Contacts" },
  { href: "/recreation/org-chart", label: "Org Chart" },
];

export function DirectoryChrome() {
  const pathname = usePathname();
  return (
    <nav data-tour="directory-tabs" className="mb-4 flex flex-wrap gap-2 border-b border-ds-border pb-3" aria-label="Directory views">
      {LINKS.map((l) => {
        const active = l.href === "/recreation/people" ? pathname === "/recreation/people" : pathname.startsWith(l.href);
        return (
          <Link
            key={l.href}
            href={l.href}
            className={`rounded-lg px-3 py-1.5 text-sm ${
              active ? "bg-ds-primary text-white" : "text-ds-muted hover:bg-ds-card hover:text-ds-foreground"
            }`}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
