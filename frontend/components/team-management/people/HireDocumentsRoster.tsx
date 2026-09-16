"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ArrowRight, Loader2 } from "lucide-react";
import { HireProgressRing } from "@/components/team-management/onboarding/HireProgressRing";
import { usePulseAuth } from "@/hooks/usePulseAuth";
import { fetchHireOnboardingPackets, type HirePacket } from "@/lib/hireOnboardingService";
import { hireOnboardingPacketHref } from "@/lib/hire-onboarding/notifications";
import { parseClientApiError } from "@/lib/parse-client-api-error";

export function HireDocumentsRoster() {
  const { session } = usePulseAuth();
  const companyId = session?.company_id ?? null;
  const [packets, setPackets] = useState<HirePacket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchHireOnboardingPackets(companyId);
      setPackets(res.items);
    } catch (e) {
      setError(parseClientApiError(e).message);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <div className="flex min-h-[8rem] items-center justify-center text-ds-muted">
        <Loader2 className="h-6 w-6 animate-spin" aria-hidden />
      </div>
    );
  }
  if (error) return <p className="text-sm text-ds-danger">{error}</p>;
  if (packets.length === 0) {
    return (
      <div className="ops-dash-inner-card max-w-xl p-5">
        <p className="text-sm text-ds-muted">
          No hire packets yet. Adding an employee attaches the required-document list from Growth → Onboarding.
        </p>
        <Link
          href="/team-management/growth/onboarding"
          className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-[var(--ds-accent)]"
        >
          Open Onboarding <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-ds-border/60">
      <table className="w-full min-w-[520px] text-left text-sm">
        <thead>
          <tr className="border-b border-ds-border/60 bg-ds-secondary/40 text-[11px] font-bold uppercase tracking-wide text-ds-muted">
            <th className="px-4 py-3">Employee</th>
            <th className="px-4 py-3">Progress</th>
            <th className="px-4 py-3 text-right">Required remaining</th>
          </tr>
        </thead>
        <tbody>
          {packets.map((packet) => {
            const remaining = Math.max(0, packet.progress.required_total - packet.progress.required_completed);
            return (
              <tr key={packet.id} className="border-b border-ds-border/40 last:border-0">
                <td className="px-4 py-3">
                  <Link href={hireOnboardingPacketHref(packet.user_id)} className="font-semibold text-ds-foreground">
                    {packet.full_name?.trim() || packet.email}
                  </Link>
                  <p className="text-xs text-ds-muted">{packet.email}</p>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <HireProgressRing percent={packet.progress.percent} size="sm" />
                    <span className="text-xs text-ds-muted">
                      {packet.progress.required_completed}/{packet.progress.required_total}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-ds-muted">{remaining}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
