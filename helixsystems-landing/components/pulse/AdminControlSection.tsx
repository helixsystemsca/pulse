import { Eye, LayoutDashboard, Shield } from "lucide-react";
import { OperationalDashboard } from "@/components/dashboard/OperationalDashboard";
import { SectionWrapper } from "./SectionWrapper";

export function AdminControlSection() {
  return (
    <SectionWrapper id="admin-panel" className="scroll-mt-24 bg-pulse-section" showMobileSeparator>
      <div className="mx-auto max-w-3xl text-center md:max-w-4xl">
        <h2 className="text-3xl font-bold tracking-tight text-pulse-navy md:text-4xl">
          See everything in one place.
        </h2>
        <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-pulse-muted">
          Monitor work, tools, and workforce across your operation.
        </p>
      </div>

      <div className="relative mx-auto mt-10 max-w-5xl md:mt-14">
        <div className="origin-top max-md:-mb-8 max-md:scale-[0.7] sm:max-md:scale-[0.8] md:mb-0 md:scale-100">
          <OperationalDashboard variant="demo" />
        </div>
      </div>

      <div
        id="features"
        className="mx-auto mt-12 grid max-w-5xl scroll-mt-24 gap-8 md:mt-16 md:grid-cols-3 md:gap-12"
      >
        <div className="text-center md:text-left">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-md bg-blue-50 text-pulse-accent md:mx-0">
            <LayoutDashboard className="h-6 w-6" strokeWidth={1.75} />
          </div>
          <h3 className="text-lg font-semibold text-pulse-navy">Active work and alerts</h3>
          <p className="mt-2 text-sm leading-relaxed text-pulse-muted">
            Open work requests, exceptions, and queue depth stay visible on the home dashboard.
          </p>
        </div>
        <div className="text-center md:text-left">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-md bg-blue-50 text-pulse-accent md:mx-0">
            <Eye className="h-6 w-6" strokeWidth={1.75} />
          </div>
          <h3 className="text-lg font-semibold text-pulse-navy">Tool and asset status</h3>
          <p className="mt-2 text-sm leading-relaxed text-pulse-muted">
            In-use, idle, and missing flags update as the floor reports them—no clipboard audit required.
          </p>
        </div>
        <div className="text-center md:text-left">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-md bg-blue-50 text-pulse-accent md:mx-0">
            <Shield className="h-6 w-6" strokeWidth={1.75} />
          </div>
          <h3 className="text-lg font-semibold text-pulse-navy">Users, roles, and company settings</h3>
          <p className="mt-2 text-sm leading-relaxed text-pulse-muted">
            Invite workers, set admin vs. manager vs. worker access, and tune company-level options from one
            admin surface.
          </p>
        </div>
      </div>
    </SectionWrapper>
  );
}
