"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Award } from "lucide-react";
import { fetchCertificationExpiry, type CertExpirySummary } from "@/lib/certificationExpiryService";
import { parseClientApiError } from "@/lib/parse-client-api-error";

const BUCKETS: Array<{ key: "expired" | "expiring_30" | "expiring_60" | "expiring_90"; label: string }> = [
  { key: "expired", label: "Expired" },
  { key: "expiring_30", label: "Within 30 days" },
  { key: "expiring_60", label: "31–60 days" },
  { key: "expiring_90", label: "61–90 days" },
];

export function CertificationExpiryPanel({ compact = false }: { compact?: boolean }) {
  const [data, setData] = useState<CertExpirySummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void fetchCertificationExpiry()
      .then(setData)
      .catch((e) => setError(parseClientApiError(e).message));
  }, []);

  if (error) {
    return <p className="text-sm text-ds-muted">Certification expiry: {error}</p>;
  }
  if (!data) {
    return <p className="text-sm text-ds-muted">Loading certification expiry…</p>;
  }

  return (
    <section className="space-y-3">
      {!compact ? (
        <div className="flex items-center gap-2">
          <Award className="h-4 w-4 text-ds-primary" aria-hidden />
          <h2 className="text-sm font-semibold text-ds-foreground">Certification expiry (in-app)</h2>
        </div>
      ) : null}
      <p className="text-xs text-ds-muted">
        30 / 60 / 90-day windows from employee certification records. No email. Blank expiry dates are not treated as
        overdue.
      </p>
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {BUCKETS.map((b) => (
          <li key={b.key} className="rounded-lg border border-ds-border bg-ds-card px-3 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-ds-muted">{b.label}</p>
            <p className="text-xl font-semibold tabular-nums text-ds-foreground">{data.counts[b.key]}</p>
          </li>
        ))}
      </ul>
      {data.attention.length ? (
        <ul className="space-y-1 text-sm">
          {data.attention.slice(0, compact ? 6 : 20).map((row) => (
            <li key={row.id}>
              <Link href={row.href} className="font-medium text-[#2B4C7E] hover:underline">
                {row.worker_name} · {row.name}
              </Link>
              <span className="text-ds-muted">
                {" "}
                · {row.status.replace("_", " ")}
                {row.expiry_date ? ` · ${row.expiry_date}` : ""}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-ds-muted">No certifications expired or due within 90 days.</p>
      )}
    </section>
  );
}
