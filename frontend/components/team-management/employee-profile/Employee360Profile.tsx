"use client";

import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { PulseDrawer } from "@/components/schedule/PulseDrawer";
import { Button } from "@/components/ui/Button";
import { EmployeeProfileProvider } from "@/components/team-management/employee-profile/EmployeeProfileContext";
import { ProfileOverviewTab } from "@/components/team-management/employee-profile/tabs/ProfileOverviewTab";
import { ProfilePerformanceTab } from "@/components/team-management/employee-profile/tabs/ProfilePerformanceTab";
import { ProfileDevelopmentTab } from "@/components/team-management/employee-profile/tabs/ProfileDevelopmentTab";
import { ProfileTrainingTab } from "@/components/team-management/employee-profile/tabs/ProfileTrainingTab";
import { ProfileCareerTab } from "@/components/team-management/employee-profile/tabs/ProfileCareerTab";
import { ProfileRecognitionTab } from "@/components/team-management/employee-profile/tabs/ProfileRecognitionTab";
import { ProfileHistoryTab } from "@/components/team-management/employee-profile/tabs/ProfileHistoryTab";
import { useEmployeeProfile } from "@/lib/team-management/employee-profile/hooks/useEmployeeProfile";
import type { EmployeeProfileTab } from "@/lib/team-management/employee-profile/types";
import { displayName } from "@/lib/team-management/development-types";
import { cn } from "@/lib/cn";

const TABS: { id: EmployeeProfileTab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "performance", label: "Performance" },
  { id: "development", label: "Development" },
  { id: "training", label: "Training" },
  { id: "career", label: "Career" },
  { id: "recognition", label: "Recognition" },
  { id: "history", label: "History" },
];

function ProfileBody({ tab }: { tab: EmployeeProfileTab }) {
  switch (tab) {
    case "overview":
      return <ProfileOverviewTab />;
    case "performance":
      return <ProfilePerformanceTab />;
    case "development":
      return <ProfileDevelopmentTab />;
    case "training":
      return <ProfileTrainingTab />;
    case "career":
      return <ProfileCareerTab />;
    case "recognition":
      return <ProfileRecognitionTab />;
    case "history":
      return <ProfileHistoryTab />;
    default:
      return null;
  }
}

export function Employee360Profile({
  userId,
  open,
  onClose,
  onUpdated,
  initialTab = "overview",
}: {
  userId: string | null;
  open: boolean;
  onClose: () => void;
  onUpdated?: () => void;
  initialTab?: EmployeeProfileTab;
}) {
  const [tab, setTab] = useState<EmployeeProfileTab>(initialTab);
  const profileState = useEmployeeProfile(userId, { onUpdated });

  useEffect(() => {
    if (!open) setTab(initialTab);
  }, [open, initialTab]);

  const title = profileState.profile
    ? displayName(profileState.profile.development)
    : "Employee Profile";

  return (
    <PulseDrawer
      open={open}
      onClose={onClose}
      title={title}
      subtitle={profileState.profile?.development.job_title || undefined}
      placement="center"
      wide
      footer={
        <div className="flex justify-end">
          <Button type="button" variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
      }
    >
      {profileState.loading ? (
        <div className="flex min-h-[16rem] items-center justify-center text-ds-muted">
          <Loader2 className="h-6 w-6 animate-spin" aria-hidden />
        </div>
      ) : profileState.error ? (
        <p className="text-sm text-ds-danger">{profileState.error}</p>
      ) : !profileState.profile ? null : (
        <EmployeeProfileProvider value={profileState}>
          <nav role="tablist" className="mb-4 flex flex-wrap gap-1 border-b border-ds-border pb-1">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={tab === t.id}
                className={cn(
                  "rounded-md px-3 py-1.5 text-xs font-semibold transition",
                  tab === t.id
                    ? "bg-ds-secondary text-ds-foreground shadow-sm"
                    : "text-ds-muted hover:text-ds-foreground",
                )}
                onClick={() => setTab(t.id)}
              >
                {t.label}
              </button>
            ))}
          </nav>
          <ProfileBody tab={tab} />
        </EmployeeProfileProvider>
      )}
    </PulseDrawer>
  );
}

/** @deprecated Use Employee360Profile */
export function EmployeeDevelopmentModal({
  userId,
  open,
  onClose,
  onUpdated,
}: {
  userId: string | null;
  open: boolean;
  onClose: () => void;
  onUpdated: () => void;
}) {
  return (
    <Employee360Profile
      userId={userId}
      open={open}
      onClose={onClose}
      onUpdated={onUpdated}
      initialTab="development"
    />
  );
}
