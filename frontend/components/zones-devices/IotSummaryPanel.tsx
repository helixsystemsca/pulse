"use client";

type Props = {
  percent: number;
  deviceCount: number;
  uncoveredCells: number;
  totalCells: number;
  metersPerPixel: number | null;
  suggestedDefaultMpp: number;
  suggestion: string | null;
}

export function IotSummaryPanel({
  percent,
  deviceCount,
  uncoveredCells,
  totalCells,
  metersPerPixel,
  suggestedDefaultMpp,
  suggestion,
}: Props) {
  return (
    <div className="bp-iot-summary" aria-label="IoT coverage summary">
      <h3>Deployment</h3>
      <ul className="bp-iot-summary__stats">
        <li>
          <span className="bp-iot-summary__k">Covered (approx.)</span>
          <span className="bp-iot-summary__v">{percent.toFixed(1)}%</span>
        </li>
        <li>
          <span className="bp-iot-summary__k">Devices</span>
          <span className="bp-iot-summary__v">{deviceCount}</span>
        </li>
        <li>
          <span className="bp-iot-summary__k">Gap cells (grid)</span>
          <span className="bp-iot-summary__v">
            {uncoveredCells} / {totalCells}
          </span>
        </li>
        <li>
          <span className="bp-iot-summary__k">Scale (m/px)</span>
          <span className="bp-iot-summary__v">
            {metersPerPixel != null
              ? metersPerPixel.toFixed(4)
              : `default ≈${suggestedDefaultMpp.toFixed(4)}`}
          </span>
        </li>
      </ul>
      {suggestion ? <p className="bp-iot-summary__tip">{suggestion}</p> : null}
    </div>
  );
}
