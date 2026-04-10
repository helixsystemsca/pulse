import { Compass, Rocket, Cog } from "lucide-react";

const steps = [
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
] as const;

export function HowWeWorkSection() {
  return (
    <section className="bg-white py-20">
      <div className="mx-auto max-w-7xl px-6">
        <p className="text-xs font-bold uppercase tracking-[0.15em] text-helix-primary">How we work</p>
        <h2 className="mt-3 max-w-2xl font-headline text-3xl font-extrabold tracking-tight text-helix-onSurface md:text-4xl">
          From first workshop to steady-state operations
        </h2>
        <p className="mt-4 max-w-2xl text-lg text-helix-onSurfaceVariant">
          A practical delivery model built for regulated and uptime-sensitive environments.
        </p>

        <div className="mt-12 grid gap-8 md:grid-cols-3 md:gap-12">
          {steps.map(({ Icon, title, body }, i) => (
            <div
              key={title}
              className="flex h-full flex-col rounded-md border border-helix-outline/20 bg-helix-bg p-6 shadow-sm"
            >
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-md bg-[#d5e4f5] text-helix-primary">
                <Icon className="h-6 w-6" strokeWidth={2} />
              </div>
              <p className="text-xs font-bold uppercase tracking-wide text-helix-primary/90">
                Step {i + 1}
              </p>
              <h3 className="mt-2 font-headline text-xl font-bold text-helix-onSurface">{title}</h3>
              <p className="mt-3 flex-1 text-sm leading-relaxed text-helix-onSurface">{body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
