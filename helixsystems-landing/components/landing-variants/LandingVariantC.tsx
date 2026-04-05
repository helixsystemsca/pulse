import Link from "next/link";
import { Playfair_Display } from "next/font/google";
import { ArrowRight } from "lucide-react";
import { landingHero, howWeWork, pulsePreview, whatWeBuild } from "@/components/landing-variants/landingContent";
import { LandingVariantNavbar } from "@/components/landing-variants/LandingVariantNavbar";
import { HeroDemoPanel } from "@/components/landing-variants/parts/HeroDemoPanel";
import { ContactSection } from "@/components/site/ContactSection";
import { HelixFooter } from "@/components/site/HelixFooter";

const editorial = Playfair_Display({
  subsets: ["latin"],
  weight: ["600", "700"],
});

export function LandingVariantC({ homePath }: { homePath: string }) {
  const t = editorial.className;

  return (
    <>
      <LandingVariantNavbar preset="c" homePath={homePath} />
      <main className="min-h-screen bg-white text-slate-900">
        <section className="border-b border-slate-100">
          <div className="mx-auto grid max-w-7xl items-stretch gap-0 lg:grid-cols-2">
            <div className="flex flex-col justify-center px-6 py-16 md:px-10 md:py-24 lg:pl-8 lg:pr-12">
              <div className="inline-flex w-max items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1">
                <span className="h-1.5 w-1.5 rounded-full bg-slate-900" />
                <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-600">
                  {landingHero.badge}
                </span>
              </div>

              <h1
                className={`${t} mt-6 text-4xl font-semibold leading-[1.08] tracking-tight text-slate-900 md:text-5xl lg:text-[3.35rem]`}
              >
                {landingHero.h1Line1}
                <br />
                <span className="text-slate-600">{landingHero.h1Accent}</span>
              </h1>

              <p className="mt-6 max-w-xl text-[17px] leading-relaxed text-slate-600">{landingHero.lead}</p>

              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link
                  href="/pulse"
                  className="inline-flex items-center gap-2 rounded-full border border-slate-900 bg-slate-900 px-8 py-3.5 text-sm font-semibold text-white transition-all duration-200 hover:scale-[1.02] hover:shadow-lg no-underline"
                >
                  {landingHero.ctaExplore}
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <a
                  href={`${homePath}#products`}
                  className="inline-flex items-center rounded-full border border-slate-200 bg-white px-8 py-3.5 text-sm font-semibold text-slate-900 transition-all duration-200 hover:scale-[1.02] hover:border-slate-300 hover:shadow-md no-underline"
                >
                  {landingHero.ctaWhatWeBuild}
                </a>
              </div>
            </div>

            <div className="relative min-h-[320px] lg:min-h-[560px]">
              <div className="absolute inset-0 bg-gradient-to-br from-slate-100 via-slate-50 to-white" />
              <div className="relative flex h-full items-center justify-center p-6 md:p-10 lg:p-12">
                <div className="w-full max-w-xl">
                  <HeroDemoPanel
                    frameClassName="md:max-w-none"
                    gradientClassName="from-slate-200/80 via-white to-slate-50"
                    floatingWrapClassName="md:left-8"
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="bg-slate-50 py-20 md:py-28">
          <div className="mx-auto max-w-7xl px-6">
            <div className="mx-auto max-w-3xl text-center">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">{howWeWork.kicker}</p>
              <h2 className={`${t} mt-4 text-3xl font-semibold tracking-tight text-slate-900 md:text-4xl`}>
                {howWeWork.title}
              </h2>
              <p className="mt-5 text-lg leading-relaxed text-slate-600">{howWeWork.lead}</p>
            </div>

            <div className="mx-auto mt-14 max-w-5xl divide-y divide-slate-200/80 rounded-2xl border border-slate-200/70 bg-white">
              {howWeWork.steps.map(({ Icon, title, body }, i) => (
                <div
                  key={title}
                  className="grid gap-8 px-6 py-10 transition-colors duration-200 hover:bg-slate-50/60 md:grid-cols-[88px_1fr_auto] md:items-center md:px-10"
                >
                  <div className="flex items-center gap-4 md:block">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-slate-900">
                      <Icon className="h-6 w-6" strokeWidth={1.75} />
                    </div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 md:hidden">
                      Step {i + 1}
                    </p>
                  </div>
                  <div>
                    <p className="hidden text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 md:block">
                      Step {i + 1}
                    </p>
                    <h3 className={`${t} mt-1 text-2xl font-semibold text-slate-900`}>{title}</h3>
                    <p className="mt-3 text-sm leading-relaxed text-slate-600 md:text-[15px]">{body}</p>
                  </div>
                  <div className="hidden text-right text-5xl font-semibold tabular-nums text-slate-200 md:block">
                    {String(i + 1).padStart(2, "0")}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="products" className="scroll-mt-24 py-20 md:py-28">
          <div className="mx-auto max-w-7xl px-6">
            <div className="grid gap-12 lg:grid-cols-2 lg:items-end">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">{whatWeBuild.kicker}</p>
                <h2 className={`${t} mt-4 text-3xl font-semibold tracking-tight text-slate-900 md:text-4xl`}>
                  {whatWeBuild.title}
                </h2>
              </div>
              <p className="max-w-xl text-lg leading-relaxed text-slate-600 lg:justify-self-end">{whatWeBuild.lead}</p>
            </div>

            <div className="mt-14 space-y-8">
              {whatWeBuild.items.map(({ icon: Icon, title, description }, idx) => (
                <div
                  key={title}
                  className={`grid gap-8 rounded-2xl border border-slate-200/70 bg-white md:grid-cols-2 md:gap-0 ${
                    idx % 2 === 1 ? "md:[&>*:first-child]:order-2" : ""
                  }`}
                >
                  <div className="relative min-h-[220px] overflow-hidden rounded-t-2xl md:min-h-[280px] md:rounded-none md:rounded-l-2xl md:rounded-tr-none">
                    <div
                      className={`absolute inset-0 bg-gradient-to-br ${
                        idx % 2 === 0 ? "from-slate-100 to-slate-200/40" : "from-slate-200/60 to-slate-50"
                      }`}
                    />
                    <div className="relative flex h-full items-center justify-center p-10">
                      <div className="flex h-24 w-24 items-center justify-center rounded-3xl border border-white/60 bg-white/70 text-slate-900 shadow-sm backdrop-blur">
                        <Icon className="h-11 w-11" strokeWidth={1.5} />
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col justify-center px-8 py-10 md:px-12">
                    <h3 className={`${t} text-2xl font-semibold text-slate-900`}>{title}</h3>
                    <p className="mt-4 text-sm leading-relaxed text-slate-600 md:text-[15px]">{description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="border-t border-slate-100 bg-slate-50 py-20 md:py-28">
          <div className="mx-auto max-w-7xl px-6">
            <div className="overflow-hidden rounded-[28px] border border-slate-200/80 bg-white shadow-[0_18px_60px_rgba(15,23,42,0.06)]">
              <div className="grid gap-0 lg:grid-cols-2">
                <div className="relative min-h-[240px]">
                  <div className="absolute inset-0 bg-gradient-to-tr from-slate-200/60 via-white to-slate-100" />
                </div>
                <div className="flex flex-col justify-center px-8 py-12 md:px-12">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">{pulsePreview.kicker}</p>
                  <h2 className={`${t} mt-4 text-3xl font-semibold tracking-tight text-slate-900 md:text-4xl`}>
                    {pulsePreview.title}
                  </h2>
                  <p className="mt-5 text-[15px] leading-relaxed text-slate-600 md:text-lg">{pulsePreview.body}</p>
                  <Link
                    href="/pulse"
                    className="mt-8 inline-flex w-max items-center gap-2 rounded-full border border-slate-900 bg-slate-900 px-6 py-3 text-sm font-semibold text-white transition-all duration-200 hover:scale-[1.02] hover:shadow-lg no-underline"
                  >
                    {pulsePreview.cta}
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        <ContactSection
          id="contact"
          classNames={{
            section: "border-t border-slate-100 bg-white py-20 md:py-28",
            kicker: "text-slate-500",
            heading: `${t} !font-semibold text-slate-900`,
            lead: "text-slate-600",
            mailtoLink: "text-slate-900 underline-offset-4 hover:underline",
            form: "rounded-[28px] border-slate-200/80 shadow-[0_18px_60px_rgba(15,23,42,0.06)]",
            label: "text-slate-800",
            input: "rounded-2xl border-slate-200 bg-slate-50 focus:border-slate-900 focus:ring-slate-900/15",
            textarea: "rounded-2xl border-slate-200 bg-slate-50 focus:border-slate-900 focus:ring-slate-900/15",
            submit:
              "rounded-full bg-slate-900 shadow-md hover:bg-slate-800 hover:scale-[1.02] transition-transform duration-200",
          }}
        />

        <HelixFooter
          classNames={{
            footer: "border-slate-100 bg-slate-50",
            brand: "text-slate-900",
            tagline: "text-slate-600",
            link: "text-slate-600 hover:text-slate-900",
            pulseLink: "text-slate-900 hover:underline",
            copyright: "text-slate-500",
          }}
        />
      </main>
    </>
  );
}
