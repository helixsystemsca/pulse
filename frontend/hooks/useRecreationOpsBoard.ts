"use client";

import { useEffect, useSyncExternalStore } from "react";
import {
  fetchCommandDashboard,
  listAuthority,
  listTeamRisks,
  type OpsAuthorityRow,
  type OpsCommandDashboard,
  type OpsTeamRisk,
} from "@/lib/recreation/commandService";

export type RecreationOpsBoard = {
  dash: OpsCommandDashboard | null;
  risks: OpsTeamRisk[];
  authority: OpsAuthorityRow[];
  error: string | null;
  loading: boolean;
};

const EMPTY: RecreationOpsBoard = {
  dash: null,
  risks: [],
  authority: [],
  error: null,
  loading: true,
};

let snapshot: RecreationOpsBoard = EMPTY;
let inflight: Promise<RecreationOpsBoard> | null = null;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot() {
  return snapshot;
}

async function loadBoard(): Promise<RecreationOpsBoard> {
  if (!snapshot.loading && snapshot.dash) return snapshot;
  if (inflight) return inflight;
  inflight = Promise.all([
    fetchCommandDashboard(),
    listTeamRisks().catch(() => [] as OpsTeamRisk[]),
    listAuthority().catch(() => [] as OpsAuthorityRow[]),
  ])
    .then(([dash, risks, authority]) => {
      snapshot = { dash, risks, authority, error: null, loading: false };
      return snapshot;
    })
    .catch((e) => {
      snapshot = {
        dash: null,
        risks: [],
        authority: [],
        error: e instanceof Error ? e.message : "Could not load",
        loading: false,
      };
      return snapshot;
    })
    .finally(() => {
      inflight = null;
      emit();
    });
  return inflight;
}

/** Shared Rec Ops payload so checklist / gap / risk / authority tiles hit the API once. */
export function useRecreationOpsBoard(): RecreationOpsBoard {
  const board = useSyncExternalStore(subscribe, getSnapshot, () => EMPTY);
  useEffect(() => {
    void loadBoard();
  }, []);
  return board;
}
