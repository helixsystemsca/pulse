import { MapPin, Package, Radar, Wrench } from "lucide-react";
import { FeatureCard } from "./FeatureCard";
import { SectionWrapper } from "./SectionWrapper";

export function ToolEquipmentTrackingSection() {
  return (
    <SectionWrapper id="tool-tracking" className="scroll-mt-24 bg-white/60">
      <div className="grid items-start gap-12 lg:grid-cols-2 lg:gap-14">
        <div>
          <h2 className="text-3xl font-bold leading-tight tracking-tight text-pulse-navy md:text-4xl lg:text-[2.35rem]">
            Know where your tools are.
          </h2>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-pulse-muted">
            Track equipment across zones, jobs, and crews without manual checks.
          </p>
        </div>

        <div className="flex flex-col gap-5">
          <FeatureCard
            icon={Radar}
            title="Track tools and equipment in real time"
            description="Check-outs, returns, and moves update the record as people work—no end-of-shift guessing."
          />
          <FeatureCard
            icon={Package}
            title="See what is in use, missing, or idle"
            description="Status stays tied to each asset so supervisors know what should be on the floor."
          />
          <FeatureCard
            icon={MapPin}
            title="Assign tools to workers or locations"
            description="Park gear with a person, a zone, or a job number so the chain of custody is clear."
          />
          <FeatureCard
            icon={Wrench}
            title="Cut down lost or misplaced equipment"
            description="Fewer walkabouts hunting for tools—exceptions surface in the app instead of in hallway conversations."
          />
        </div>
      </div>
    </SectionWrapper>
  );
}
