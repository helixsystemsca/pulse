"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { GitBranch, Loader2 } from "lucide-react";
import { parseClientApiError } from "@/lib/parse-client-api-error";
import { trainingCourseHref } from "@/lib/training/routes";
import {
  fetchLearningPaths,
  type TrainingLearningPath,
} from "@/lib/training/trainingPlatformApi";
import { cn } from "@/lib/cn";
import { uiCalloutWarning, uiPageDescription } from "@/styles/ui-classes";

export function LearningPathsPanel() {
  const [paths, setPaths] = useState<TrainingLearningPath[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const rows = await fetchLearningPaths();
        if (!cancelled) setPaths(rows);
      } catch (e) {
        if (!cancelled) setError(parseClientApiError(e).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-ds-muted">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        Loading learning paths…
      </div>
    );
  }

  if (error) {
    return <div className={uiCalloutWarning}>{error}</div>;
  }

  if (paths.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-ds-border bg-ds-muted/10 p-8 text-center">
        <GitBranch className="mx-auto h-8 w-8 text-ds-muted" aria-hidden />
        <p className="mt-3 text-sm font-medium text-ds-foreground">No learning paths published</p>
        <p className={cn(uiPageDescription, "mx-auto mt-1 max-w-md")}>
          Curated sequences of courses and lessons will appear here when your organization publishes paths.
        </p>
      </div>
    );
  }

  return (
    <ul className="space-y-4">
      {paths.map((path) => (
        <li key={path.id} className="rounded-xl border border-ds-border bg-ds-card p-5">
          <h3 className="text-base font-semibold text-ds-foreground">{path.title}</h3>
          {path.description ? <p className="mt-1 text-sm text-ds-muted">{path.description}</p> : null}
          <ol className="mt-4 space-y-2">
            {path.items.map((item, i) => (
              <li key={item.id} className="flex items-center gap-3 text-sm">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ds-muted/40 text-xs font-bold text-ds-muted">
                  {i + 1}
                </span>
                {item.course_id ? (
                  <Link
                    href={trainingCourseHref(item.course_id)}
                    className="font-medium text-teal-700 hover:underline dark:text-teal-300"
                  >
                    Course step
                    {!item.is_required ? " (optional)" : ""}
                  </Link>
                ) : (
                  <span className="text-ds-muted">
                    Lesson or quiz step{item.is_required ? "" : " (optional)"}
                  </span>
                )}
              </li>
            ))}
          </ol>
        </li>
      ))}
    </ul>
  );
}
