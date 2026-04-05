import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { landingHero, howWeWork, pulsePreview, whatWeBuild } from "@/components/landing-variants/landingContent";
import { LandingVariantNavbar } from "@/components/landing-variants/LandingVariantNavbar";
import { HeroDemoPanel } from "@/components/landing-variants/parts/HeroDemoPanel";
import { ContactSection } from "@/components/site/ContactSection";
import { HelixFooter } from "@/components/site/HelixFooter";

const accent = "text-helix-primary";

export function LandingVariantD({ homePath }: { homePath: string }) {
  return (
    <>
      <LandingVariantNavbar preset="d" homePath={homePath} />
      <main className="min-h-screen bg-slate-50 text-slate-900">
        <section className="relative overflow-hidden pb-16 pt-12 md:pb-24 md:pt-16">
          <div className="pointer-events-none absolute -right-24 top-10 h-72 w-72 rounded-full bg-helix-primary/10 blur-3xl" />
          <div className="pointer-events-none absolute -left-16 bottom-0 h-64 w-64 rounded-full bg-sky-200/40 blur-3xl" />

          <div className="relative mx-auto max-w-7xl px-6">
            <div className="grid gap-8 lg:grid-cols-12 lg:gap-6 lg:items-stretch">
              <div className="lg:col-span-5">
                <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 shadow-sm">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-helix-primary" />
                  <span className="text-xs font-bold uppercase tracking-[0.14em] text-helix-primary">
                    {landingHero.badge}
                  </span>
                </div>

                <h1 className="mt-5 font-headline text-4xl font-extrabold leading-[1.06] tracking-tight md:text-5xl lg:text-[3.1rem]">
                  {landingHero.h1Line1}
                  <br />
                  <span className={accent}>{landingHero.h1Accent}</span>
                </h1>

                <p className="mt-6 max-w-xl text-lg leading-relaxed text-slate-600">{landingHero.lead}</p>

                <div className="mt-8 flex flex-wrap items-center gap-3">
                  <Link
                    href="/pulse"
                    className="inline-flex items-center gap-2 rounded-full bg-helix-primary px-8 py-4 font-headline text-base font-bold text-white shadow-[0_14px_40px_rgba(48,86,139,0.25)] transition-all duration-200 hover:scale-[1.02] hover:bg-helix-primary-dim hover:shadow-[0_18px_50px_rgba(48,86,139,0.3)] no-underline"
                  >
                    {landingHero.ctaExplore}
                    <ArrowRight className="h-5 w-5" />
                  </Link>
                  <a
                    href={`${homePath}#products`}
                    className="inline-flex items-center rounded-full border border-slate-200 bg-white px-8 py-4 font-headline text-base font-bold text-slate-900 shadow-sm transition-all duration-200 hover:scale-[1.02] hover:shadow-md no-underline"
                  >
                    {landingHero.ctaWhatWeBuild}
                  </a>
                </div>

              </div>

              <div className="relative lg:col-span-7">
                <div className="absolute -inset-3 -z-10 rounded-[32px] bg-gradient-to-br from-white via-slate-100 to-slate-200/60 shadow-[0_24px_80px_rgba(15,23,42,0.12)]" />
                <div className="rounded-[28px] border border-slate-200/70 bg-white p-4 shadow-[0_20px_70px_rgba(15,23,42,0.12)] md:p-6">
                  <HeroDemoPanel
                    frameClassName="md:max-w-none"
                    floatingWrapClassName="md:left-8"
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="relative z-10 -mt-6 px-6 pb-16 md:-mt-8 md:pb-24">
          <div className="mx-auto max-w-7xl rounded-[28px] border border-slate-200/70 bg-white p-8 shadow-[0_18px_60px_rgba(15,23,42,0.08)] md:p-10">
            <p className="text-xs font-bold uppercase tracking-[0.15em] text-helix-primary">{howWeWork.kicker}</p>
            <div className="mt-4 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
              <h2 className="max-w-2xl font-headline text-3xl font-extrabold tracking-tight md:text-4xl">
                {howWeWork.title}
              </h2>
              <p className="max-w-xl text-sm leading-relaxed text-slate-600 md:text-base md:text-right">{howWeWork.lead}</p>
            </div>

            <div className="mt-10 grid gap-4 md:grid-cols-3">
              {howWeWork.steps.map(({ Icon, title, body }, i) => (
                <div
                  key={title}
                  className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-slate-50 p-6 shadow-[0_10px_30px_rgba(15,23,42,0.05)] transition-all duration-200 hover:scale-[1.02] hover:shadow-[0_16px_45px_rgba(15,23,42,0.1)] md:p-7"
                >
                  <p className="absolute right-4 top-3 text-4xl font-black text-slate-200/80">{String(i + 1).padStart(2, "0")}</p>
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white text-helix-primary shadow-sm ring-1 ring-slate-200/80">
                    <Icon className="h-6 w-6" strokeWidth={2} />
                  </div>
                  <p className="mt-5 text-xs font-bold uppercase tracking-wide text-helix-primary">Step {i + 1}</p>
                  <h3 className="mt-2 font-headline text-lg font-bold text-slate-900">{title}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-slate-600">{body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="products" className="scroll-mt-24 px-6 py-16 md:py-24">
          <div className="mx-auto max-w-7xl">
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.15em] text-helix-primary">{whatWeBuild.kicker}</p>
                <h2 className="mt-3 max-w-2xl font-headline text-3xl font-extrabold tracking-tight md:text-4xl">
                  {whatWeBuild.title}
                </h2>
              </div>
              <p className="max-w-xl text-base leading-relaxed text-slate-600 md:text-right">{whatWeBuild.lead}</p>
            </div>

            <div className="mt-10 grid gap-4 lg:grid-cols-12">
              {whatWeBuild.items.map(({ icon: Icon, title, description }) => (
                <div
                  key={title}
                  className="rounded-[24px] border border-slate-200/80 bg-white p-7 shadow-[0_14px_40px_rgba(15,23,42,0.07)] transition-all duration-200 hover:scale-[1.01] hover:shadow-[0_20px_55px_rgba(15,23,42,0.1)] lg:col-span-4"
                >
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-helix-bg text-helix-primary ring-1 ring-slate-200/60">
                    <Icon className="h-7 w-7" strokeWidth={1.75} />
                  </div>
                  <h3 className="mt-5 font-headline text-xl font-bold text-slate-900">{title}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-slate-600">{description}</p>
                </div>
              ))}

              <div className="rounded-[24px] border border-slate-200/80 bg-gradient-to-br from-helix-primary/10 via-white to-slate-50 p-8 shadow-[0_14px_40px_rgba(15,23,42,0.07)] lg:col-span-12">
                <div className="grid gap-8 lg:grid-cols-12 lg:items-center">
                  <div className="lg:col-span-7">
                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-helix-primary">{pulsePreview.kicker}</p>
                    <h2 className="mt-3 font-headline text-3xl font-extrabold tracking-tight text-slate-900 md:text-4xl">
                      {pulsePreview.title}
                    </h2>
                    <p className="mt-4 text-lg leading-relaxed text-slate-600">{pulsePreview.body}</p>
                  </div>
                  <div className="lg:col-span-5 lg:flex lg:justify-end">
                    <Link
                      href="/pulse"
                      className="inline-flex items-center gap-2 rounded-full bg-helix-primary px-8 py-4 text-sm font-semibold text-white shadow-md transition-all duration-200 hover:scale-[1.02] hover:bg-helix-primary-dim hover:shadow-lg no-underline"
                    >
                      {pulsePreview.cta}
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <ContactSection
          id="contact"
          classNames={{
            section: "bg-white py-16 md:py-24",
            form: "rounded-[28px] border-slate-200/80 shadow-[0_18px_60px_rgba(15,23,42,0.08)]",
            input: "rounded-xl",
            textarea: "rounded-xl",
            submit: "rounded-full hover:scale-[1.02] transition-transform duration-200 shadow-md",
          }}
        />

        <HelixFooter
          classNames={{
            footer: "border-slate-200/70 bg-slate-50 shadow-[0_-10px_40px_rgba(15,23,42,0.04)]",
          }}
        />
      </main>
    </>
  );
}
