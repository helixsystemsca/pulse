/**
 * ════════════════════════════════════════════════════════════════════════
 * ADDITIONS FOR: frontend/lib/setup-api.ts
 * ════════════════════════════════════════════════════════════════════════
 *
 * Add these two exports to the END of setup-api.ts.
 * The apiFetch import and withCompany helper are already in that file.
 */

// ── Type (add near the other export types at the top of setup-api.ts) ────────

export type UnknownDeviceOut = {
  id: string;
  mac_address: string;
  first_seen_at: string;
  last_seen_at: string;
  seen_count: number;
};

// ── Functions (add at the end of setup-api.ts) ───────────────────────────────

export async function fetchUnknownDevices(
  companyId: string | null,
  limit = 50,
): Promise<UnknownDeviceOut[]> {
  return apiFetch<UnknownDeviceOut[]>(
    withCompany(`/api/v1/ble-devices/unknown?limit=${limit}`, companyId),
  );
}

export async function dismissUnknownDevice(
  companyId: string | null,
  mac: string,
): Promise<void> {
  await apiFetch<void>(
    withCompany(`/api/v1/ble-devices/unknown/${encodeURIComponent(mac)}`, companyId),
    { method: "DELETE" },
  );
}


/**
 * ════════════════════════════════════════════════════════════════════════
 * CHANGES FOR: frontend/components/setup/SetupApp.tsx
 * ════════════════════════════════════════════════════════════════════════
 *
 * Three small changes. Cursor can make all three in one pass.
 */


// ── CHANGE 1: Add import at the top of SetupApp.tsx ─────────────────────────
//
// Add to the existing import block (near the other setup component imports):

import { UnknownDevicesPanel } from "@/components/setup/UnknownDevicesPanel";


// ── CHANGE 2: Add ref for the register form (for scroll-to behavior) ─────────
//
// Add near the other useRef declarations in SetupApp (around line 200):

const registerTagFormRef = useRef<HTMLDivElement>(null);


// ── CHANGE 3: Add the handler + panel in the devices tab ─────────────────────
//
// A. Add this handler function inside the SetupApp component body,
//    near the other handler functions (onAddGateway, onAddBle, etc.):

const onDiscoveredDeviceRegister = useCallback((mac: string) => {
  // Pre-fill the MAC field in the Register tag form
  setBleMac(mac);
  // Scroll to the Register tag form so the operator can complete registration
  setTimeout(() => {
    registerTagFormRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, 50);
}, []);


// ── CHANGE 3B: Add the panel to the devices tab JSX ─────────────────────────
//
// In the devices tab render (tab === "devices"), find the right-hand column
// which contains the "Tags" section. It starts with:
//
//   <div className="space-y-4">
//     <h2 className="text-lg font-semibold text-ds-foreground">Tags</h2>
//
// INSERT the <UnknownDevicesPanel> BETWEEN the <h2>Tags</h2> and the existing
// unassignedBle section. Result should look like:
//
//   <div className="space-y-4">
//     <h2 className="text-lg font-semibold text-ds-foreground">Tags</h2>
//
//     {/* ← INSERT HERE */}
//     <UnknownDevicesPanel
//       companyId={effectiveCompanyId}
//       isSystemAdmin={isSystemAdmin}
//       onRegister={onDiscoveredDeviceRegister}
//       pollMs={30_000}
//     />
//
//     {unassignedBle.length > 0 ? (    ← existing unassigned panel continues here
//
//
// ── CHANGE 3C: Add the ref to the Register tag form div ─────────────────────
//
// Find the "Register tag" form card in the devices tab:
//
//   <div className="rounded-md border border-ds-border bg-ds-primary p-5 shadow-[var(--ds-shadow-card)]">
//     <h3 className="font-semibold text-ds-foreground">Register tag</h3>
//
// Add the ref to that div:
//
//   <div ref={registerTagFormRef} className="rounded-md border border-ds-border ...">
//     <h3 className="font-semibold text-ds-foreground">Register tag</h3>
