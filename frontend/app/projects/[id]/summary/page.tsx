"use client";

import { ProjectSummaryPage } from "@/features/project-summary/ProjectSummaryPage";
import { navigateToPulseLogin } from "@/lib/pulse-app";
import { readSession } from "@/lib/pulse-session";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

export default function ProjectSummaryRoutePage() {
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!readSession()) {
      navigateToPulseLogin();
      return;
    }
    setReady(true);
  }, []);

  if (!ready) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-pulse-muted">Loading…</div>
    );
  }

  if (!id) {
    return <p className="text-sm text-pulse-muted">Invalid project.</p>;
  }

  return <ProjectSummaryPage projectId={id} />;
}
