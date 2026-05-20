"use client";

import { CertificationsRegistryView } from "@/components/standards/workforce-training/CertificationsRegistryView";

/** Back-compat export — canonical UX is Standards → Training → Certifications. */
export function StandardsCertificationsApp() {
  return <CertificationsRegistryView />;
}
