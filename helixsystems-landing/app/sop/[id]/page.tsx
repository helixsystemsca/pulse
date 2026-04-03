"use client";

import Link from "next/link";
import { navigateToPulseLogin } from "@/lib/pulse-app";
import { readSession } from "@/lib/pulse-session";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

export default function SopDetailPage() {
  const params = useParams();
  const sopId = typeof params.id === "string" ? params.id : "";
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

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 lg:px-8">
      <Link
        href="/projects"
        className="inline-flex text-sm font-semibold text-pulse-accent hover:text-pulse-navy"
      >
        ← Back to projects
      </Link>
      <h1 className="font-headline mt-4 text-2xl font-bold tracking-tight text-pulse-navy">Standard procedure</h1>
      <p className="mt-2 text-sm text-pulse-muted">
        Reference ID: <span className="font-mono text-pulse-navy">{sopId || "—"}</span>
      </p>
      <div className="mt-6 rounded-2xl border border-slate-200/90 bg-white/90 p-5 shadow-sm">
        <p className="text-sm text-pulse-muted">
          SOP content and checklists will plug in here. Task “Start” links to this page when a task has an SOP id.
        </p>
      </div>
    </div>
  );
}
