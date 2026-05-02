import type { Metadata } from "next";
import type { ReactNode } from "react";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { absolute: "Drawings | Pulse" },
  description: "Multi-system infrastructure overlays on facility maps.",
};

/** Shared segment layout only — shell chrome lives in `(main)/layout.tsx`. */
export default function DrawingsLayout({ children }: { children: ReactNode }) {
  return children;
}
