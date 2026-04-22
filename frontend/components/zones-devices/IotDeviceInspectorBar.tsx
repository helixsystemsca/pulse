"use client";

import type { Device, DeviceType } from "./iot-deployment-types";

const TYPE_LABEL: Record<DeviceType, string> = {
  node: "BLE node",
  gateway: "Gateway (ESP-NOW)",
  lteHub: "LTE hub",
};

type Props = {
  device: Device | null;
  onUpdateRange: (meters: number) => void;
  onUpdatePosition: (x: number, y: number) => void;
  onDelete: () => void;
  onClose: () => void;
  canEdit: boolean;
};

export function IotDeviceInspectorBar({
  device,
  onUpdateRange,
  onUpdatePosition,
  onDelete,
  onClose,
  canEdit,
}: Props) {
  if (!device) return null;
  return (
    <div className="bp-iot-inspector" role="region" aria-label="Selected IoT device">
      <div className="bp-iot-inspector__row">
        <span className="bp-iot-inspector__type">{TYPE_LABEL[device.type]}</span>
        <label className="bp-iot-inspector__field">
          <span>Range (m)</span>
          <input
            type="range"
            min={1}
            max={80}
            step={0.5}
            value={device.rangeMeters}
            disabled={!canEdit}
            onChange={(e) => onUpdateRange(Number(e.target.value))}
          />
          <output>{device.rangeMeters.toFixed(1)}</output>
        </label>
        <div className="bp-iot-inspector__pos">
          <label>
            <span className="sr-only">X</span>
            <input
              type="number"
              className="bp-iot-inspector__num"
              value={Math.round(device.x)}
              disabled={!canEdit}
              onChange={(e) => {
                const n = Number(e.target.value);
                if (Number.isFinite(n)) onUpdatePosition(n, device.y);
              }}
            />
          </label>
          <label>
            <span className="sr-only">Y</span>
            <input
              type="number"
              className="bp-iot-inspector__num"
              value={Math.round(device.y)}
              disabled={!canEdit}
              onChange={(e) => {
                const n = Number(e.target.value);
                if (Number.isFinite(n)) onUpdatePosition(device.x, n);
              }}
            />
          </label>
        </div>
        {canEdit ? (
          <button type="button" className="bp-btn bp-btn--ghost" onClick={onDelete}>
            Delete
          </button>
        ) : null}
        <button type="button" className="bp-btn bp-btn--ghost" onClick={onClose} aria-label="Deselect">
          Deselect
        </button>
      </div>
    </div>
  );
}
