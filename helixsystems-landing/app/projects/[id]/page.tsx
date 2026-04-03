"use client";

import { ProjectDetailApp } from "@/components/projects/ProjectDetailApp";
import { navigateToPulseLogin } from "@/lib/pulse-app";
import { readSession } from "@/lib/pulse-session";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

export default function ProjectDetailPage() {
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
    return (
      <div className="mx-auto max-w-6xl px-4 py-6 text-sm text-pulse-muted sm:px-6 lg:px-8">
        Invalid project.
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 lg:px-8">
      <ProjectDetailApp projectId={id} />
    </div>
  );
}
