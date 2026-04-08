import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { landingHero, howWeWork, pulsePreview, whatWeBuild } from "@/components/landing-variants/landingContent";
import { LandingVariantNavbar } from "@/components/landing-variants/LandingVariantNavbar";
import { HeroDemoPanel } from "@/components/landing-variants/parts/HeroDemoPanel";
import { ContactSection } from "@/components/site/ContactSection";
import { HelixFooter } from "@/components/site/HelixFooter";

export function LandingVariantB({ homePath }: { homePath: string }) {
  return (
    <>
      <LandingVariantNavbar preset="b" homePath={homePath} />
      <main className="min-h-screen bg-[#2c3a55] text-white">
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-[#2c3a55] via-[#354766] to-[#2c3a55]" />
          <div className="absolute -left-24 top-0 h-72 w-72 rounded-full bg-cyan-500/15 blur-3xl" />
          <div className="absolute -right-24 bottom-0 h-96 w-96 rounded-full bg-teal-400/10 blur-3xl" />

          <div className="relative mx-auto max-w-7xl px-6 pb-20 pt-12 md:pb-28 md:pt-16">
            <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 backdrop-blur-md">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-cyan-300" />
                  <span className="text-xs font-bold uppercase tracking-[0.14em] text-cyan-200">
                    {landingHero.badge}
                  </span>
                </div>

                <h1 className="mt-6 font-headline text-4xl font-extrabold leading-[1.06] tracking-tight md:text-5xl lg:text-[3.25rem]">
                  {landingHero.h1Line1}
                  <br />
                  <span className="bg-gradient-to-r from-cyan-200 to-teal-200 bg-clip-text text-transparent">
                    {landingHero.h1Accent}
                  </span>
                </h1>

                <p className="mt-6 max-w-xl text-lg leading-relaxed text-slate-300">{landingHero.lead}</p>

                <div className="mt-8 flex flex-wrap items-center gap-4">
                  <Link
                    href="/pulse"
                    className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-cyan-400 to-teal-400 px-8 py-4 font-headline text-base font-bold text-slate-950 shadow-lg shadow-cyan-500/20 transition-all duration-200 hover:scale-[1.02] hover:shadow-xl no-underline"
                  >
                    {landingHero.ctaExplore}
                    <ArrowRight className="h-5 w-5" />
                  </Link>
                  <a
                    href={`${homePath}#products`}
                    className="inline-flex items-center rounded-full border border-white/15 bg-white/5 px-8 py-4 font-headline text-base font-bold text-white backdrop-blur-md transition-all duration-200 hover:scale-[1.02] hover:border-white/25 hover:bg-white/10 no-underline"
                  >
                    {landingHero.ctaWhatWeBuild}
                  </a>
                </div>
              </div>

              <div className="rounded-3xl border border-white/10 bg-white/5 p-4 shadow-[0_20px_80px_rgba(0,0,0,0.45)] backdrop-blur-xl md:p-5">
                <HeroDemoPanel
                  floatingTone="dark"
                  gradientClassName="from-[#354766] via-[#3f5274] to-[#354766]"
                  floatingCardClassName="border-white/10 bg-[#2c3a55]/75 backdrop-blur-xl"
                  floatingWrapClassName="md:left-6"
                  frameClassName="ring-white/10"
                />
              </div>
            </div>
          </div>
        </section>

        <section className="relative z-10 -mt-12 px-6 pb-16 md:-mt-16 md:pb-24">
          <div className="mx-auto max-w-7xl">
            <p className="text-xs font-bold uppercase tracking-[0.15em] text-cyan-200">{howWeWork.kicker}</p>
            <h2 className="mt-4 max-w-2xl font-headline text-3xl font-extrabold tracking-tight text-white md:text-4xl">
              {howWeWork.title}
            </h2>
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-slate-300">{howWeWork.lead}</p>

            <div className="mt-12 grid gap-6 md:grid-cols-3">
              {howWeWork.steps.map(({ Icon, title, body }, i) => (
                <div
                  key={title}
                  className="rounded-md border border-white/10 bg-white/5 p-8 shadow-[0_16px_50px_rgba(0,0,0,0.35)] backdrop-blur-xl transition-all duration-200 hover:scale-[1.02] hover:border-cyan-300/25 hover:shadow-[0_22px_70px_rgba(34,211,238,0.12)]"
                >
                  <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-md bg-cyan-400/15 text-cyan-200 ring-1 ring-cyan-300/20">
                    <Icon className="h-6 w-6" strokeWidth={2} />
                  </div>
                  <p className="text-xs font-bold uppercase tracking-wide text-cyan-200/90">Step {i + 1}</p>
                  <h3 className="mt-2 font-headline text-xl font-bold text-white">{title}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-slate-300">{body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="products" className="scroll-mt-24 border-t border-white/10 bg-[#354766]/50 py-20 md:py-28">
          <div className="mx-auto max-w-7xl px-6">
            <p className="text-xs font-bold uppercase tracking-[0.15em] text-cyan-200">{whatWeBuild.kicker}</p>
            <h2 className="mt-4 max-w-2xl font-headline text-3xl font-extrabold tracking-tight text-white md:text-4xl">
              {whatWeBuild.title}
            </h2>
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-slate-300">{whatWeBuild.lead}</p>

            <div className="mt-14 grid gap-8 lg:grid-cols-3">
              {whatWeBuild.items.map(({ icon: Icon, title, description }) => (
                <div
                  key={title}
                  className="flex h-full flex-col rounded-md border border-white/10 bg-white/5 p-8 shadow-[0_14px_40px_rgba(0,0,0,0.35)] backdrop-blur-md transition-all duration-200 hover:scale-[1.02] hover:shadow-[0_20px_55px_rgba(0,0,0,0.45)]"
                >
                  <div className="flex h-14 w-14 items-center justify-center rounded-md bg-[#2c3a55]/45 text-cyan-200 ring-1 ring-white/10">
                    <Icon className="h-7 w-7" strokeWidth={1.75} />
                  </div>
                  <h3 className="mt-6 font-headline text-xl font-bold text-white">{title}</h3>
                  <p className="mt-3 flex-1 text-sm leading-relaxed text-slate-300">{description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="py-20 md:py-28">
          <div className="mx-auto max-w-7xl px-6">
            <div className="mx-auto max-w-2xl rounded-3xl border border-white/10 bg-white/5 p-10 text-center shadow-[0_20px_70px_rgba(0,0,0,0.4)] backdrop-blur-xl md:p-12">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-200">{pulsePreview.kicker}</p>
              <h2 className="mt-4 font-headline text-3xl font-extrabold tracking-tight text-white md:text-4xl">
                {pulsePreview.title}
              </h2>
              <p className="mt-5 text-lg leading-relaxed text-slate-300">{pulsePreview.body}</p>
              <Link
                href="/pulse"
                className="mt-9 inline-flex items-center gap-2 rounded-full bg-white px-7 py-3 text-sm font-semibold text-slate-950 shadow-lg transition-all duration-200 hover:scale-[1.02] hover:shadow-xl no-underline"
              >
                {pulsePreview.cta}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </section>

        <ContactSection
          id="contact"
          classNames={{
            section:
              "border-t border-white/10 bg-[#2c3a55] py-20 md:py-28 text-white bg-gradient-to-b from-[#2c3a55] to-[#354766]",
            kicker: "text-cyan-200",
            heading: "text-white",
            lead: "text-slate-300",
            mailtoLink: "text-cyan-200 hover:underline",
            form: "border-white/10 bg-white/5 shadow-[0_18px_60px_rgba(0,0,0,0.35)] backdrop-blur-xl",
            label: "text-slate-200",
            input:
              "border-white/15 bg-[#2c3a55]/40 text-white placeholder:text-slate-500 focus:border-cyan-400 focus:ring-cyan-400/20",
            textarea:
              "border-white/15 bg-[#2c3a55]/40 text-white placeholder:text-slate-500 focus:border-cyan-400 focus:ring-cyan-400/20",
            submit:
              "rounded-full bg-gradient-to-r from-cyan-400 to-teal-400 text-slate-950 shadow-lg hover:from-cyan-300 hover:to-teal-300 hover:scale-[1.02] transition-transform font-bold",
          }}
        />

        <HelixFooter
          classNames={{
            footer: "border-white/10 bg-[#2c3a55]",
            inner: "text-white",
            brand: "text-white",
            tagline: "text-slate-400",
            link: "text-slate-400 hover:text-cyan-200",
            pulseLink: "text-cyan-200 hover:underline",
            copyright: "text-slate-500",
          }}
        />
      </main>
    </>
  );
}
