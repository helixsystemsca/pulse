"use client";

import { usePathname, useRouter } from "next/navigation";
import { ListChecks } from "lucide-react";
import { SegmentedControl } from "@/components/schedule/SegmentedControl";
import { PageBody } from "@/components/ui/PageBody";
import { PageHeader } from "@/components/ui/PageHeader";

type StandardsSegment = "procedures" | "routines" | "training";

export function StandardsLayoutClient({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  const value: StandardsSegment = pathname.includes("/standards/routines")
    ? "routines"
    : pathname.includes("/standards/training")
      ? "training"
      : "procedures";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Standards"
        description="Procedures, routines, and workforce training visibility for consistent operations."
        icon={ListChecks}
      />
      <PageBody>
        <div className="max-w-2xl">
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
        <div className="mt-6">{children}</div>
      </PageBody>
    </div>
  );
}

