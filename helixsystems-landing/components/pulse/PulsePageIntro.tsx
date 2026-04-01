import Link from "next/link";
import { Activity, LineChart, ShieldCheck } from "lucide-react";
import { pulseApp } from "@/lib/pulse-app";
import { mailtoInfo } from "@/lib/helix-emails";

export function PulsePageIntro() {
  return (
    <section className="grid w-full grid-cols-1 overflow-hidden border-b border-slate-800/50 md:h-[min(85vh,56rem)] md:min-h-[36rem] md:grid-cols-2">
      {/* LEFT — IMAGE: fills half the hero; crop/zoom to worker on the left of Header.jpg (spills clipped). */}
      <div className="relative min-h-[38vh] w-full overflow-hidden bg-[#0f172a] md:min-h-0">
        <img
          src="/images/Header.jpg"
          alt="Industrial worker using a tablet on the operations floor"
          className="absolute left-0 top-0 h-full w-[138%] max-w-none object-cover object-[14%_44%] sm:object-[16%_42%] md:w-[125%] md:object-[18%_center]"
        />
        <div className="pointer-events-none absolute inset-0 bg-slate-900/25" aria-hidden />
      </div>

      {/* RIGHT — PANEL */}
      <div className="relative flex w-full items-center bg-[#1e2d44]">
        <div className="relative z-10 w-full px-6 py-12 sm:px-10 sm:py-14 md:py-10 lg:px-14 lg:py-16">
          <span className="inline-flex rounded-full border border-pulse-accent/45 bg-pulse-accent/15 px-3 py-1 text-[10px] font-bold tracking-wide text-blue-100 shadow-sm shadow-pulse-accent/15 ring-1 ring-white/5 sm:text-[11px]">
            New release
          </span>

          <h1 className="font-headline mt-5 text-4xl font-bold tracking-tight text-white sm:mt-6 sm:text-5xl md:text-6xl lg:text-[3.5rem] lg:leading-[1.05]">
            Pulse
          </h1>

          <p className="mt-3 text-xl font-medium text-sky-50 sm:mt-4 sm:text-2xl md:text-[1.65rem] md:leading-snug">
            Your all-in-one operations hub.
          </p>

          <p className="mt-4 max-w-lg text-base leading-relaxed text-slate-300 sm:mt-5 sm:text-lg md:text-xl md:leading-relaxed">
            Manage maintenance, inventory, scheduling, and teams—without the friction between the field and the office.
            Built for the modern workforce.
          </p>

          <ul className="mt-8 space-y-4 sm:mt-10">
            <li className="flex items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-900 text-white shadow-inner ring-1 ring-blue-700/60">
                <Activity className="h-[18px] w-[18px]" strokeWidth={2} aria-hidden />
              </span>
              <span className="text-sm font-medium text-white sm:text-base">Real-time Telemetry</span>
            </li>
            <li className="flex items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-900 text-white shadow-inner ring-1 ring-blue-700/60">
                <LineChart className="h-[18px] w-[18px]" strokeWidth={2} aria-hidden />
              </span>
              <span className="text-sm font-medium text-white sm:text-base">Predictive Analytics</span>
            </li>
            <li className="flex items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-900 text-white shadow-inner ring-1 ring-blue-700/60">
                <ShieldCheck className="h-[18px] w-[18px]" strokeWidth={2} aria-hidden />
              </span>
              <span className="text-sm font-medium text-white sm:text-base">Advanced Security Protocols</span>
            </li>
          </ul>

          <div className="mt-9 flex flex-col gap-3 sm:mt-10 sm:flex-row sm:flex-wrap sm:items-center">
            <Link
              href={pulseApp.login()}
              className="inline-flex items-center justify-center rounded-xl bg-pulse-accent px-6 py-3 text-center text-sm font-semibold text-white shadow-md shadow-blue-900/25 transition-colors hover:bg-pulse-accent-hover"
            >
              Buy Now
            </Link>
            <a
              href={mailtoInfo("Pulse — request a demo", "Hello,\n\nI'd like to request a demo of Pulse.\n\n")}
              className="inline-flex items-center justify-center rounded-xl border border-slate-400/50 bg-[#152338]/80 px-6 py-3 text-center text-sm font-semibold text-white no-underline backdrop-blur-sm transition-colors hover:border-slate-300/60 hover:bg-[#1a2d45]/90"
            >
              Request Demo
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
