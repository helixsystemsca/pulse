"use client";

import type { CSSProperties } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  getSensorDetail,
  getSensorReadings,
  loadSensorIdMap,
  parseReadingNum,
  type MetricKey,
  type SensorDetailOut,
  type SensorReadingOut,
} from "@/lib/monitoring-api";

const CHART_GRID = "#2d3a4f";
const CHART_MUTED = "#8b9cb3";
const CHART_BAR = "#4a5f7a";
const CHART_BAR_LAST = "#f59e0b";

const METRICS: {
  key: MetricKey;
  label: string;
  unit: string;
  demoMid: number;
  demoAmp: number;
}[] = [
  { key: "ph", label: "pH", unit: "", demoMid: 7.2, demoAmp: 0.35 },
  { key: "chlorine", label: "Chlorine", unit: "mg/L", demoMid: 1.85, demoAmp: 0.22 },
  { key: "temp", label: "Temperature", unit: "°C", demoMid: 25.2, demoAmp: 1.1 },
  { key: "flow", label: "Flow", unit: "L/h", demoMid: 1380, demoAmp: 140 },
];

type RangeKey = "day" | "week" | "month";

function rangeBounds(r: RangeKey): { from: Date; to: Date; buckets: number } {
  const to = new Date();
  const from = new Date(to);
  if (r === "day") {
    from.setTime(to.getTime() - 24 * 60 * 60 * 1000);
    return { from, to, buckets: 24 };
  }
  if (r === "week") {
    from.setTime(to.getTime() - 7 * 24 * 60 * 60 * 1000);
    return { from, to, buckets: 7 };
  }
  from.setTime(to.getTime() - 30 * 24 * 60 * 60 * 1000);
  return { from, to, buckets: 30 };
}

function bucketAggregate(
  readings: SensorReadingOut[],
  from: Date,
  to: Date,
  bucketCount: number,
): { label: string; value: number; idx: number }[] {
  const span = to.getTime() - from.getTime();
  const ms = span / bucketCount;
  const acc: number[][] = Array.from({ length: bucketCount }, () => []);
  for (const r of readings) {
    const t = new Date(r.observed_at).getTime();
    if (t < from.getTime() || t > to.getTime()) continue;
    const idx = Math.min(bucketCount - 1, Math.max(0, Math.floor((t - from.getTime()) / ms)));
    const v = parseReadingNum(r);
    if (v != null) acc[idx].push(v);
  }
  let last = 0;
  return acc.map((vals, i) => {
    const start = new Date(from.getTime() + i * ms);
    let label: string;
    if (bucketCount === 24) {
      label = start.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
    } else if (bucketCount === 7) {
      label = start.toLocaleDateString(undefined, { weekday: "short" });
    } else {
      label = `${start.getMonth() + 1}/${start.getDate()}`;
    }
    const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : NaN;
    const value = Number.isFinite(avg) ? avg : last;
    if (Number.isFinite(avg)) last = avg;
    return { label: i === bucketCount - 1 ? "Now" : label, value, idx: i };
  });
}

function demoAggregate(metricKey: MetricKey, range: RangeKey): { label: string; value: number; idx: number }[] {
  const { from, to, buckets } = rangeBounds(range);
  const meta = METRICS.find((m) => m.key === metricKey)!;
  const ms = (to.getTime() - from.getTime()) / buckets;
  const out: { label: string; value: number; idx: number }[] = [];
  for (let i = 0; i < buckets; i++) {
    const phase = (i / Math.max(1, buckets - 1)) * Math.PI * 2;
    const noise = (Math.sin(phase * 3.1) * 0.28 + Math.sin(phase * 1.3) * 0.55) * meta.demoAmp;
    const value = meta.demoMid + noise;
    const start = new Date(from.getTime() + i * ms);
    let label: string;
    if (buckets === 24) {
      label = start.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
    } else if (buckets === 7) {
      label = start.toLocaleDateString(undefined, { weekday: "short" });
    } else {
      label = `${start.getMonth() + 1}/${start.getDate()}`;
    }
    out.push({ label, value, idx: i });
  }
  if (out.length) out[out.length - 1].label = "Now";
  return out;
}

function demoSparkline(metricKey: MetricKey): { x: number; y: number }[] {
  const meta = METRICS.find((m) => m.key === metricKey)!;
  return Array.from({ length: 16 }, (_, i) => {
    const phase = (i / 15) * Math.PI * 2;
    const y = meta.demoMid + Math.sin(phase * 2) * meta.demoAmp * 0.4;
    return { x: i, y };
  });
}

function formatValue(v: number | null, unit: string): string {
  if (v == null || !Number.isFinite(v)) return "—";
  const abs = Math.abs(v);
  const dec = abs >= 100 ? 0 : abs >= 10 ? 1 : 2;
  return v.toFixed(dec) + (unit ? ` ${unit}` : "");
}

function pctChange(series: { value: number }[]): string | null {
  if (series.length < 2) return null;
  const a = series[series.length - 2]?.value;
  const b = series[series.length - 1]?.value;
  if (!Number.isFinite(a) || !Number.isFinite(b) || a === 0) return null;
  const p = ((b - a) / Math.abs(a)) * 100;
  if (!Number.isFinite(p)) return null;
  const sign = p >= 0 ? "+" : "";
  return `${sign}${p.toFixed(1)}% vs prior bucket`;
}

function statusStyle(subClass: "ok" | "warn" | "bad" | "neutral"): CSSProperties {
  if (subClass === "ok") return { color: "var(--ok)" };
  if (subClass === "warn") return { color: "var(--admin-warning, #fbbf24)" };
  if (subClass === "bad") return { color: "var(--danger)" };
  return { color: "var(--muted)" };
}

export default function MonitoringPage() {
  const sensorMap = useMemo(() => loadSensorIdMap(), []);
  const demoMode = sensorMap == null;

  const [details, setDetails] = useState<Partial<Record<MetricKey, SensorDetailOut>>>({});
  const [sparkByMetric, setSparkByMetric] = useState<Partial<Record<MetricKey, SensorReadingOut[]>>>({});
  const [chartReadings, setChartReadings] = useState<SensorReadingOut[]>([]);
  const [range, setRange] = useState<RangeKey>("day");
  const [chartMetric, setChartMetric] = useState<MetricKey>("ph");
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(!demoMode);

  const loadCards = useCallback(async () => {
    if (!sensorMap) return;
    setLoading(true);
    setLoadErr(null);
    try {
      const entries = METRICS.filter((m) => sensorMap[m.key]);
      const results = await Promise.all(
        entries.map(async (m) => {
          const id = sensorMap[m.key]!;
          const detail = await getSensorDetail(id);
          const to = new Date();
          const from = new Date(to.getTime() - 8 * 60 * 60 * 1000);
          const spark = await getSensorReadings(id, from, to, 64);
          return { key: m.key, detail, spark };
        }),
      );
      const d: Partial<Record<MetricKey, SensorDetailOut>> = {};
      const s: Partial<Record<MetricKey, SensorReadingOut[]>> = {};
      for (const r of results) {
        d[r.key] = r.detail;
        s[r.key] = r.spark;
      }
      setDetails(d);
      setSparkByMetric(s);
    } catch (e: unknown) {
      setLoadErr(e instanceof Error ? e.message : "Failed to load monitoring data");
    } finally {
      setLoading(false);
    }
  }, [sensorMap]);

  useEffect(() => {
    if (sensorMap) void loadCards();
  }, [sensorMap, loadCards]);

  const { from, to, buckets } = rangeBounds(range);
  const chartSensorId = sensorMap?.[chartMetric];

  useEffect(() => {
    if (demoMode || !chartSensorId) {
      setChartReadings([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const rows = await getSensorReadings(chartSensorId, from, to, 3000);
        if (!cancelled) setChartReadings(rows);
      } catch {
        if (!cancelled) setChartReadings([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [demoMode, chartSensorId, from, to, range]);

  const chartData = useMemo(() => {
    if (demoMode) return demoAggregate(chartMetric, range);
    if (!chartReadings.length) return demoAggregate(chartMetric, range);
    return bucketAggregate(chartReadings, from, to, buckets);
  }, [demoMode, chartMetric, range, chartReadings, from, to, buckets]);

  const chartTitle = useMemo(() => {
    const m = METRICS.find((x) => x.key === chartMetric);
    const r = range === "day" ? "24h" : range === "week" ? "7d" : "30d";
    return `${r} ${m?.label ?? chartMetric} (bucketed average)`;
  }, [chartMetric, range]);

  const exportCsv = () => {
    const lines = ["label,value", ...chartData.map((row) => `${row.label},${row.value}`)];
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `monitoring-${chartMetric}-${range}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const tooltipStyle = {
    borderRadius: 8,
    border: "1px solid var(--border)",
    background: "var(--surface)",
    color: "var(--text)",
    fontSize: 13,
  };

  return (
    <>
      <div className="wr-page-head">
        <div className="wr-page-titles">
          <h2>Monitoring</h2>
          <p>
            pH, chlorine, temperature, and flow with recent trends. Same layout as Work Requests and other tenant
            modules.
          </p>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
          <button type="button" className="btn" onClick={exportCsv}>
            Export CSV
          </button>
          <button type="button" className="wr-btn-primary" onClick={() => loadCards()} disabled={!sensorMap}>
            Refresh
          </button>
        </div>
      </div>

      {demoMode ? (
        <div className="admin-feed-item admin-feed-item--warning" style={{ marginBottom: "1rem" }}>
          <div className="admin-feed-type">Demo data</div>
          <div className="admin-feed-meta">
            Synthetic series for all four metrics. Set{" "}
            <code className="mono" style={{ fontSize: "0.8em" }}>
              NEXT_PUBLIC_MONITORING_SENSORS
            </code>{" "}
            to a JSON map (keys: ph, chlorine, temp, flow) with sensor UUIDs to load live API data.
          </div>
        </div>
      ) : null}

      {loadErr ? (
        <p style={{ color: "var(--danger)", marginBottom: "1rem" }}>{loadErr}</p>
      ) : null}
      {loading ? (
        <p style={{ color: "var(--muted)", marginBottom: "1rem" }}>Loading sensors…</p>
      ) : null}

      <div className="admin-grid-kpis" style={{ marginBottom: "1.25rem" }}>
        {METRICS.map((m) => {
          const d = details[m.key];
          const latest = d?.latest_reading ? parseReadingNum(d.latest_reading) : null;
          const displayVal = demoMode ? demoSparkline(m.key).slice(-1)[0]?.y ?? null : latest;
          const fresh = d?.freshness;
          const rawSpark = sparkByMetric[m.key] ?? [];
          const sparkData = demoMode
            ? demoSparkline(m.key)
            : rawSpark.length >= 2
              ? rawSpark.map((r, i) => ({
                  x: i,
                  y: parseReadingNum(r) ?? 0,
                }))
              : [
                  { x: 0, y: latest ?? 0 },
                  { x: 1, y: latest ?? 0 },
                ];

          let sub = "Stable";
          let tone: "ok" | "warn" | "bad" | "neutral" = "neutral";
          if (!demoMode && sensorMap && !sensorMap[m.key]) {
            sub = "Not mapped in env";
            tone = "warn";
          } else if (!demoMode && fresh === "live") {
            sub = "Live";
            tone = "ok";
          } else if (!demoMode && fresh === "delayed") {
            sub = "Delayed";
            tone = "warn";
          } else if (!demoMode && fresh === "stale") {
            sub = "Stale";
            tone = "bad";
          } else if (demoMode) {
            const ch = pctChange(demoAggregate(m.key, "day").map((x) => ({ value: x.value })));
            sub = ch ?? "Sample trend";
            tone = ch && ch.startsWith("+") ? "ok" : "warn";
          }

          const flowWarn =
            m.key === "flow" && displayVal != null && Number.isFinite(displayVal) && displayVal < 900;
          if (flowWarn) {
            sub = "Low flow warning";
            tone = "bad";
          }

          return (
            <div key={m.key} className="admin-kpi">
              <div className="admin-kpi-label">{m.label}</div>
              <div className="admin-kpi-value" style={{ fontSize: "1.5rem" }}>
                {formatValue(displayVal, m.unit).replace(` ${m.unit}`, "")}
                {m.unit ? (
                  <span style={{ fontSize: "0.95rem", color: "var(--muted)", fontWeight: 600 }}> {m.unit}</span>
                ) : null}
              </div>
              <p style={{ margin: "0.35rem 0 0", fontSize: "0.82rem", ...statusStyle(tone) }}>{sub}</p>
              <div style={{ height: 44, marginTop: "0.5rem" }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={sparkData} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
                    <Line type="monotone" dataKey="y" stroke={CHART_BAR_LAST} strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          );
        })}
      </div>

      <div className="admin-panel">
        <div className="admin-panel-head">
          <span>{chartTitle}</span>
          <div className="wr-segment" role="tablist" aria-label="Time range">
            {(
              [
                ["day", "Day"],
                ["week", "Week"],
                ["month", "Month"],
              ] as const
            ).map(([k, lab]) => (
              <button
                key={k}
                type="button"
                role="tab"
                aria-selected={range === k}
                className={`wr-chip ${range === k ? "is-active" : ""}`}
                onClick={() => setRange(k)}
              >
                {lab}
              </button>
            ))}
          </div>
        </div>
        <div className="admin-panel-body" style={{ padding: "1rem" }}>
          <div className="wr-chip-group wr-chip-group--spaced" style={{ marginBottom: "0.75rem" }}>
            <span style={{ fontSize: "0.78rem", color: "var(--muted)", marginRight: "0.35rem" }}>Metric</span>
            {METRICS.map((m) => (
              <button
                key={m.key}
                type="button"
                className={`wr-chip ${chartMetric === m.key ? "is-active" : ""}`}
                onClick={() => setChartMetric(m.key)}
              >
                {m.label}
              </button>
            ))}
          </div>
          <div style={{ width: "100%", height: 320 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 8, right: 12, left: 4, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: CHART_MUTED }} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 11, fill: CHART_MUTED }} width={48} />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(v: number) => [
                    v.toFixed(2),
                    METRICS.find((x) => x.key === chartMetric)?.label ?? "",
                  ]}
                />
                <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                  {chartData.map((_, i) => (
                    <Cell
                      key={i}
                      fill={i === chartData.length - 1 ? CHART_BAR_LAST : CHART_BAR}
                      fillOpacity={i === chartData.length - 1 ? 1 : 0.85}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </>
  );
}
