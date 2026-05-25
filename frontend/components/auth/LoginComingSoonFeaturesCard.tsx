"use client";

import { Sparkles } from "lucide-react";
import { useCallback, useState } from "react";
import "./coming-soon-card.css";

export type UpcomingFeature = {
  icon: string;
  title: string;
  description: string;
};

const DEFAULT_FEATURES: UpcomingFeature[] = [
  {
    icon: "📱",
    title: "Mobile App",
    description: "iOS & Android apps for on-the-go management",
  },
  {
    icon: "🔐",
    title: "Microsoft SSO",
    description: "Seamless single sign-on with your Microsoft account",
  },
  {
    icon: "🔗",
    title: "Xplor Integration",
    description: "Direct sync with Xplor for unified operations",
  },
  {
    icon: "⚡",
    title: "SAP Integration",
    description: "Enterprise-grade ERP connectivity",
  },
];

type LoginComingSoonFeaturesCardProps = {
  features?: UpcomingFeature[];
  onNotify?: () => void | Promise<void>;
};

export function LoginComingSoonFeaturesCard({
  features = DEFAULT_FEATURES,
  onNotify,
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
    <div className="coming-soon-card" role="region" aria-label="Upcoming features">
      <div className="coming-soon-header">
        <div className="coming-soon-badge">
          <Sparkles className="h-3.5 w-3.5" aria-hidden />
          Coming Soon
        </div>
        <h2 className="coming-soon-title">Future Features</h2>
        <p className="coming-soon-subtitle">
          We&apos;re constantly improving. Here&apos;s what&apos;s on the horizon.
        </p>
      </div>

      <ul className="features-list">
        {features.map((feature, index) => (
          <li
            key={feature.title}
            className="feature-item"
            style={{ animationDelay: `${0.5 + index * 0.1}s` }}
          >
            <div className="feature-icon" aria-hidden>
              {feature.icon}
            </div>
            <div className="feature-content">
              <div className="feature-title">{feature.title}</div>
              <div className="feature-description">{feature.description}</div>
            </div>
          </li>
        ))}
      </ul>

      <div className="coming-soon-footer">
        <p className="notify-text">Want updates when features launch?</p>
        {!notified ? (
          <button type="button" className="notify-btn" onClick={() => void handleNotify()} aria-label="Subscribe to feature updates">
            Notify Me
          </button>
        ) : (
          <div className="notify-success" role="status">
            ✓ You&apos;ll be notified!
          </div>
        )}
      </div>
    </div>
  );
}
