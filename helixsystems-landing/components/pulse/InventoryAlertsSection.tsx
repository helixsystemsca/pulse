import { Bell, Clock, MapPinOff, Radar } from "lucide-react";
import { FeatureCard } from "./FeatureCard";
import { SectionWrapper } from "./SectionWrapper";

export function InventoryAlertsSection() {
  return (
    <SectionWrapper id="inventory" className="scroll-mt-24 bg-pulse-section" showMobileSeparator>
      <div className="flex flex-col items-center gap-10 md:gap-12">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-3xl font-bold leading-tight tracking-tight text-pulse-navy md:text-4xl lg:text-[2.35rem]">
            Catch problems early.
          </h2>
          <p className="mt-6 text-lg leading-relaxed text-pulse-muted">
            Get notified when something needs attention.
          </p>
        </div>

        <div className="grid w-full max-w-7xl grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <FeatureCard
            icon={MapPinOff}
            title="Alerts for missing equipment"
            description="Unreturned or misplaced tools raise a flag before the job packs up and goes home."
            variant="alert"
            iconClassName="text-ds-danger"
          />
          <FeatureCard
            icon={Bell}
            title="Notifications for issues or delays"
            description="Stuck work, SLA risk, and handoff gaps surface to the right supervisor."
          />
          <FeatureCard
            icon={Radar}
            title="Inactive or offline zones"
            description="Beacons or areas that stop reporting show up so you can send someone to fix the link."
          />
          <FeatureCard
            icon={Clock}
            title="Keep operations running smoothly"
            description="Fewer surprises on the floor—teams fix small problems before they chain into big ones."
          />
        </div>
      </div>
    </SectionWrapper>
  );
}
