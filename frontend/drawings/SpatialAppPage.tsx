"use client";

import { Suspense, useMemo } from "react";
import { useRouter } from "next/navigation";
import { InfrastructureWorkspaceView } from "@/drawings/DrawingsPage";
import { AdvertisingWorkspaceView } from "@/drawings/workspaces/AdvertisingWorkspaceView";
import {
  SpatialWorkspaceSwitcher,
  useSpatialWorkspaceAccess,
} from "@/spatial-engine/workspace";

function SpatialAppPageInner({ fullscreen = false }: { fullscreen?: boolean }) {
  const router = useRouter();
  const { accessibleWorkspaces, activeWorkspaceId, setActiveWorkspace, hasAnyWorkspace } =
    useSpatialWorkspaceAccess();

  const workspaceSwitcher = useMemo(
    () =>
      accessibleWorkspaces.length > 1 ? (
        <SpatialWorkspaceSwitcher
          workspaces={accessibleWorkspaces}
          activeId={activeWorkspaceId}
          onChange={setActiveWorkspace}
        />
      ) : null,
    [accessibleWorkspaces, activeWorkspaceId, setActiveWorkspace],
  );

  if (!hasAnyWorkspace || !activeWorkspaceId) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center px-6 text-center">
        <h1 className="text-lg font-semibold text-ds-foreground">Spatial editor</h1>
        <p className="mt-2 max-w-md text-sm text-ds-muted">
          You do not have access to any spatial workspaces. Ask your administrator for Drawings or Arena Advertising
          permissions.
        </p>
        <button
          type="button"
          className="mt-4 text-sm text-ds-accent underline"
          onClick={() => router.push("/overview")}
        >
          Back to overview
        </button>
      </div>
    );
  }

  if (activeWorkspaceId === "advertising") {
    return (
      <AdvertisingWorkspaceView
        workspaceSwitcher={workspaceSwitcher}
        immersive={!fullscreen}
        editorFullscreen={fullscreen}
      />
    );
  }

  if (activeWorkspaceId === "facilities" || activeWorkspaceId === "sensors") {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 px-6 text-center">
        {workspaceSwitcher}
        <h1 className="text-lg font-semibold text-ds-foreground">
          {activeWorkspaceId === "facilities" ? "Facilities" : "Sensors"} workspace
        </h1>
        <p className="max-w-md text-sm text-ds-muted">This workspace is coming soon in the unified spatial editor.</p>
      </div>
    );
  }

  return <InfrastructureWorkspaceView fullscreen={fullscreen} workspaceSwitcher={workspaceSwitcher} />;
}

export default function SpatialAppPage(props: { fullscreen?: boolean }) {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center text-sm text-ds-muted">Loading spatial editor…</div>
      }
    >
      <SpatialAppPageInner {...props} />
    </Suspense>
  );
}
