import { Inter } from "next/font/google";
import {
  AdminControlSection,
  EquipmentSetupTabletSection,
  Hero,
  InventoryAlertsSection,
  MaintenanceSection,
  MobileFeatureSection,
  PulseMarketingHeader,
  PulsePageIntro,
  ToolEquipmentTrackingSection,
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
      className={`${inter.className} min-h-full bg-pulse-bg text-pulse-navy antialiased [font-feature-settings:'liga'_1,'kern'_1]`}
    >
      <PulseMarketingHeader />
      <PulsePageIntro />
      <main>
        <Hero />
        <WorkRequestsFeatureSection />
        <ToolEquipmentTrackingSection />
        <EquipmentSetupTabletSection />
        <WorkforceSchedulingSection />
        <MobileFeatureSection />
        <AdminControlSection />
        <MaintenanceSection />
        <InventoryAlertsSection />
      </main>
    </div>
  );
}
