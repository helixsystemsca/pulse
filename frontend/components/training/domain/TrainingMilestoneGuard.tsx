"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  isTrainingRouteHiddenInMilestone,
  TRAINING_MILESTONE_FLASHCARDS_ONLY,
} from "@/lib/training/training-milestone";
import { TRAINING_ROUTES } from "@/lib/training/routes";

/** Redirects dormant Training routes to Flashcards during the milestone. */
export function TrainingMilestoneGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!TRAINING_MILESTONE_FLASHCARDS_ONLY) return;
    if (pathname === "/training") {
      router.replace(TRAINING_ROUTES.flashcards);
      return;
    }
    if (isTrainingRouteHiddenInMilestone(pathname)) {
      router.replace(TRAINING_ROUTES.flashcards);
    }
  }, [pathname, router]);

  return <>{children}</>;
}
