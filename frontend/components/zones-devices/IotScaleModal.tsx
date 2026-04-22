"use client";

import { useEffect, useId, useState } from "react";

type Props = {
  open: boolean;
  pixelDistance: number;
  onConfirm: (meters: number) => void;
  onCancel: () => void;
};

export function IotScaleModal({ open, pixelDistance, onConfirm, onCancel }: Props) {
  const labelId = useId();
  const [raw, setRaw] = useState("10");
  useEffect(() => {
    if (open) setRaw("10");
  }, [open]);

  if (!open) return null;

  const d = Math.max(0, pixelDistance);
  return (
    <div className="bp-iot-modal-root" role="dialog" aria-modal="true" aria-labelledby={labelId}>
      <button type="button" className="bp-iot-modal__backdrop" aria-label="Close" onClick={onCancel} />
      <div className="bp-iot-modal">
        <h2 id={labelId} className="bp-iot-modal__title">
          Calibrate scale
        </h2>
        <p className="bp-iot-modal__hint">
          Pixel distance: <strong>{d.toFixed(1)}</strong> px. Enter the real distance between the two points.
        </p>
        <label className="bp-iot-modal__field">
          <span>Real-world distance (meters)</span>
          <input
            type="number"
            min={0.01}
            step={0.1}
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                const m = Number(raw);
                if (Number.isFinite(m) && m > 0) onConfirm(m);
              }
              if (e.key === "Escape") onCancel();
            }}
          />
        </label>
        <div className="bp-iot-modal__actions">
          <button type="button" className="bp-btn bp-btn--ghost" onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            className="bp-btn"
            onClick={() => {
              const m = Number(raw);
              if (Number.isFinite(m) && m > 0) onConfirm(m);
            }}
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}
