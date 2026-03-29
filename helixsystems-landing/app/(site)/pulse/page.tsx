import { Inter } from "next/font/google";
import {
  AdminControlSection,
  EquipmentSetupTabletSection,
  Hero,
  InventoryAlertsSection,
  MaintenanceSection,
  MobileFeatureSection,
  PulsePageIntro,
  WorkforceSchedulingSection,
  WorkRequestsFeatureSection,
} from "@/components/pulse";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
});

export default function PulseProductPage() {
  return (
    <div
      className={`${inter.className} min-h-screen bg-pulse-bg text-pulse-navy antialiased [font-feature-settings:'liga'_1,'kern'_1]`}
    >
      <PulsePageIntro />
      <main>
        <Hero />
        <MobileFeatureSection />
        <EquipmentSetupTabletSection />
        <AdminControlSection />
        <WorkforceSchedulingSection />
        <WorkRequestsFeatureSection />
        <MaintenanceSection />
        <InventoryAlertsSection />
      </main>
    </div>
  );
}
