import Link from "next/link";
import { ArrowRight, GraduationCap } from "lucide-react";
import { PageBody } from "@/components/ui/PageBody";
import { PageHeader } from "@/components/ui/PageHeader";
import { TeamSectionSubNav } from "@/components/team-management/shared/TeamSectionSubNav";
import { GROWTH_SUB_NAV } from "@/lib/team-management/navigation";

export const metadata = { title: "Training · Growth" };

export default function GrowthTrainingPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Training"
        description="Workforce training, compliance, and learning paths."
        icon={GraduationCap}
      />
      <TeamSectionSubNav items={GROWTH_SUB_NAV} ariaLabel="Growth sections" />
      <PageBody>
        <div className="grid gap-3 md:grid-cols-2">
          {[
            { href: "/training/compliance/matrix", label: "Compliance matrix", hint: "Training status by employee" },
            { href: "/training/compliance/workers", label: "Workforce qualifications", hint: "Certs and expiring items" },
            { href: "/training/learning", label: "Learning hub", hint: "Courses and procedures" },
          ].map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="ops-dash-inner-card group flex flex-col p-4 hover:shadow-md"
            >
              <h2 className="text-sm font-bold text-ds-foreground">{link.label}</h2>
              <p className="mt-1 text-xs text-ds-muted">{link.hint}</p>
              <ArrowRight className="mt-3 h-4 w-4 text-ds-muted group-hover:text-[var(--ds-accent)]" aria-hidden />
            </Link>
          ))}
        </div>
      </PageBody>
    </div>
  );
}
