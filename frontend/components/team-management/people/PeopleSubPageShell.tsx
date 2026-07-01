"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight, Users } from "lucide-react";
import { PageBody } from "@/components/ui/PageBody";
import { PageHeader } from "@/components/ui/PageHeader";
import { TeamSectionSubNav } from "@/components/team-management/shared/TeamSectionSubNav";
import { PEOPLE_SUB_NAV } from "@/lib/team-management/navigation";

export function PeopleSubPageShell({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-6">
      <PageHeader title={title} description={description} icon={Users} />
      <TeamSectionSubNav items={PEOPLE_SUB_NAV} ariaLabel="People sections" />
      <PageBody>{children}</PageBody>
    </div>
  );
}

export function PeopleTrainingLinkCard({
  title,
  description,
  href,
}: {
  title: string;
  description: string;
  href: string;
}) {
  return (
    <div className="ops-dash-inner-card max-w-2xl p-5">
      <h2 className="text-sm font-bold text-ds-foreground">{title}</h2>
      <p className="mt-2 text-sm text-ds-muted">{description}</p>
      <Link
        href={href}
        className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-[var(--ds-accent)]"
      >
        Open in Training <ArrowRight className="h-4 w-4" aria-hidden />
      </Link>
    </div>
  );
}
