import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Routines | Standards | Panorama",
  description: "Shift checklists and recurring routine templates for consistent operations.",
};

export default function StandardsRoutinesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
