"use client";

import type { LucideIcon } from "lucide-react";
import { Link2, RadarIcon, Shield, Smartphone, Sparkles, Zap, type LucideProps } from "lucide-react";
import { cn } from "@/lib/cn";
import "./coming-soon-card.css";

export type UpcomingFeature = {
  Icon: LucideIcon;
  title: string;
  description: string;
};

const DEFAULT_FEATURES: UpcomingFeature[] = [
  {
    Icon: Smartphone,
    title: "Mobile App",
    description: "iOS & Android for on the go access to operational tools",
  },
  {
    Icon: Shield,
    title: "Microsoft SSO",
    description: "Sign-on with your Microsoft account",
  },
  {
    Icon: Link2,
    title: "Xplor Integration",
    description: "Sync with Xplor for integrated facilityschedules",
  },
  {
    Icon: Zap,
    title: "SAP Integration",
    description: "Enterprise ERP connectivity",
  },
  {
    Icon: RadarIcon,
    title: "Telemetry",
    description: "Track equipment for asset management and automation",
  },
];

function FeatureIcon({ icon: Icon }: { icon: LucideIcon }) {
  const props: LucideProps = { className: "h-[18px] w-[18px] text-white", strokeWidth: 2, "aria-hidden": true };
  return <Icon {...props} />;
}

type LoginComingSoonFeaturesCardProps = {
  features?: UpcomingFeature[];
  className?: string;
  /** When true, runs dock + feature stagger CSS animations (after login intro sequence). */
  playAnimation?: boolean;
};

export function LoginComingSoonFeaturesCard({
  features = DEFAULT_FEATURES,
  className,
  playAnimation = false,
}: LoginComingSoonFeaturesCardProps) {
  return (
    <div
      className={cn(
        "coming-soon-card coming-soon-card--dock-left",
        playAnimation && "coming-soon-card--play",
        className,
      )}
      role="region"
      aria-label="Upcoming features"
    >
      <div className="coming-soon-header">
        <div className="coming-soon-badge">
          <Sparkles className="h-3 w-3 shrink-0" aria-hidden />
          <span>Soon</span>
        </div>
        <h2 className="coming-soon-title">Future Features</h2>
        <p className="coming-soon-subtitle">What&apos;s on the horizon.</p>
      </div>

      <ul className="features-list">
        {features.map((feature, index) => (
          <li
            key={feature.title}
            className="feature-item"
            style={{ animationDelay: `${0.5 + index * 0.1}s` }}
          >
            <div className="feature-icon">
              <FeatureIcon icon={feature.Icon} />
            </div>
            <div className="feature-content">
              <div className="feature-title">{feature.title}</div>
              <div className="feature-description">{feature.description}</div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
