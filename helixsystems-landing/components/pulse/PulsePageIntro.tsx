export function PulsePageIntro() {
  return (
    <section className="border-b border-pulse-border bg-white px-6 py-12 md:py-14">
      <div className="mx-auto max-w-7xl">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-pulse-accent">
          Helix Systems Product
        </p>
        <h1 className="mt-3 font-headline text-3xl font-extrabold tracking-tight text-pulse-navy md:text-4xl lg:text-5xl">
          Pulse
        </h1>
        <p className="mt-4 max-w-3xl text-lg leading-relaxed text-pulse-muted md:text-xl">
          Work, tools, schedules, and alerts share one backbone—scoped by company and role so people only touch what
          belongs to them.
        </p>

        <div className="mt-10 border-t border-pulse-border pt-10">
          <h2 className="text-sm font-bold uppercase tracking-wider text-pulse-navy">Core features</h2>
          <ul className="mt-4 grid max-w-3xl gap-3 text-base leading-relaxed text-pulse-muted sm:grid-cols-2 lg:grid-cols-3">
            <li className="rounded-lg border border-pulse-border bg-slate-50/80 px-4 py-3">
              <span className="font-semibold text-pulse-navy">Multi-company support</span>
              <span className="mt-1 block text-sm">
                Run separate companies in one install—data stays partitioned by tenant.
              </span>
            </li>
            <li className="rounded-lg border border-pulse-border bg-slate-50/80 px-4 py-3">
              <span className="font-semibold text-pulse-navy">Role-based access</span>
              <span className="mt-1 block text-sm">Admin, manager, and worker roles—each with the right reach.</span>
            </li>
            <li className="rounded-lg border border-pulse-border bg-slate-50/80 px-4 py-3 sm:col-span-2 lg:col-span-1">
              <span className="font-semibold text-pulse-navy">Secure sign-in &amp; invites</span>
              <span className="mt-1 block text-sm">Password login plus invite-only onboarding—no open self-serve signup.</span>
            </li>
          </ul>
        </div>
      </div>
    </section>
  );
}
