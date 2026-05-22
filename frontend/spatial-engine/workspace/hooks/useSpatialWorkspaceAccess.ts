"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { readSession } from "@/lib/pulse-session";
import {
  canAccessSpatialWorkspace,
  listAccessibleSpatialWorkspaces,
  parseSpatialWorkspaceParam,
  resolveDefaultSpatialWorkspace,
} from "@/spatial-engine/workspace/access";
import type { SpatialWorkspaceId } from "@/spatial-engine/workspace/types";

const WORKSPACE_QUERY_KEY = "workspace";

export function useSpatialWorkspaceAccess() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [sessionTick, setSessionTick] = useState(0);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key?.includes("pulse") || e.key == null) setSessionTick((t) => t + 1);
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const session = useMemo(() => {
    void sessionTick;
    return readSession();
  }, [sessionTick]);

  const accessibleWorkspaces = useMemo(() => listAccessibleSpatialWorkspaces(session), [session]);

  const requestedId = parseSpatialWorkspaceParam(searchParams.get(WORKSPACE_QUERY_KEY));

  const activeWorkspaceId = useMemo(() => {
    return resolveDefaultSpatialWorkspace(session, requestedId);
  }, [requestedId, session]);

  const setActiveWorkspace = useCallback(
    (id: SpatialWorkspaceId) => {
      if (!canAccessSpatialWorkspace(session, id)) return;
      const params = new URLSearchParams(searchParams.toString());
      params.set(WORKSPACE_QUERY_KEY, id);
      const qs = params.toString();
      router.replace(qs ? `?${qs}` : "", { scroll: false });
    },
    [router, searchParams, session],
  );

  return {
    session,
    accessibleWorkspaces,
    activeWorkspaceId,
    setActiveWorkspace,
    hasAnyWorkspace: accessibleWorkspaces.length > 0,
  };
}

export function spatialWorkspaceHref(id: SpatialWorkspaceId, basePath = "/drawings"): string {
  return `${basePath}?workspace=${id}`;
}

/** Fullscreen spatial editor (no app nav shell) — open in a new tab for arena advertising, etc. */
export function spatialWorkspaceFullscreenHref(id: SpatialWorkspaceId): string {
  return spatialWorkspaceHref(id, "/drawings/fullscreen");
}
