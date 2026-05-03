import type { Metadata } from "next";
import { MarketingBlueprintPlayground } from "@/components/site/MarketingBlueprintPlayground";
import { HelixFooter } from "@/components/site/HelixFooter";
import { HelixNavbar } from "@/components/site/HelixNavbar";

export const metadata: Metadata = {
  title: { absolute: "Blueprint playground | Panorama" },
  description:
    "Try the Pulse floor plan editor: draw rooms, place devices and doors, and export PNG or PDF. Sign in on Pulse to save layouts to your organization.",
};

export default function MarketingBlueprintPage() {
  return (
    <>
      <HelixNavbar />
      <main className="min-h-[100dvh] bg-helix-bg">
        <MarketingBlueprintPlayground />
      </main>
      <HelixFooter />
    </>
  );
}
