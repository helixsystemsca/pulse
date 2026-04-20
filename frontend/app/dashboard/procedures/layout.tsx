import type { Metadata } from "next";

export const metadata: Metadata = {
  title: { absolute: "Procedures | Pulse" },
  description: "Reusable maintenance procedures with numbered steps and optional photos.",
};

export default function ProceduresLayout({ children }: { children: React.ReactNode }) {
  return children;
}
