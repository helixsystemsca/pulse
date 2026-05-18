"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ListChecks } from "lucide-react";
import { SegmentedControl } from "@/components/schedule/SegmentedControl";
import { PageBody } from "@/components/ui/PageBody";
import { PageHeader } from "@/components/ui/PageHeader";
import { usePulseAuth } from "@/hooks/usePulseAuth";
import { standardsSegmentVisible } from "@/lib/standards/standards-feature-access";

type StandardsSegment = "procedures" | "training" | "certifications" | "compliance";

const SEGMENT_OPTIONS: { value: StandardsSegment; label: string; href: string }[] = [
  { value: "procedures", label: "Procedures", href: "/standards/procedures" },
  { value: "training", label: "Training", href: "/standards/training" },
  { value: "certifications", label: "Certifications", href: "/standards/certifications" },
  { value: "compliance", label: "Compliance", href: "/standards/compliance" },
];

function segmentFromPath(pathname: string): StandardsSegment {
  if (pathname.includes("/standards/training")) return "training";
  if (pathname.includes("/standards/certifications")) return "certifications";
  if (pathname.includes("/standards/compliance")) return "compliance";
  return "procedures";
}

export function StandardsLayoutClient({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { session } = usePulseAuth();

  const visibleSegments = SEGMENT_OPTIONS.filter((o) => standardsSegmentVisible(session, o.value));
  const value = segmentFromPath(pathname);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Standards"
        description="Procedures, assigned learning, structured certifications, and workforce compliance readiness."
        icon={ListChecks}
      />
      <PageBody>
        {visibleSegments.length > 0 ? (
          <div className="max-w-3xl">
            <SegmentedControl<StandardsSegment>
              value={value}
              onChange={(v) => {
                const target = visibleSegments.find((s) => s.value === v);
                if (target) router.push(target.href);
              }}
              options={visibleSegments.map((s) => ({ value: s.value, label: s.label }))}
            />
          </div>
        ) : null}
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
          {standardsSegmentVisible(session, "procedures") ? (
            <Link
              href="/standards/my-procedures"
              className="font-medium text-teal-700 hover:underline dark:text-teal-300"
            >
              My procedures
            </Link>
          ) : null}
          {standardsSegmentVisible(session, "compliance") ? (
            <Link
              href="/standards/compliance?tab=archive"
              className="font-medium text-teal-700 hover:underline dark:text-teal-300"
            >
              Acknowledgment archive
            </Link>
          ) : null}
          {standardsSegmentVisible(session, "training") ? (
            <Link
              href="/standards/routines"
              className="font-medium text-teal-700 hover:underline dark:text-teal-300"
            >
              Shift routines
            </Link>
          ) : null}
        </div>
        <div className="mt-6">{children}</div>
      </PageBody>
    </div>
  );
}
