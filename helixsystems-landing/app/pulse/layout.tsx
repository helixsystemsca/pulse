import type { Metadata } from "next";

export const metadata: Metadata = {
  title: { absolute: "Pulse | by Helix Systems" },
  description:
    "Pulse helps you track tools, manage work, and align your team—work requests, equipment, scheduling, mobile field use, and alerts in one system.",
};

/** Marketing product page only — no app chrome (sidebar/navbar). */
export default function PulseProductLayout({ children }: { children: React.ReactNode }) {
  return children;
}
