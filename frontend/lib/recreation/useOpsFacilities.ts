"use client";

import { useCallback, useEffect, useState } from "react";
import { listOpsRecords, type OpsRecord } from "@/lib/recreation/opsService";

export function useOpsFacilities() {
  const [facilities, setFacilities] = useState<OpsRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [available, setAvailable] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await listOpsRecords("facilities");
      setFacilities(rows.filter((r) => r.status !== "archived"));
      setAvailable(true);
    } catch {
      setFacilities([]);
      setAvailable(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { facilities, loading, available, refresh };
}
