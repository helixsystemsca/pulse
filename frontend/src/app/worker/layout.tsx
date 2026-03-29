"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { FeatureAccessProvider } from "@/components/FeatureAccess";
import { WorkerStreamProvider } from "@/components/worker/WorkerStreamProvider";
import { getToken } from "@/lib/api";
import "./worker.css";

export default function WorkerLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  useEffect(() => {
    if (!getToken()) router.replace("/login");
  }, [router]);

  return (
    <FeatureAccessProvider>
      <WorkerStreamProvider>
        <div className="worker-app" style={{ padding: "0.75rem 1rem 0" }}>
          {children}
        </div>
      </WorkerStreamProvider>
    </FeatureAccessProvider>
  );
}
