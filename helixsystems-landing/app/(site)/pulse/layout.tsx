import type { Metadata } from "next";

export const metadata: Metadata = {
  title: { absolute: "Pulse | by Helix Systems" },
  description:
    "Pulse is Helix Systems' operational intelligence platform—connecting your field operations, assets, and teams in real time.",
};

export default function PulseLayout({ children }: { children: React.ReactNode }) {
  return children;
}
