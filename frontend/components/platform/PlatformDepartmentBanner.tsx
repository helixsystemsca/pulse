"use client";

import { ChevronDown } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { listDepartmentsForSwitcher } from "@/config/platform/navigation";
import { useDepartmentPlatform } from "@/contexts/DepartmentPlatformContext";
import { cn } from "@/lib/cn";

export function PlatformDepartmentBanner() {
  const { department, setDepartment } = useDepartmentPlatform();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  if (!department) return null;

  const departments = listDepartmentsForSwitcher();

  return (
    <div
      ref={rootRef}
      className="border-b border-ds-border bg-ds-primary px-3 py-2 lg:px-4"
      data-platform-department-banner
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-wide text-ds-muted">Department workspace</p>
          <p className="truncate text-sm font-semibold text-ds-foreground">{department.name}</p>
        </div>
        <div className="relative">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg border border-ds-border px-3 py-1.5 text-xs font-semibold text-ds-foreground",
              "hover:bg-ds-secondary",
            )}
            aria-expanded={open}
            aria-haspopup="listbox"
          >
            Switch department
            <ChevronDown className="h-3.5 w-3.5 opacity-70" aria-hidden />
          </button>
          {open ? (
            <ul
              className="absolute right-0 z-[60] mt-1 min-w-[200px] rounded-lg border border-ds-border bg-ds-primary py-1 shadow-lg"
              role="listbox"
            >
              {departments.map((d) => (
                <li key={d.id} role="option" aria-selected={d.slug === department.slug}>
                  <button
                    type="button"
                    className="flex w-full px-3 py-2 text-left text-sm text-ds-foreground hover:bg-ds-secondary"
                    onClick={() => {
                      setOpen(false);
                      if (d.slug !== department.slug) setDepartment(d.slug);
                    }}
                  >
                    {d.name}
                  </button>
                </li>
              ))}
              <li className="border-t border-ds-border">
                <Link
                  href="/overview"
                  className="block px-3 py-2 text-xs text-ds-muted hover:bg-ds-secondary hover:text-ds-foreground"
                  onClick={() => setOpen(false)}
                >
                  Back to classic overview
                </Link>
              </li>
            </ul>
          ) : null}
        </div>
      </div>
    </div>
  );
}
