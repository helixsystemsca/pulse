"use client";

import { readSession } from "@/lib/pulse-session";
import { trainingTeamMatrixAccess } from "@/lib/pulse-roles";
import { TrainingEmployeeSelfView } from "@/components/training/TrainingEmployeeSelfView";
import { TrainingLeadershipDashboard } from "@/components/training/TrainingLeadershipDashboard";

export function TrainingOverviewApp() {
  if (!trainingTeamMatrixAccess(readSession())) {
    return <TrainingEmployeeSelfView />;
  }
  return <TrainingLeadershipDashboard />;
}
