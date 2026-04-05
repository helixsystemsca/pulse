import type { LucideIcon } from "lucide-react";
import { Compass, Cog, Cpu, Link2, Rocket, Shield } from "lucide-react";

export const landingHero = {
  badge: "Helix Systems",
  h1Line1: "Industrial operations,",
  h1Accent: "made clear.",
  lead:
    "We partner with operators who run complex sites—manufacturing, terminals, logistics, and infrastructure. Helix bridges the gap between what happens on the ground and what your leadership needs to see.",
  ctaExplore: "Explore Pulse",
  ctaWhatWeBuild: "What we build",
  zoneStats: [
    { throughputPercent: 65 },
    { throughputPercent: 82 },
    { throughputPercent: 74 },
  ] as const,
  snapshotTitle: "Operations snapshot",
  snapshotBody:
    "Live roll-up across lines, bays, and shifts—without another spreadsheet export.",
  pulseBadge: "Real-time Pulse",
  pulseTitle: "Feed healthy · 124 nodes",
  pulseSub: "Streaming telemetry & workforce signals",
} as const;

export const howWeWork = {
  kicker: "How we work",
  title: "From first workshop to steady-state operations",
  lead: "A practical delivery model built for regulated and uptime-sensitive environments.",
  steps: [
    {
      Icon: Compass,
      title: "Discover & map",
      body: "We align on your sites, workflows, and constraints—so digital tools match how crews actually work.",
    },
    {
      Icon: Rocket,
      title: "Deploy with operators",
      body: "Roll out in phases with training and side-by-side validation. No big-bang cutovers on critical paths.",
    },
    {
      Icon: Cog,
      title: "Operate & improve",
      body: "Measure adoption, tune alerts, and extend integrations as your footprint grows.",
    },
  ] as const satisfies ReadonlyArray<{
    Icon: LucideIcon;
    title: string;
    body: string;
  }>,
} as const;

export const whatWeBuild = {
  kicker: "What we build",
  title: "Products and patterns for real-world operations",
  lead: "Every engagement combines product, integration, and operator feedback—so capabilities land where they matter.",
  items: [
    {
      icon: Cpu,
      title: "Field software",
      description:
        "Mobile-first workflows for check-ins, work execution, and sign-offs—built for gloves, glare, and imperfect connectivity.",
    },
    {
      icon: Link2,
      title: "Integration layer",
      description:
        "Connect PLCs, historians, gateways, and enterprise systems so operational truth isn’t trapped in a single silo.",
    },
    {
      icon: Shield,
      title: "Trust & governance",
      description:
        "Tenant boundaries, role-aware access, and audit-friendly event histories designed for industrial IT standards.",
    },
  ] as const satisfies ReadonlyArray<{
    icon: LucideIcon;
    title: string;
    description: string;
  }>,
} as const;

export const pulsePreview = {
  kicker: "Product",
  title: "Pulse",
  body:
    "Our flagship operational intelligence layer—workforce signals, asset state, maintenance, and inventory awareness in one coherent picture for the front line and the control room.",
  cta: "Learn more",
} as const;
