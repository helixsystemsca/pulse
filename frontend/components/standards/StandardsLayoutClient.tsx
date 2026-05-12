"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ListChecks } from "lucide-react";
import { SegmentedControl } from "@/components/schedule/SegmentedControl";
import { PageBody } from "@/components/ui/PageBody";
import { PageHeader } from "@/components/ui/PageHeader";

type StandardsSegment = "procedures" | "routines" | "training";

export function StandardsLayoutClient({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  const value: StandardsSegment = pathname.includes("/standards/training")
    ? "training"
    : pathname.includes("/standards/routines")
      ? "routines"
      : "procedures";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Standards"
        description="Procedures, shift routines, and training compliance — operational knowledge stays where it's used; general file storage stays in SharePoint."
        icon={ListChecks}
      />
      <PageBody>
        <div className="max-w-4xl">
          <SegmentedControl<StandardsSegment>
            value={value}
            onChange={(v) => {
              if (v === "routines") router.push("/standards/routines");
              else if (v === "training") router.push("/standards/training");
              else router.push("/standards/procedures");
            }}
            options={[
              { value: "procedures", label: "Procedures" },
              { value: "routines", label: "Routines" },
              { value: "training", label: "Training" },
            ]}
          />
        </div>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
          <Link
            href="/standards/my-procedures"
            className="font-medium text-teal-700 hover:underline dark:text-teal-300"
          >
            My procedures
          </Link>
          <Link
            href="/standards/acknowledgments"
            className="font-medium text-teal-700 hover:underline dark:text-teal-300"
          >
            Acknowledgment archive
          </Link>
        </div>
        <div className="mt-6">{children}</div>
      </PageBody>
    </div>
  );
}

