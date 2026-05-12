"use client";

import { useCallback, useEffect, useState } from "react";
import { Cloud, CloudRain, Sun } from "lucide-react";
import { cn } from "@/lib/cn";

const DEFAULT_TZ = "America/Vancouver";
/** Greater Vancouver — override with NEXT_PUBLIC_OPS_WEATHER_LAT / NEXT_PUBLIC_OPS_WEATHER_LON */
const DEFAULT_LAT = 49.25;
const DEFAULT_LON = -123.12;

function parseEnvFloat(key: string, fallback: number): number {
  if (typeof process === "undefined") return fallback;
  const raw = process.env[key];
  if (raw == null || raw === "") return fallback;
  const n = Number.parseFloat(raw);
  return Number.isFinite(n) ? n : fallback;
}

function wmoShortLabel(code: number): string {
  if (code === 0) return "Clear";
  if (code === 1) return "Mostly clear";
  if (code === 2) return "Partly cloudy";
  if (code === 3) return "Overcast";
  if (code === 45 || code === 48) return "Fog";
  if (code >= 51 && code <= 57) return "Drizzle";
  if (code >= 61 && code <= 67) return "Rain";
  if (code >= 71 && code <= 77) return "Snow";
  if (code >= 80 && code <= 82) return "Showers";
  if (code >= 85 && code <= 86) return "Snow showers";
  if (code >= 95 && code <= 99) return "Thunderstorm";
  return "Mixed";
}

function weatherIcon(code: number) {
  if (code === 0 || code === 1) return Sun;
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82) || (code >= 95 && code <= 99)) return CloudRain;
  return Cloud;
}

type WeatherSnap = { tempC: number; code: number };

async function fetchCurrentWeather(lat: number, lon: number, timeZone: string): Promise<WeatherSnap | null> {
  const u = new URL("https://api.open-meteo.com/v1/forecast");
  u.searchParams.set("latitude", String(lat));
  u.searchParams.set("longitude", String(lon));
  u.searchParams.set("current", "temperature_2m,weather_code");
  u.searchParams.set("timezone", timeZone);
  u.searchParams.set("forecast_days", "1");
  const res = await fetch(u.toString(), { cache: "no-store" });
  if (!res.ok) return null;
  const data = (await res.json()) as {
    current?: { temperature_2m?: number; weather_code?: number };
  };
  const cur = data.current;
  if (cur == null || typeof cur.temperature_2m !== "number" || typeof cur.weather_code !== "number") return null;
  return { tempC: cur.temperature_2m, code: cur.weather_code };
}

export function OpsHeaderWeather({ className }: { className?: string }) {
  const [snap, setSnap] = useState<WeatherSnap | null>(null);

  const lat = parseEnvFloat("NEXT_PUBLIC_OPS_WEATHER_LAT", DEFAULT_LAT);
  const lon = parseEnvFloat("NEXT_PUBLIC_OPS_WEATHER_LON", DEFAULT_LON);
  const disabled =
    typeof process !== "undefined" && process.env.NEXT_PUBLIC_OPS_WEATHER_DISABLED === "1";

  const load = useCallback(async () => {
    if (disabled) return;
    try {
      const next = await fetchCurrentWeather(lat, lon, DEFAULT_TZ);
      setSnap((prev) => (next != null ? next : prev));
    } catch {
      setSnap((prev) => prev);
    }
  }, [disabled, lat, lon]);

  useEffect(() => {
    void load();
    if (disabled) return undefined;
    const id = window.setInterval(() => void load(), 30 * 60 * 1000);
    return () => window.clearInterval(id);
  }, [load, disabled]);

  if (disabled || !snap) return null;

  const Icon = weatherIcon(snap.code);
  const label = wmoShortLabel(snap.code);
  const t = Math.round(snap.tempC);

  return (
    <p
      className={cn(
        "inline-flex items-center gap-1.5 text-xs font-medium tabular-nums text-[color-mix(in_srgb,var(--ds-text-primary)_62%,transparent)]",
        className,
      )}
      aria-label={`Current weather: ${t} degrees Celsius, ${label}`}
      aria-live="polite"
    >
      <Icon className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
      <span>
        {t}°C · {label}
      </span>
    </p>
  );
}
