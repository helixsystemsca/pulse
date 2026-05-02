"use client";

import { useEffect, useState } from "react";
import { listProjects, type ProjectRow } from "@/lib/projectsService";

type Props = {
  value: string | null;
  onChange: (projectId: string | null) => void;
  disabled?: boolean;
  /** Compact single control for top bars (no surrounding label). */
  variant?: "default" | "inline" | "toolbar";
};

export function ProjectSelector({ value, onChange, disabled, variant = "default" }: Props) {
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancel = false;
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const rows = await listProjects();
        if (!cancel) setProjects(rows);
      } catch (e: unknown) {
        if (!cancel) {
          setProjects([]);
          setError(e instanceof Error ? e.message : "Failed to load projects");
        }
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => {
      cancel = true;
    };
  }, []);

  const select = (
    <select
      className={
        variant === "toolbar"
          ? "h-8 min-h-0 w-[min(100%,12rem)] shrink-0 rounded-[7px] border border-[#d0d6df] bg-[#f8f9fb] px-2.5 py-1 text-[12.5px] font-medium leading-normal text-[#1a2030] outline-none transition hover:border-[#1ec8a0] hover:bg-white focus:border-[#1ec8a0] focus:ring-2 focus:ring-[#1ec8a0]/20 dark:border-ds-border dark:bg-ds-secondary/40 dark:text-ds-foreground"
          : variant === "inline"
            ? "app-field h-9 min-h-0 w-[min(100%,14rem)] py-1.5 text-sm leading-normal"
            : "app-field min-h-9 text-sm"
      }
      disabled={disabled || loading}
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value ? e.target.value : null)}
      aria-invalid={Boolean(error)}
    >
      <option value="">{loading ? "Loading projects…" : "Select a project…"}</option>
      {projects.map((p) => (
        <option key={p.id} value={p.id}>
          {p.name}
        </option>
      ))}
    </select>
  );

  if (variant === "inline" || variant === "toolbar") {
    return (
      <div className="flex min-h-8 min-w-0 items-center">
        {select}
        {error ? <span className="sr-only text-ds-danger">{error}</span> : null}
      </div>
    );
  }

  return (
    <label className="flex min-w-[min(100%,14rem)] flex-col gap-0.5">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-ds-muted">Project</span>
      {select}
      {error ? <span className="text-[10px] text-ds-danger">{error}</span> : null}
    </label>
  );
}
