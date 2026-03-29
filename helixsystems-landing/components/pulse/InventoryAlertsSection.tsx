import { Bug, Cloud, Settings2 } from "lucide-react";
import { FeatureCard } from "./FeatureCard";
import { SectionWrapper } from "./SectionWrapper";

export function InventoryAlertsSection() {
  return (
    <SectionWrapper className="bg-pulse-bg">
      <div className="grid items-start gap-12 lg:grid-cols-2 lg:gap-14">
        <div>
          <h2 className="text-3xl font-bold leading-tight tracking-tight text-pulse-navy md:text-4xl lg:text-[2.35rem]">
            Smart Tracking &amp;
            <br />
            <span className="text-pulse-accent">Real-Time Alerts</span>
          </h2>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-pulse-muted">
            Know where your tools and assets are at all times, with intelligent alerts when something
            is out of place or needs attention.
          </p>
          <div className="mt-8 rounded-2xl border border-pulse-border bg-slate-100/80 p-6 shadow-inner">
            <p className="text-sm leading-relaxed text-pulse-navy">
              Operations teams using unified tracking and escalation rules report fewer unplanned
              events tied to missing or misplaced production assets—especially across handoffs and
              contractor windows.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-5">
          <FeatureCard
            icon={Settings2}
            title="Automated Tracking"
            description="Tag-based presence, zone rules, and issuance history roll up to one operational picture—without spreadsheet gymnastics."
          />
          <FeatureCard
            icon={Bug}
            title="Severity-Based Alerts"
            description="Critical exceptions break through immediately; informational drift queues for the shift review—so signal isn’t lost in noise."
            variant="alert"
            iconClassName="text-red-500"
          />
          <FeatureCard
            icon={Cloud}
            title="Ops Cloud Sync"
            description="Field gateways, scanners, and the Pulse web app share the same tenant boundary—TLS end-to-end, built for industrial scale."
          />
        </div>
      </div>
    </SectionWrapper>
  );
}
