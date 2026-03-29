import Link from "next/link";
import { ArrowRight } from "lucide-react";

export function PulsePreviewSection() {
  return (
    <section className="bg-white py-20">
      <div className="mx-auto max-w-7xl px-6">
        <div className="mx-auto max-w-2xl rounded-2xl border border-helix-outline/20 bg-helix-bg p-8 text-center shadow-md md:p-10">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-helix-primary">Product</p>
          <h2 className="mt-3 font-headline text-3xl font-extrabold tracking-tight text-helix-onSurface md:text-4xl">
            Pulse
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-helix-onSurfaceVariant">
            Our flagship operational intelligence layer—workforce signals, asset state, maintenance, and inventory
            awareness in one coherent picture for the front line and the control room.
          </p>
          <Link
            href="/pulse"
            className="mt-8 inline-flex items-center gap-2 rounded-full bg-helix-primary px-6 py-3 text-sm font-semibold text-white shadow-md transition-colors duration-200 hover:bg-helix-primary-dim no-underline"
          >
            Learn more
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}
