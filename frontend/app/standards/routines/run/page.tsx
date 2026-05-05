"use client";

import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { RoutineRun } from "@/components/routines/RoutineRun";
import { Card } from "@/components/pulse/Card";

function RoutineRunPageInner() {
  const sp = useSearchParams();
  const shiftId = sp.get("shift_id");

  const [done, setDone] = useState(false);

  const header = useMemo(() => {
    if (done) return "Routine signed off";
    return "Run routine";
  }, [done]);

  if (!shiftId) {
    return (
      <Card padding="md" className="border-dashed border-slate-200/90 dark:border-ds-border">
        <p className="text-sm font-semibold text-ds-foreground">Missing shift context</p>
        <p className="mt-1 text-sm text-ds-muted">Launch routine execution from a shift in Schedule.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-bold text-ds-foreground">{header}</p>
        <p className="mt-1 text-sm text-ds-muted">Shift context: {shiftId}</p>
      </div>
      <RoutineRun shiftId={shiftId} onCompleted={() => setDone(true)} />
    </div>
  );
}

export default function RoutineRunPage() {
  return (
    <Suspense
      fallback={
        <Card padding="md" className="border-dashed border-slate-200/90 dark:border-ds-border">
          <p className="text-sm text-ds-muted">Loading…</p>
        </Card>
      }
    >
      <RoutineRunPageInner />
    </Suspense>
  );
}

