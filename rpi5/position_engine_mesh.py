#!/usr/bin/env python3
"""
Pulse · RPI5 Position Engine  (Mesh Edition)
════════════════════════════════════════════════════════════════════════════════
Updated for ESP-NOW mesh topology:
  [BLE Beacons] → [Nodes via ESP-NOW] → [Gateways via LTE Hub WiFi] → [This script via MQTT]

Key differences from the single-gateway version
-------------------------------------------------
- MQTT payloads now include a "node" field per reading (which Node saw it)
- Gateway positions are loaded from the FastAPI backend on startup
  (so you set them once in the Devices tab — no hardcoding needed)
- Node IDs are tracked for debugging but trilateration still uses Gateway positions
  (Nodes don't have fixed positions registered — only Gateways do)
- Render cold-start handled: retries bootstrap on failure with backoff

How to run
-----------
  pip3 install paho-mqtt requests numpy
  python3 position_engine.py

Set environment variables (or edit CONFIG below):
  FASTAPI_URL      https://your-app.onrender.com
  TELEMETRY_KEY    your-secret-key
  GATEWAY_UUID     your-gateway-uuid   ← from Devices tab (for auth)
  GATEWAY_SECRET   your-ingest-secret  ← from Devices tab (for auth)
"""

from __future__ import annotations

import json
import logging
import os
import signal
import sys
import time
from collections import defaultdict
from dataclasses import dataclass, field
from threading import Event, Lock, Thread
from typing import Optional

import numpy as np
import paho.mqtt.client as mqtt
import requests

# ══════════════════════════════════════════════════════════════════════════════
# CONFIG
# ══════════════════════════════════════════════════════════════════════════════

FASTAPI_BASE   = os.getenv("FASTAPI_URL",    "https://your-app.onrender.com")
TELEMETRY_KEY  = os.getenv("TELEMETRY_KEY",  "your-secret-key")

# Auth for the telemetry ingest endpoint (from the Devices tab in Pulse)
# The RPI5 acts as one of the registered gateways for auth purposes.
# Use the "primary" gateway UUID and secret — the one closest to the RPI5.
GATEWAY_UUID   = os.getenv("GATEWAY_UUID",   "your-gateway-uuid-here")
GATEWAY_SECRET = os.getenv("GATEWAY_SECRET", "your-ingest-secret-here")

MQTT_HOST      = os.getenv("MQTT_HOST", "localhost")
MQTT_PORT      = int(os.getenv("MQTT_PORT", "1883"))

PUBLISH_INTERVAL_SEC     = 2.0
GATEWAY_READING_MAX_AGE  = 8.0    # seconds — ignore stale readings
MIN_GATEWAYS_FOR_POSITION = 2
KALMAN_R                 = 3.0
KALMAN_Q                 = 0.1
TX_POWER_DBM             = -62.0
PATH_LOSS_EXPONENT       = 2.7

# Real facility dimensions (approximate is fine)
FACILITY_WIDTH_M  = float(os.getenv("FACILITY_WIDTH_M",  "80"))
FACILITY_HEIGHT_M = float(os.getenv("FACILITY_HEIGHT_M", "60"))

# ══════════════════════════════════════════════════════════════════════════════
# LOGGING
# ══════════════════════════════════════════════════════════════════════════════

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(name)s  %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("pulse.position_engine")

# ══════════════════════════════════════════════════════════════════════════════
# BOOTSTRAP — load gateway positions from FastAPI on startup
# ══════════════════════════════════════════════════════════════════════════════
#
# Gateway positions are stored in Supabase (automation_gateways.x_norm, y_norm).
# We fetch them once on startup so operators set positions in the Devices tab
# rather than hardcoding them here.
#
# NOTE: The AutomationGateway model doesn't have x_norm/y_norm yet.
# Until that migration runs (add it alongside 0068), this falls back to the
# FALLBACK_GATEWAY_POSITIONS dict below.
# Add the migration: op.add_column('automation_gateways', Column('x_norm', Float, nullable=True))
#                    op.add_column('automation_gateways', Column('y_norm', Float, nullable=True))

# Fallback: used if the API doesn't return positions yet.
# Set these accurately — they're the physical (x, y) of each Gateway ESP32
# as a fraction of your floor plan (0.0 = left/top, 1.0 = right/bottom).
FALLBACK_GATEWAY_POSITIONS: dict[str, tuple[float, float]] = {
    "gw-fitness-01":  (0.20, 0.24),
    "gw-pool-01":     (0.20, 0.71),
    "gw-ice-a-01":    (0.52, 0.27),
    "gw-ice-b-01":    (0.52, 0.74),
    "gw-courts-01":   (0.82, 0.35),
    "gw-mech-01":     (0.82, 0.82),
    "gw-central-01":  (0.50, 0.50),
}

def bootstrap_gateway_positions(session: requests.Session) -> dict[str, tuple[float, float]]:
    """
    Fetch gateway positions from the FastAPI /api/v1/gateways endpoint.
    Returns {gateway_identifier: (x_norm, y_norm)}.

    Falls back to FALLBACK_GATEWAY_POSITIONS if the API is unreachable
    or gateways don't have positions set yet.
    """
    url = f"{FASTAPI_BASE}/api/v1/gateways"
    for attempt in range(5):
        try:
            resp = session.get(url, timeout=10)
            resp.raise_for_status()
            gateways = resp.json()

            positions: dict[str, tuple[float, float]] = {}
            for gw in gateways:
                identifier = gw.get("identifier") or gw.get("id")
                x = gw.get("x_norm")
                y = gw.get("y_norm")
                if identifier and x is not None and y is not None:
                    positions[identifier] = (float(x), float(y))

            if positions:
                log.info("Loaded %d gateway positions from API", len(positions))
                return positions
            else:
                log.warning("API returned gateways but no positions — using fallback")
                return FALLBACK_GATEWAY_POSITIONS

        except requests.exceptions.ConnectionError:
            wait = 2 ** attempt
            log.warning(
                "FastAPI unreachable (attempt %d/5) — Render cold start? Retrying in %ds",
                attempt + 1, wait,
            )
            time.sleep(wait)
        except Exception as e:
            log.warning("Gateway bootstrap failed: %s — using fallback", e)
            return FALLBACK_GATEWAY_POSITIONS

    log.warning("Bootstrap gave up — using fallback gateway positions")
    return FALLBACK_GATEWAY_POSITIONS

# ══════════════════════════════════════════════════════════════════════════════
# KALMAN FILTER
# ══════════════════════════════════════════════════════════════════════════════

class KalmanRSSI:
    __slots__ = ("R", "Q", "x", "P")

    def __init__(self) -> None:
        self.R = KALMAN_R
        self.Q = KALMAN_Q
        self.x: Optional[float] = None
        self.P = 1.0

    def update(self, z: float) -> float:
        if self.x is None:
            self.x = z
            return z
        self.P += self.Q
        K = self.P / (self.P + self.R)
        self.x += K * (z - self.x)
        self.P *= (1.0 - K)
        return self.x

# ══════════════════════════════════════════════════════════════════════════════
# TRILATERATION
# ══════════════════════════════════════════════════════════════════════════════

def rssi_to_distance_m(rssi: float) -> float:
    return 10.0 ** ((TX_POWER_DBM - rssi) / (10.0 * PATH_LOSS_EXPONENT))


def trilaterate(
    gw_positions_m: list[tuple[float, float]],
    distances_m: list[float],
) -> Optional[tuple[float, float]]:
    n = len(gw_positions_m)
    if n < MIN_GATEWAYS_FOR_POSITION:
        return None
    if n == 1:
        return gw_positions_m[0]

    x0, y0, d0 = gw_positions_m[0][0], gw_positions_m[0][1], distances_m[0]
    A, b = [], []
    for (xi, yi), di in zip(gw_positions_m[1:], distances_m[1:]):
        A.append([2.0 * (xi - x0), 2.0 * (yi - y0)])
        b.append(d0**2 - di**2 - x0**2 + xi**2 - y0**2 + yi**2)

    try:
        result, _, _, _ = np.linalg.lstsq(np.array(A), np.array(b), rcond=None)
    except np.linalg.LinAlgError:
        return None

    return (float(result[0]), float(result[1]))


def metres_to_norm(x_m: float, y_m: float) -> tuple[float, float]:
    return (
        max(0.0, min(1.0, x_m / FACILITY_WIDTH_M)),
        max(0.0, min(1.0, y_m / FACILITY_HEIGHT_M)),
    )

def norm_to_metres(x_n: float, y_n: float) -> tuple[float, float]:
    return (x_n * FACILITY_WIDTH_M, y_n * FACILITY_HEIGHT_M)

def position_confidence(distances_m: list[float], n_gateways: int) -> float:
    if n_gateways < 2:
        return 0.1
    gw_score   = min(1.0, (n_gateways - 1) / 4.0)
    avg_d      = sum(distances_m) / len(distances_m)
    dist_score = max(0.0, 1.0 - avg_d / 30.0)
    return round(gw_score * 0.6 + dist_score * 0.4, 3)

# ══════════════════════════════════════════════════════════════════════════════
# STATE
# ══════════════════════════════════════════════════════════════════════════════

@dataclass
class GatewayReading:
    smoothed_rssi: float
    raw_rssi: float
    node_id: str          # which Node forwarded this reading ("self" = gateway's own scan)
    recorded_at: float    # wall-clock time.time()

@dataclass
class BeaconState:
    # {gateway_identifier: GatewayReading}
    gateway_readings: dict[str, GatewayReading] = field(default_factory=dict)
    # {gateway_identifier: KalmanRSSI}
    kalman_filters: dict[str, KalmanRSSI] = field(
        default_factory=lambda: defaultdict(KalmanRSSI)
    )

_state_lock  = Lock()
_beacon_state: dict[str, BeaconState] = defaultdict(BeaconState)

# ══════════════════════════════════════════════════════════════════════════════
# MQTT CALLBACKS
# ══════════════════════════════════════════════════════════════════════════════

def on_connect(client: mqtt.Client, userdata, flags, rc: int) -> None:
    if rc == 0:
        log.info("MQTT connected to %s:%d", MQTT_HOST, MQTT_PORT)
        client.subscribe("ble/rssi/#")
        log.info("Subscribed to ble/rssi/#")
    else:
        log.error("MQTT connection failed rc=%d", rc)


def on_message(client: mqtt.Client, userdata, msg: mqtt.MQTTMessage) -> None:
    """
    Handle MQTT message from a Gateway ESP32.

    Payload shape (from gateway firmware):
    {
        "gateway_id": "gw-ice-a-01",
        "ts": 1714000000,
        "readings": [
            {"mac": "AA:BB:CC:DD:EE:FF", "rssi": -65, "node": "node-ice-a-01"},
            {"mac": "AA:BB:CC:DD:EE:FF", "rssi": -68, "node": "self"},
            ...
        ]
    }

    The "node" field tells us which Node saw this beacon — useful for debugging
    but trilateration uses the Gateway's position (the node's exact position
    isn't stored — it's a scanner, not a reference point).
    """
    try:
        data = json.loads(msg.payload)
    except json.JSONDecodeError:
        return

    gateway_id = data.get("gateway_id") or msg.topic.split("/")[-1]
    readings   = data.get("readings") or []
    now        = time.time()

    with _state_lock:
        for r in readings:
            mac     = str(r.get("mac") or "").upper().strip()
            rssi    = r.get("rssi")
            node_id = str(r.get("node") or "unknown")

            if not mac or rssi is None or len(mac) < 12:
                continue

            state    = _beacon_state[mac]
            smoothed = state.kalman_filters[gateway_id].update(float(rssi))
            state.gateway_readings[gateway_id] = GatewayReading(
                smoothed_rssi=smoothed,
                raw_rssi=float(rssi),
                node_id=node_id,
                recorded_at=now,
            )

    log.debug("gateway=%s readings=%d", gateway_id, len(readings))


def on_disconnect(client: mqtt.Client, userdata, rc: int) -> None:
    if rc != 0:
        log.warning("MQTT disconnected unexpectedly rc=%d", rc)

# ══════════════════════════════════════════════════════════════════════════════
# POSITION COMPUTATION
# ══════════════════════════════════════════════════════════════════════════════

def compute_positions(
    gateway_positions: dict[str, tuple[float, float]],
) -> list[dict]:
    now       = time.time()
    positions = []

    with _state_lock:
        snapshot = {
            mac: dict(state.gateway_readings)
            for mac, state in _beacon_state.items()
        }

    for mac, gw_readings in snapshot.items():
        # Only use fresh readings from known gateways
        fresh = {
            gw_id: reading
            for gw_id, reading in gw_readings.items()
            if (now - reading.recorded_at) <= GATEWAY_READING_MAX_AGE
            and gw_id in gateway_positions
        }

        if not fresh:
            continue

        gw_positions_m: list[tuple[float, float]] = []
        distances_m:    list[float]                = []
        node_sources:   list[str]                  = []

        for gw_id, reading in fresh.items():
            gw_m   = norm_to_metres(*gateway_positions[gw_id])
            dist_m = rssi_to_distance_m(reading.smoothed_rssi)
            gw_positions_m.append(gw_m)
            distances_m.append(dist_m)
            node_sources.append(reading.node_id)

        result_m = trilaterate(gw_positions_m, distances_m)
        if result_m is None:
            continue

        x_norm, y_norm = metres_to_norm(*result_m)
        conf           = position_confidence(distances_m, len(fresh))

        positions.append({
            "mac":                 mac,
            "x_norm":              round(x_norm, 4),
            "y_norm":              round(y_norm, 4),
            "position_confidence": conf,
        })

        log.debug(
            "mac=%-17s  x=%.3f  y=%.3f  conf=%.2f  gateways=%d  nodes=%s",
            mac, x_norm, y_norm, conf, len(fresh),
            ",".join(set(node_sources)),
        )

    return positions

# ══════════════════════════════════════════════════════════════════════════════
# PUBLISH LOOP
# ══════════════════════════════════════════════════════════════════════════════

def publish_loop(
    stop_event: Event,
    gateway_positions: dict[str, tuple[float, float]],
) -> None:
    session = requests.Session()
    session.headers.update({
        "Content-Type":    "application/json",
        "X-Gateway-Id":    GATEWAY_UUID,
        "Authorization":   f"Bearer {GATEWAY_SECRET}",
    })

    consecutive_failures = 0
    url = f"{FASTAPI_BASE}/api/v1/telemetry/ingest"

    while not stop_event.is_set():
        loop_start = time.time()

        positions = compute_positions(gateway_positions)

        if positions:
            payload = {"readings": [], "computed_positions": positions}
            try:
                resp = session.post(url, json=payload, timeout=6.0)
                resp.raise_for_status()
                data = resp.json()
                consecutive_failures = 0
                log.info(
                    "published  positions=%d  upserted=%d  proximity_events=%d",
                    len(positions),
                    data.get("positions_upserted", "?"),
                    data.get("proximity_events_fired", "?"),
                )
            except requests.exceptions.Timeout:
                consecutive_failures += 1
                log.warning("FastAPI timeout (fail #%d)", consecutive_failures)
            except requests.exceptions.ConnectionError:
                consecutive_failures += 1
                log.warning("FastAPI unreachable (fail #%d)", consecutive_failures)
            except requests.exceptions.HTTPError as e:
                consecutive_failures += 1
                log.error("FastAPI HTTP error %s (fail #%d)", e, consecutive_failures)
            except Exception as e:
                consecutive_failures += 1
                log.error("publish error: %s (fail #%d)", e, consecutive_failures)

            if consecutive_failures >= 5:
                log.warning("Backing off 30s after 5 consecutive failures")
                stop_event.wait(30.0)
                consecutive_failures = 0

        elapsed  = time.time() - loop_start
        sleep_for = max(0.0, PUBLISH_INTERVAL_SEC - elapsed)
        stop_event.wait(sleep_for)

# ══════════════════════════════════════════════════════════════════════════════
# MAIN
# ══════════════════════════════════════════════════════════════════════════════

def main() -> None:
    log.info("Pulse Position Engine (Mesh Edition) starting")

    # Bootstrap session — used for both gateway fetch and telemetry publish
    bootstrap_session = requests.Session()
    bootstrap_session.headers.update({"X-Gateway-Id": GATEWAY_UUID,
                                      "Authorization": f"Bearer {GATEWAY_SECRET}"})

    # Load gateway positions from Pulse backend
    gateway_positions = bootstrap_gateway_positions(bootstrap_session)
    log.info("Gateway map: %s", list(gateway_positions.keys()))

    stop_event = Event()

    def _shutdown(sig, frame):
        log.info("Shutdown signal — stopping cleanly")
        stop_event.set()

    signal.signal(signal.SIGINT,  _shutdown)
    signal.signal(signal.SIGTERM, _shutdown)

    # Start publish thread
    publisher = Thread(
        target=publish_loop,
        args=(stop_event, gateway_positions),
        daemon=True,
        name="publisher",
    )
    publisher.start()

    # MQTT client
    client = mqtt.Client(client_id="pulse-position-engine")
    client.on_connect    = on_connect
    client.on_message    = on_message
    client.on_disconnect = on_disconnect

    try:
        client.connect(MQTT_HOST, MQTT_PORT, keepalive=60)
        client.loop_start()
        log.info("MQTT listener running — waiting for gateway data")
        stop_event.wait()
    finally:
        client.loop_stop()
        client.disconnect()
        publisher.join(timeout=5.0)
        log.info("Position engine stopped")


if __name__ == "__main__":
    main()


# ══════════════════════════════════════════════════════════════════════════════
# SYSTEMD UNIT FILE
# /etc/systemd/system/pulse-position-engine.service
#
# sudo systemctl daemon-reload
# sudo systemctl enable pulse-position-engine
# sudo systemctl start pulse-position-engine
# sudo journalctl -u pulse-position-engine -f
# ══════════════════════════════════════════════════════════════════════════════
SYSTEMD_UNIT = """
[Unit]
Description=Pulse BLE Position Engine (Mesh)
After=network-online.target mosquitto.service
Wants=network-online.target mosquitto.service

[Service]
Type=simple
User=pi
WorkingDirectory=/home/pi/pulse
Environment=FASTAPI_URL=https://your-app.onrender.com
Environment=TELEMETRY_KEY=your-secret-key
Environment=GATEWAY_UUID=your-gateway-uuid
Environment=GATEWAY_SECRET=your-ingest-secret
Environment=FACILITY_WIDTH_M=80
Environment=FACILITY_HEIGHT_M=60
ExecStart=/usr/bin/python3 /home/pi/pulse/position_engine.py
Restart=on-failure
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
"""
