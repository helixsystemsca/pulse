"use client";

import { Activity, BatteryLow, Radio, WifiOff } from "lucide-react";
import { formatRelativeTime } from "@/lib/formatRelativeTime";
import type { BleDeviceOut, GatewayOut, GatewayStatusRow } from "@/lib/setup-api";

const STALE_TAG_SEC = 120;
const LOW_BATTERY_PCT = 20;

function ageSeconds(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return Math.max(0, (Date.now() - t) / 1000);
}

export function DeviceHealthPanel({
  gateways,
  gatewayStatus,
  bleDevices,
}: {
  gateways: GatewayOut[];
  gatewayStatus: GatewayStatusRow[];
  bleDevices: BleDeviceOut[];
}) {
  const statusById = new Map(gatewayStatus.map((r) => [r.id, r]));

  const offlineGateways = gateways.filter((g) => {
    const st = statusById.get(g.id)?.status ?? g.status;
    return st !== "online";
  });

  const staleTags = bleDevices.filter((b) => {
    const sec = ageSeconds(b.last_seen_at ?? null);
    return sec === null || sec > STALE_TAG_SEC;
  });

  const lowBatteryTags = bleDevices.filter((b) => {
    const pct = (b as BleDeviceOut & { battery_percent?: number | null }).battery_percent;
    return pct != null && pct <= LOW_BATTERY_PCT;
  });

  const miniList = "space-y-2 text-sm";
  const item = "rounded-lg border border-slate-200/80 bg-slate-50/80 px-3 py-2";

  return (
    <section className="rounded-2xl border border-slate-200/80 bg-white/90 p-5 shadow-card md:p-6">
      <div className="flex items-center gap-2">
        <Activity className="h-5 w-5 text-[#2B4C7E]" aria-hidden />
        <div>
          <h2 className="text-lg font-semibold text-pulse-navy">Device health &amp; activity</h2>
          <p className="text-sm text-pulse-muted">Offline infrastructure, quiet tags, and battery alerts.</p>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div>
          <div className="flex items-center gap-2 text-pulse-navy">
            <WifiOff className="h-4 w-4 text-rose-700" aria-hidden />
            <h3 className="text-sm font-semibold">Offline gateways</h3>
          </div>
          <ul className={`mt-3 ${miniList}`}>
            {offlineGateways.length === 0 ? (
              <li className={`${item} text-pulse-muted`}>All gateways report online.</li>
            ) : (
              offlineGateways.map((g) => {
                const st = statusById.get(g.id);
                const last = st?.last_seen_at ?? g.last_seen_at;
                return (
                  <li key={g.id} className={item}>
                    <span className="font-medium text-pulse-navy">{g.name}</span>
                    <span className="mt-0.5 block font-mono text-xs text-pulse-muted">{g.identifier}</span>
                    <span className="mt-1 block text-xs text-pulse-muted">
                      Last heartbeat {formatRelativeTime(last)}
                    </span>
                  </li>
                );
              })
            )}
          </ul>
        </div>

        <div>
          <div className="flex items-center gap-2 text-pulse-navy">
            <Radio className="h-4 w-4 text-amber-700" aria-hidden />
            <h3 className="text-sm font-semibold">Quiet tags</h3>
          </div>
          <p className="mt-1 text-[11px] text-pulse-muted">No detection for {">"}
            {STALE_TAG_SEC}s (or never).
          </p>
          <ul className={`mt-2 ${miniList} max-h-52 overflow-y-auto pr-1`}>
            {staleTags.length === 0 ? (
              <li className={`${item} text-pulse-muted`}>All tags recently heard.</li>
            ) : (
              staleTags.map((b) => (
                <li key={b.id} className={item}>
                  <span className="font-medium text-pulse-navy">{b.name}</span>
                  <span className="block font-mono text-xs text-pulse-muted">{b.mac_address}</span>
                  <span className="mt-1 block text-xs text-pulse-muted">
                    Last seen {formatRelativeTime(b.last_seen_at ?? null)}
                  </span>
                </li>
              ))
            )}
          </ul>
        </div>

        <div>
          <div className="flex items-center gap-2 text-pulse-navy">
            <BatteryLow className="h-4 w-4 text-amber-800" aria-hidden />
            <h3 className="text-sm font-semibold">Low battery</h3>
          </div>
          <p className="mt-1 text-[11px] text-pulse-muted">Shown when hardware reports battery % (optional field).</p>
          <ul className={`mt-2 ${miniList}`}>
            {lowBatteryTags.length === 0 ? (
              <li className={`${item} text-pulse-muted`}>No low-battery rows from the API.</li>
            ) : (
              lowBatteryTags.map((b) => {
                const pct = (b as BleDeviceOut & { battery_percent?: number | null }).battery_percent;
                return (
                  <li key={b.id} className={item}>
                    <span className="font-medium text-pulse-navy">{b.name}</span>
                    <span className="block text-xs text-amber-900">{pct}%</span>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      </div>
    </section>
  );
}
