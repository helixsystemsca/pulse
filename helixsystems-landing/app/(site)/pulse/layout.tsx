import type { Metadata } from "next";

export const metadata: Metadata = {
  title: { absolute: "Pulse | by Helix Systems" },
  description:
    "Pulse helps you track tools, manage work, and align your team—work requests, equipment, scheduling, mobile field use, and alerts in one system.",
};

export default function PulseLayout({ children }: { children: React.ReactNode }) {
  return children;
}
