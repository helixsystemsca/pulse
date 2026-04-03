"use client";

import { ProjectsApp } from "@/components/projects/ProjectsApp";
import { navigateToPulseLogin } from "@/lib/pulse-app";
import { readSession } from "@/lib/pulse-session";
import { useEffect, useState } from "react";

export default function ProjectsPage() {
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

  return <ProjectsApp />;
}
