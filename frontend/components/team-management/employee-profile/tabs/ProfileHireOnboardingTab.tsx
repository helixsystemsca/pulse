"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { HirePacketChecklist } from "@/components/team-management/onboarding/HirePacketChecklist";
import { useEmployeeProfileContext } from "@/components/team-management/employee-profile/EmployeeProfileContext";
import { usePulseAuth } from "@/hooks/usePulseAuth";
import {
  ensureWorkerHireOnboarding,
  fetchWorkerHireOnboarding,
  type HirePacket,
} from "@/lib/hireOnboardingService";
import { parseClientApiError } from "@/lib/parse-client-api-error";

export function ProfileHireOnboardingTab() {
  const { profile } = useEmployeeProfileContext();
  const { session } = usePulseAuth();
  const companyId = session?.company_id ?? null;
  const userId = profile?.userId ?? null;
  const [packet, setPacket] = useState<HirePacket | null>(null);
  const [missing, setMissing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
      const next = await fetchWorkerHireOnboarding(companyId, userId);
      setPacket(next);
      setMissing(false);
    } catch (e) {
      const parsed = parseClientApiError(e);
      if (parsed.status === 404) {
        setPacket(null);
        setMissing(true);
      } else {
        setError(parsed.message);
      }
    } finally {
      setLoading(false);
    }
  }, [companyId, userId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!profile) return null;

  if (loading) {
    return (
      <div className="flex min-h-[8rem] items-center justify-center text-ds-muted">
        <Loader2 className="h-6 w-6 animate-spin" aria-hidden />
      </div>
    );
  }
  if (error) return <p className="text-sm text-ds-danger">{error}</p>;
  if (missing || !packet) {
    return (
      <div className="ops-dash-inner-card max-w-lg space-y-3 p-4">
        <p className="text-sm text-ds-muted">No hire document packet is attached to this employee yet.</p>
        <Button
          type="button"
          variant="secondary"
          className="h-8 px-3 text-xs"
          onClick={() => {
            if (!userId) return;
            void ensureWorkerHireOnboarding(companyId, userId)
              .then((next) => {
                setPacket(next);
                setMissing(false);
              })
              .catch((e) => setError(parseClientApiError(e).message));
          }}
        >
          Attach default packet
        </Button>
      </div>
    );
  }

  return <HirePacketChecklist packet={packet} companyId={companyId} onUpdated={setPacket} />;
}
