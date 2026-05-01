"use client";

import { useEffect, useState } from "react";
import { listProjects, type ProjectRow } from "@/lib/projectsService";

type Props = {
  value: string | null;
  onChange: (projectId: string | null) => void;
  disabled?: boolean;
};

export function ProjectSelector({ value, onChange, disabled }: Props) {
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

  return (
    <label className="flex min-w-[min(100%,14rem)] flex-col gap-0.5">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-ds-muted">Project</span>
      <select
        className="app-field min-h-9 text-sm"
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
      {error ? <span className="text-[10px] text-ds-danger">{error}</span> : null}
    </label>
  );
}
