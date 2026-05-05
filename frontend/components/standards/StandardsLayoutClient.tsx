"use client";

import { usePathname, useRouter } from "next/navigation";
import { ListChecks } from "lucide-react";
import { SegmentedControl } from "@/components/schedule/SegmentedControl";
import { PageBody } from "@/components/ui/PageBody";
import { PageHeader } from "@/components/ui/PageHeader";

export function StandardsLayoutClient({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  const value = pathname.includes("/standards/routines") ? "routines" : "procedures";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Standards"
        description="Procedures and routines your team runs to stay consistent."
        icon={ListChecks}
      />
      <PageBody>
        <div className="max-w-md">
          <SegmentedControl
            value={value}
            onChange={(v) => router.push(v === "routines" ? "/standards/routines" : "/standards/procedures")}
            options={[
              { value: "procedures", label: "Procedures" },
              { value: "routines", label: "Routines" },
            ]}
          />
        </div>
        <div className="mt-6">{children}</div>
      </PageBody>
    </div>
  );
}

