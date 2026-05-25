"use client";

import type { LucideIcon } from "lucide-react";
import { Link2, Shield, Smartphone, Sparkles, Zap, type LucideProps } from "lucide-react";
import { useCallback, useState } from "react";
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
    description: "iOS & Android for on-the-go management",
  },
  {
    Icon: Shield,
    title: "Microsoft SSO",
    description: "Sign-on with your Microsoft account",
  },
  {
    Icon: Link2,
    title: "Xplor Integration",
    description: "Sync with Xplor for unified ops",
  },
  {
    Icon: Zap,
    title: "SAP Integration",
    description: "Enterprise ERP connectivity",
  },
];

function FeatureIcon({ icon: Icon }: { icon: LucideIcon }) {
  const props: LucideProps = { className: "h-[18px] w-[18px] text-white", strokeWidth: 2, "aria-hidden": true };
  return <Icon {...props} />;
}

type LoginComingSoonFeaturesCardProps = {
  features?: UpcomingFeature[];
  onNotify?: () => void | Promise<void>;
  className?: string;
};

export function LoginComingSoonFeaturesCard({
  features = DEFAULT_FEATURES,
  onNotify,
  className,
}: LoginComingSoonFeaturesCardProps) {
  const [notified, setNotified] = useState(false);

  const handleNotify = useCallback(async () => {
    try {
      if (onNotify) {
        await onNotify();
      }
      setNotified(true);
      window.setTimeout(() => setNotified(false), 3000);
    } catch {
      /* parent may surface errors */
    }
  }, [onNotify]);

  return (
    <div
      className={cn("coming-soon-card coming-soon-card--dock-left", className)}
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

      <div className="coming-soon-footer">
        <p className="notify-text">Get launch updates?</p>
        {!notified ? (
          <button
            type="button"
            className="notify-btn"
            onClick={() => void handleNotify()}
            aria-label="Subscribe to feature updates"
          >
            Notify Me
          </button>
        ) : (
          <div className="notify-success" role="status">
            ✓ Notified
          </div>
        )}
      </div>
    </div>
  );
}
