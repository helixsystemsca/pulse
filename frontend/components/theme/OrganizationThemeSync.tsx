"use client";

import { useEffect } from "react";
import { readSession } from "@/lib/pulse-session";
import {
  applyOrganizationBrandColors,
  clearOrganizationBrandColorOverrides,
  PULSE_ORG_THEME_CHANGE_EVENT,
  resolveOrganizationBrandColors,
} from "@/lib/theme/organization-branding";

/** Applies tenant brand colors from session / local preview to CSS variables. */
export function OrganizationThemeSync() {
  useEffect(() => {
    const sync = () => {
      const session = readSession();
      const company = session?.company ?? null;
      if (!company?.id) {
        clearOrganizationBrandColorOverrides();
        return;
      }
      applyOrganizationBrandColors(resolveOrganizationBrandColors(company));
    };

    sync();
    window.addEventListener(PULSE_ORG_THEME_CHANGE_EVENT, sync);
    window.addEventListener("pulse-auth-change", sync);
    return () => {
      window.removeEventListener(PULSE_ORG_THEME_CHANGE_EVENT, sync);
      window.removeEventListener("pulse-auth-change", sync);
    };
  }, []);

  return null;
}
