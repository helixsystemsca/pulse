import type { Metadata } from "next";

/** Shown until the client sets `document.title` from the loaded project name. */
export const metadata: Metadata = {
  title: "Project kiosk",
};

export default function KioskProjectLayout({ children }: { children: React.ReactNode }) {
  return children;
}
