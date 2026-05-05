import type { Metadata } from "next";

export const metadata: Metadata = {
  title: { absolute: "Work Requests | Panorama" },
  description: "Work request hub — triage, categories, and preventative scheduling.",
};

export default function MaintenanceLayout({ children }: { children: React.ReactNode }) {
  return <div className="w-full">{children}</div>;
}
