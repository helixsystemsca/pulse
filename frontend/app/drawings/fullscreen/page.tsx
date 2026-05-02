"use client";

import dynamic from "next/dynamic";
import type { ComponentType } from "react";

const DrawingsPage = dynamic(
  (): Promise<ComponentType<{ fullscreen?: boolean }>> =>
    import("@/drawings/DrawingsPage").then((mod) => mod.default),
  { ssr: false },
);

export default function DrawingsFullscreenPage() {
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      <DrawingsPage fullscreen />
    </div>
  );
}
