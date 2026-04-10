import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { landingHero, howWeWork, pulsePreview, whatWeBuild } from "@/components/landing-variants/landingContent";
import { LandingVariantNavbar } from "@/components/landing-variants/LandingVariantNavbar";
import { HeroDemoPanel } from "@/components/landing-variants/parts/HeroDemoPanel";
import { ContactSection } from "@/components/site/ContactSection";
import { HelixFooter } from "@/components/site/HelixFooter";

export function LandingVariantA({ homePath }: { homePath: string }) {
  return (
    <>
      <LandingVariantNavbar preset="a" homePath={homePath} />
      <main className="min-h-screen bg-[#f7f3eb] text-stone-900">
        <section className="overflow-x-clip py-16 md:py-24">
          <div className="mx-auto grid max-w-7xl items-center gap-12 px-6 md:grid-cols-2 lg:gap-16">
            <div className="order-2 min-w-0 md:order-1">
              <div className="inline-flex items-center gap-2 rounded-full border border-stone-200 bg-white/80 px-4 py-1.5 shadow-sm">
                <span className="h-2 w-2 animate-pulse rounded-full bg-amber-600" />
                <span className="text-xs font-bold uppercase tracking-[0.14em] text-amber-800">
                  {landingHero.badge}
                </span>
              </div>

              <h1 className="mt-6 font-headline text-4xl font-extrabold leading-[1.06] tracking-tight md:text-5xl lg:text-[3.25rem]">
                {landingHero.h1Line1}
                <br />
                <span className="text-stone-700">{landingHero.h1Accent}</span>
              </h1>

              <p className="mt-6 max-w-xl text-lg leading-relaxed text-stone-600">{landingHero.lead}</p>

              <div className="mt-8 flex flex-wrap items-center gap-4">
                <Link
                  href="/pulse"
                  className="inline-flex items-center gap-2 rounded-full bg-stone-900 px-8 py-4 font-headline text-base font-bold text-[#f7f3eb] shadow-[0_12px_30px_rgba(28,25,23,0.15)] transition-all duration-200 hover:scale-[1.02] hover:shadow-[0_16px_40px_rgba(28,25,23,0.18)] no-underline"
                >
                  {landingHero.ctaExplore}
                  <ArrowRight className="h-5 w-5" />
                </Link>
                <a
                  href={`${homePath}#products`}
                  className="inline-flex items-center rounded-full border border-stone-300 bg-white px-8 py-4 font-headline text-base font-bold text-stone-900 transition-all duration-200 hover:scale-[1.02] hover:border-stone-400 hover:shadow-md no-underline"
                >
                  {landingHero.ctaWhatWeBuild}
                </a>
              </div>
            </div>

            <div className="order-1 md:order-2">
              <div className="rounded-[28px] border border-stone-200/80 bg-white p-4 shadow-[0_20px_60px_rgba(28,25,23,0.08)] md:p-5">
                <HeroDemoPanel
                  frameClassName="md:max-w-none"
                  gradientClassName="from-stone-100 via-white to-[#f7f3eb]"
                  floatingWrapClassName="md:left-6"
                  floatingCardClassName="border-stone-200/60 bg-white/95"
                />
              </div>
            </div>
          </div>
        </section>

        <section className="bg-white py-20 md:py-28">
          <div className="mx-auto max-w-7xl px-6">
            <p className="text-xs font-bold uppercase tracking-[0.15em] text-amber-800">{howWeWork.kicker}</p>
            <h2 className="mt-4 max-w-2xl font-headline text-3xl font-extrabold tracking-tight md:text-4xl">
              {howWeWork.title}
            </h2>
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-stone-600">{howWeWork.lead}</p>

            <div className="mt-14 grid gap-8 md:grid-cols-3 md:gap-10">
              {howWeWork.steps.map(({ Icon, title, body }, i) => (
                <div
                  key={title}
                  className="group flex h-full flex-col rounded-md border border-stone-200/70 bg-[#f7f3eb]/40 p-8 shadow-[0_10px_40px_rgba(28,25,23,0.06)] transition-all duration-200 hover:scale-[1.02] hover:shadow-[0_16px_48px_rgba(28,25,23,0.1)]"
                >
                  <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-md border border-stone-200 bg-white text-amber-800 transition-colors duration-200 group-hover:bg-stone-900 group-hover:text-[#f7f3eb]">
                    <Icon className="h-6 w-6" strokeWidth={2} />
                  </div>
                  <p className="text-xs font-bold uppercase tracking-wide text-amber-800/90">Step {i + 1}</p>
                  <h3 className="mt-2 font-headline text-xl font-bold text-stone-900">{title}</h3>
                  <p className="mt-3 flex-1 text-sm leading-relaxed text-stone-700">{body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="products" className="scroll-mt-24 bg-[#efe9dd] py-20 md:py-28">
          <div className="mx-auto max-w-7xl px-6">
            <p className="text-xs font-bold uppercase tracking-[0.15em] text-amber-800">{whatWeBuild.kicker}</p>
            <h2 className="mt-4 max-w-2xl font-headline text-3xl font-extrabold tracking-tight md:text-4xl">
              {whatWeBuild.title}
            </h2>
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-stone-600">{whatWeBuild.lead}</p>

            <div className="mt-14 grid gap-8 md:grid-cols-3">
              {whatWeBuild.items.map(({ icon: Icon, title, description }) => (
                <article
                  key={title}
                  className="flex h-full flex-col overflow-hidden rounded-md border border-stone-200/70 bg-white shadow-[0_12px_40px_rgba(28,25,23,0.07)] transition-all duration-200 hover:scale-[1.02] hover:shadow-[0_18px_50px_rgba(28,25,23,0.1)]"
                >
                  <div className="h-28 bg-gradient-to-br from-stone-200/60 via-white to-[#f7f3eb]" />
                  <div className="flex flex-1 flex-col px-7 pb-8 pt-6">
                    <div className="flex h-12 w-12 items-center justify-center rounded-md border border-stone-200 bg-[#f7f3eb] text-stone-900">
                      <Icon className="h-6 w-6" strokeWidth={1.75} />
                    </div>
                    <h3 className="mt-5 font-headline text-xl font-bold text-stone-900">{title}</h3>
                    <p className="mt-3 flex-1 text-sm leading-relaxed text-stone-700">{description}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-white py-20 md:py-28">
          <div className="mx-auto max-w-7xl px-6">
            <div className="mx-auto max-w-3xl rounded-3xl border border-stone-200/80 bg-[#f7f3eb]/50 p-10 text-center shadow-[0_16px_50px_rgba(28,25,23,0.08)] md:p-12">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-800">{pulsePreview.kicker}</p>
              <h2 className="mt-4 font-headline text-3xl font-extrabold tracking-tight md:text-4xl">{pulsePreview.title}</h2>
              <p className="mt-5 text-lg leading-relaxed text-stone-600">{pulsePreview.body}</p>
              <Link
                href="/pulse"
                className="mt-9 inline-flex items-center gap-2 rounded-full bg-stone-900 px-7 py-3 text-sm font-semibold text-[#f7f3eb] shadow-md transition-all duration-200 hover:scale-[1.02] hover:shadow-lg no-underline"
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
            section: "bg-[#faf7f0] py-20 md:py-28 text-stone-900",
            kicker: "text-amber-800",
            heading: "text-stone-900",
            lead: "text-stone-600",
            mailtoLink: "text-amber-800 hover:underline",
            form: "border-stone-200/80 bg-white shadow-[0_12px_40px_rgba(28,25,23,0.06)]",
            label: "text-stone-800",
            input: "border-stone-200 bg-[#f7f3eb] text-stone-900 focus:border-amber-700 focus:ring-amber-700/20",
            textarea: "border-stone-200 bg-[#f7f3eb] text-stone-900 focus:border-amber-700 focus:ring-amber-700/20",
            submit:
              "rounded-full bg-stone-900 shadow-md hover:bg-stone-800 hover:scale-[1.02] transition-transform duration-200",
          }}
        />

        <HelixFooter
          classNames={{
            footer: "border-stone-200/80 bg-[#f0ebe0]",
            brand: "text-stone-900",
            tagline: "text-stone-600",
            link: "text-stone-600 hover:text-amber-800",
            pulseLink: "text-amber-800 hover:underline",
            copyright: "text-stone-500",
          }}
        />
      </main>
    </>
  );
}
