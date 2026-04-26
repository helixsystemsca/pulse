/**
 * frontend/app/(pulse)/demo/page.tsx
 * ══════════════════════════════════════════════════════════════════════════
 * Dedicated demo route — accessible at /demo when logged in.
 * Drop this file into: frontend/app/(pulse)/demo/page.tsx
 * (create the demo folder if it doesn't exist)
 */

import { DemoLiveMap } from "@/components/demo/DemoLiveMap";

export const metadata = {
  title: "Live Demo · Pulse",
  description: "Telemetry pipeline demo — Pool zone scenario",
};

export default function DemoPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      {/* Banner */}
      <div className="mb-6 rounded-md border border-ds-accent/30 bg-ds-accent/5 px-4 py-3">
        <p className="text-xs font-semibold text-ds-accent uppercase tracking-wider mb-1">
          Demo Mode · Simulated Hardware
        </p>
        <p className="text-sm text-ds-foreground">
          This is a live demonstration of the full telemetry pipeline.
          All beacon positions and inference logic are real — only the hardware is simulated.
          Press <strong>Start Demo</strong> and watch Daniel approach the Hot Tub Boiler.
        </p>
      </div>

      <DemoLiveMap />

      {/* Explainer */}
      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[
          {
            step: "01",
            title: "BLE Beacons",
            body: "Worker keys and equipment tags broadcast their MAC address every second. ESP32 nodes pick them up via Bluetooth throughout the facility.",
          },
          {
            step: "02",
            title: "Position Engine",
            body: "A Raspberry Pi 5 on an LTE hub runs trilateration across all gateway readings to compute real-time (x, y) positions — no facility WiFi needed.",
          },
          {
            step: "03",
            title: "PM Inference",
            body: "When a worker is near equipment with an overdue PM for long enough, Pulse assumes maintenance is happening and asks them to confirm — eliminating manual logging entirely.",
          },
        ].map(({ step, title, body }) => (
          <div key={step} className="rounded-md border border-ds-border bg-ds-primary p-4">
            <p className="text-[10px] font-bold text-ds-accent tracking-widest mb-1">STEP {step}</p>
            <p className="text-sm font-semibold text-ds-foreground mb-2">{title}</p>
            <p className="text-xs text-ds-muted leading-relaxed">{body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
