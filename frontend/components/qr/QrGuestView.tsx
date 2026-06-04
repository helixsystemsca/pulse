"use client";

import type { QrResolveResult } from "@/lib/qr/qrResourceService";
import { qrResourceTypeLabel } from "@/lib/qr/qr-resource-types";

type Props = {
  resolve: QrResolveResult;
};

export function QrGuestView({ resolve }: Props) {
  const payload = resolve.guest_payload ?? {};
  return (
    <div className="mx-auto max-w-lg space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-ds-border dark:bg-ds-primary">
      <p className="text-xs font-semibold uppercase tracking-wider text-pulse-muted">Guest view · read only</p>
      <h1 className="text-xl font-bold text-pulse-navy dark:text-gray-100">{resolve.name}</h1>
      <p className="text-sm text-pulse-muted">{qrResourceTypeLabel(resolve.resource_type)}</p>
      {resolve.description ? <p className="text-sm text-pulse-navy dark:text-gray-200">{resolve.description}</p> : null}
      <dl className="space-y-2 text-sm">
        {Object.entries(payload).map(([key, value]) => {
          if (key === "resource_type" || value == null || value === "") return null;
          return (
            <div key={key}>
              <dt className="text-xs font-semibold uppercase tracking-wide text-pulse-muted">{key.replace(/_/g, " ")}</dt>
              <dd className="font-medium text-pulse-navy dark:text-gray-100">{String(value)}</dd>
            </div>
          );
        })}
      </dl>
      <p className="text-xs text-pulse-muted">
        Sign in for full access. Guest users cannot edit records, issue inventory, view costs, or see vendor details.
      </p>
    </div>
  );
}
