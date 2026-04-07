import { Cpu, Link2, Shield } from "lucide-react";

const items = [
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
] as const;

export function WhatWeBuildSection({ id }: { id?: string }) {
  return (
    <section id={id} className="scroll-mt-24 bg-helix-surface py-20">
      <div className="mx-auto max-w-7xl px-6">
        <p className="text-xs font-bold uppercase tracking-[0.15em] text-helix-primary">What we build</p>
        <h2 className="mt-3 max-w-2xl font-headline text-3xl font-extrabold tracking-tight text-helix-onSurface md:text-4xl">
          Products and patterns for real-world operations
        </h2>
        <p className="mt-4 max-w-2xl text-lg text-helix-onSurfaceVariant">
          Every engagement combines product, integration, and operator feedback—so capabilities land where they matter.
        </p>

        <div className="mt-12 grid gap-8 md:grid-cols-3 md:gap-12">
          {items.map(({ icon: Icon, title, description }) => (
            <div
              key={title}
              className="flex h-full flex-col rounded-md border border-helix-outline/15 bg-white p-6 shadow-md"
            >
              <div className="flex h-14 w-14 shrink-0 items-center justify-center self-start rounded-md bg-helix-bg text-helix-primary">
                <Icon className="h-7 w-7" strokeWidth={1.75} />
              </div>
              <h3 className="mt-5 font-headline text-xl font-bold text-helix-onSurface">{title}</h3>
              <p className="mt-3 flex-1 text-sm leading-relaxed text-helix-onSurface">{description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
