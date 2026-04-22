"use client";

import type { IotTool } from "./iot-deployment-types";

const TOOLS: { id: IotTool; label: string; short: string; title: string }[] = [
  { id: "select", label: "Select", short: "V", title: "Select and move devices (V)" },
  { id: "node", label: "Node", short: "N", title: "Place BLE node (12 m default range)" },
  { id: "gateway", label: "Gateway", short: "G", title: "Place ESP-NOW gateway (28 m default)" },
  { id: "lteHub", label: "LTE hub", short: "L", title: "Place LTE hub (35 m default)" },
  { id: "setScale", label: "Set scale", short: "S", title: "Click two points, then enter real distance in meters" },
];

type Props = {
  active: IotTool;
  onChange: (t: IotTool) => void;
  coverageEnabled: boolean;
  onToggleCoverage: (v: boolean) => void;
  showGaps: boolean;
  onToggleGaps: (v: boolean) => void;
  snapGrid: boolean;
  onToggleSnap: (v: boolean) => void;
  disabled: boolean;
};

export function IotLeftToolPalette({
  active,
  onChange,
  coverageEnabled,
  onToggleCoverage,
  showGaps,
  onToggleGaps,
  snapGrid,
  onToggleSnap,
  disabled,
}: Props) {
  return (
    <div className={`bp-iot-palette${disabled ? " bp-iot-palette--disabled" : ""}`} role="toolbar" aria-label="IoT deployment">
      {TOOLS.map((t) => (
        <button
          key={t.id}
          type="button"
          className={`bp-iot-palette__btn${active === t.id ? " is-active" : ""}`}
          title={t.title}
          disabled={disabled}
          onClick={() => onChange(t.id)}
        >
          <span className="bp-iot-palette__short" aria-hidden>
            {t.short}
          </span>
          <span className="bp-iot-palette__label">{t.label}</span>
        </button>
      ))}
      <div className="bp-iot-palette__div" role="group" aria-label="Coverage and grid">
        <label className="bp-iot-palette__check" title="Draw approximate RF reach as radial gradients">
          <input
            type="checkbox"
            checked={coverageEnabled}
            disabled={disabled}
            onChange={(e) => onToggleCoverage(e.target.checked)}
          />
          <span>Coverage</span>
        </label>
        <label
          className="bp-iot-palette__check"
          title="Faint red dots where no device covers (coarse grid)"
        >
          <input
            type="checkbox"
            checked={showGaps}
            disabled={disabled || !coverageEnabled}
            onChange={(e) => onToggleGaps(e.target.checked)}
          />
          <span>Gaps</span>
        </label>
        <label className="bp-iot-palette__check" title="Snap placements to 32px grid">
          <input
            type="checkbox"
            checked={snapGrid}
            disabled={disabled}
            onChange={(e) => onToggleSnap(e.target.checked)}
          />
          <span>Grid snap</span>
        </label>
      </div>
    </div>
  );
}
