#!/usr/bin/env python3
"""
Pulse · Single-Gateway Position Engine (Laptop / Office Demo)
════════════════════════════════════════════════════════════════════════════════
Stripped-down version of position_engine_mesh.py for running on your laptop
during the office demo. No RPI5. No mesh. Just:

  [Beacon] → [1 × ESP32 Gateway] → [Mosquitto on laptop] → [This script] → [FastAPI]

What's different from the full position engine
------------------------------------------------
- No trilateration (need 2+ gateways for that — coming when you get home)
- Zone assignment comes from the gateway's registered zone_id instead
- Still does Kalman filtering on RSSI (keeps the signal stable)
- Still computes a single (x, y) estimate — just less accurate
  (places beacon at gateway position with a small offset based on signal strength)
- Still fires proximity events → inference engine → ProximityPromptBanner

This IS enough to demo the full inference flow end-to-end.
The dot on the map won't move smoothly — it'll pulse in the Pool zone.
That's fine. The notification firing on the Expo app is the demo moment.

Setup (one-time, on your laptop)
----------------------------------
Mac:
  brew install mosquitto
  brew services start mosquitto
  pip3 install paho-mqtt requests numpy

Windows:
  Download Mosquitto installer from mosquitto.org
  pip install paho-mqtt requests numpy

Run:
  python3 position_engine_single.py

Then open a second terminal and check MQTT is working:
  mosquitto_sub -t "ble/rssi/#" -v
  (you should see messages appear when the ESP32 is running)
"""

from __future__ import annotations

import json
import logging
import math
import os
import signal
import time
from collections import defaultdict
from dataclasses import dataclass, field
from threading import Event, Lock, Thread
from typing import Optional

import requests

try:
    import paho.mqtt.client as mqtt
except ImportError:
    print("ERROR: paho-mqtt not installed. Run: pip3 install paho-mqtt requests numpy")
    raise

# ══════════════════════════════════════════════════════════════════════════════
# CONFIG — edit these before running
# ══════════════════════════════════════════════════════════════════════════════

# Your FastAPI backend — use localhost if running backend locally,
# or your Render URL if using the deployed version
FASTAPI_BASE   = os.getenv("FASTAPI_URL",    "http://localhost:8000")

# From the seed script output — copy exactly
GATEWAY_UUID   = os.getenv("GATEWAY_UUID",   "paste-gateway-uuid-here")
GATEWAY_SECRET = os.getenv("GATEWAY_SECRET", "paste-ingest-secret-here")

# Mosquitto is running locally on your laptop
MQTT_HOST = "localhost"
MQTT_PORT = 1883

# How often to POST positions to FastAPI
PUBLISH_INTERVAL_SEC = 2.0

# Kalman filter — same settings as full engine
KALMAN_R = 3.0
KALMAN_Q = 0.1

# BLE path loss model — tune after testing
TX_POWER_DBM       = -62.0
PATH_LOSS_EXPONENT =  2.7

# Ignore beacons weaker than this (reduces phantom detections)
RSSI_MIN_DBM = -90

# Reading older than this is ignored
MAX_READING_AGE_SEC = 8.0

# ══════════════════════════════════════════════════════════════════════════════
# LOGGING
# ══════════════════════════════════════════════════════════════════════════════

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("pulse.demo.position")

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


def rssi_to_distance_m(rssi: float) -> float:
    return 10.0 ** ((TX_POWER_DBM - rssi) / (10.0 * PATH_LOSS_EXPONENT))


# ══════════════════════════════════════════════════════════════════════════════
# STATE
# ══════════════════════════════════════════════════════════════════════════════

@dataclass
class BeaconReading:
    smoothed_rssi: float
    raw_rssi: float
    gateway_id: str
    recorded_at: float

_state_lock = Lock()
# {mac_address: {gateway_id: BeaconReading}}
_readings: dict[str, dict[str, BeaconReading]] = defaultdict(dict)
_kalman:   dict[str, dict[str, KalmanRSSI]]    = defaultdict(lambda: defaultdict(KalmanRSSI))

# ══════════════════════════════════════════════════════════════════════════════
# MQTT
# ══════════════════════════════════════════════════════════════════════════════

def on_connect(client, userdata, flags, rc: int) -> None:
    if rc == 0:
        log.info("MQTT connected to %s:%d", MQTT_HOST, MQTT_PORT)
        client.subscribe("ble/rssi/#")
        log.info("Subscribed to ble/rssi/# — waiting for ESP32 data…")
    else:
        log.error("MQTT connection refused rc=%d (is Mosquitto running?)", rc)


def on_message(client, userdata, msg) -> None:
    try:
        data = json.loads(msg.payload)
    except Exception:
        return

    gateway_id = data.get("gateway_id") or msg.topic.split("/")[-1]
    readings   = data.get("readings") or []
    now        = time.time()

    with _state_lock:
        for r in readings:
            mac  = str(r.get("mac") or "").upper().strip()
            rssi = r.get("rssi")
            if not mac or rssi is None or len(mac) < 12:
                continue
            if float(rssi) < RSSI_MIN_DBM:
                continue

            smoothed = _kalman[mac][gateway_id].update(float(rssi))
            _readings[mac][gateway_id] = BeaconReading(
                smoothed_rssi=smoothed,
                raw_rssi=float(rssi),
                gateway_id=gateway_id,
                recorded_at=now,
            )

    if readings:
        log.debug("rx gateway=%s macs=%d", gateway_id, len(readings))


def on_disconnect(client, userdata, rc: int) -> None:
    if rc != 0:
        log.warning("MQTT disconnected rc=%d — will auto-reconnect", rc)

# ══════════════════════════════════════════════════════════════════════════════
# POSITION COMPUTATION
# Single-gateway mode: place beacon at gateway position offset by distance.
# Not accurate (no trilateration) but sufficient for zone-level demo.
# ══════════════════════════════════════════════════════════════════════════════

# The gateway is in the Pool zone — centre of the zone on the floor plan
# This is just for visual placement on the map.
# Adjust to match where you physically put the ESP32.
GATEWAY_X_NORM = 0.50
GATEWAY_Y_NORM = 0.50

def compute_positions() -> list[dict]:
    now = time.time()
    positions = []

    with _state_lock:
        snapshot = {
            mac: dict(gw_readings)
            for mac, gw_readings in _readings.items()
        }

    for mac, gw_readings in snapshot.items():
        # Get the freshest reading (only 1 gateway in office demo)
        fresh = [
            r for r in gw_readings.values()
            if (now - r.recorded_at) <= MAX_READING_AGE_SEC
        ]
        if not fresh:
            continue

        # Use the strongest (most reliable) reading
        best = max(fresh, key=lambda r: r.smoothed_rssi)
        dist_m = rssi_to_distance_m(best.smoothed_rssi)

        # Place beacon at gateway position with a slight offset based on distance
        # This makes the dot "pulse" toward the beacon rather than sitting
        # exactly on the gateway marker — looks more natural on the map
        # Max offset = 0.15 (15% of floor plan) when beacon is 10m+ away
        offset = min(0.15, dist_m / 60.0)

        # Offset slightly toward bottom-right (away from gateway centre)
        x = min(1.0, max(0.0, GATEWAY_X_NORM + offset * 0.6))
        y = min(1.0, max(0.0, GATEWAY_Y_NORM + offset * 0.4))

        # Confidence is low with 1 gateway — honest about it
        conf = max(0.1, min(0.5, 1.0 - (dist_m / 15.0)))

        positions.append({
            "mac":                 mac,
            "x_norm":              round(x, 4),
            "y_norm":              round(y, 4),
            "position_confidence": round(conf, 3),
        })

        log.info(
            "beacon %-17s  rssi=%.0fdBm  dist=~%.1fm  conf=%.2f",
            mac, best.smoothed_rssi, dist_m, conf,
        )

    return positions


# ══════════════════════════════════════════════════════════════════════════════
# PUBLISH LOOP
# ══════════════════════════════════════════════════════════════════════════════

def publish_loop(stop_event: Event) -> None:
    session = requests.Session()
    session.headers.update({
        "Content-Type":  "application/json",
        "X-Gateway-Id":  GATEWAY_UUID,
        "Authorization": f"Bearer {GATEWAY_SECRET}",
    })
    url = f"{FASTAPI_BASE}/api/v1/telemetry/ingest"
    consecutive_failures = 0

    # Quick connectivity check on startup
    try:
        r = session.get(f"{FASTAPI_BASE}/health", timeout=5)
        if r.ok:
            log.info("FastAPI reachable at %s ✓", FASTAPI_BASE)
        else:
            log.warning("FastAPI returned %d — check URL and auth", r.status_code)
    except Exception:
        log.warning("FastAPI not reachable at %s — will keep retrying", FASTAPI_BASE)

    while not stop_event.is_set():
        loop_start = time.time()
        positions  = compute_positions()

        if positions:
            payload = {"readings": [], "computed_positions": positions}
            try:
                resp = session.post(url, json=payload, timeout=6.0)
                resp.raise_for_status()
                data = resp.json()
                consecutive_failures = 0
                log.info(
                    "→ FastAPI  positions=%d  upserted=%d  proximity_events=%d",
                    len(positions),
                    data.get("positions_upserted", "?"),
                    data.get("proximity_events_fired", "?"),
                )
            except requests.exceptions.ConnectionError:
                consecutive_failures += 1
                if consecutive_failures == 1:
                    log.warning("FastAPI unreachable — is your backend running?")
            except requests.exceptions.HTTPError as e:
                consecutive_failures += 1
                log.error("FastAPI error: %s", e)
                if e.response is not None and e.response.status_code == 401:
                    log.error("Auth failed — check GATEWAY_UUID and GATEWAY_SECRET")
            except Exception as e:
                consecutive_failures += 1
                log.error("Publish error: %s", e)

            if consecutive_failures >= 10:
                log.warning("10 failures — backing off 30s")
                stop_event.wait(30.0)
                consecutive_failures = 0
        else:
            log.debug("No beacons in range")

        elapsed   = time.time() - loop_start
        sleep_for = max(0.0, PUBLISH_INTERVAL_SEC - elapsed)
        stop_event.wait(sleep_for)


# ══════════════════════════════════════════════════════════════════════════════
# MAIN
# ══════════════════════════════════════════════════════════════════════════════

def main() -> None:
    print("""
╔═══════════════════════════════════════════════════════════════╗
║  Pulse · Single-Gateway Position Engine (Office Demo)        ║
╚═══════════════════════════════════════════════════════════════╝
""")

    if "paste-gateway-uuid-here" in GATEWAY_UUID:
        print("ERROR: Set GATEWAY_UUID and GATEWAY_SECRET at the top of this file.")
        print("       Run seed_demo_office.py first to get these values.\n")
        return

    log.info("Backend:  %s", FASTAPI_BASE)
    log.info("Gateway:  %s…", GATEWAY_UUID[:8])
    log.info("MQTT:     %s:%d", MQTT_HOST, MQTT_PORT)

    stop_event = Event()

    def _shutdown(sig, frame):
        print("\nShutting down…")
        stop_event.set()

    signal.signal(signal.SIGINT,  _shutdown)
    signal.signal(signal.SIGTERM, _shutdown)

    # Start publish thread
    Thread(
        target=publish_loop,
        args=(stop_event,),
        daemon=True,
        name="publisher",
    ).start()

    # MQTT
    client = mqtt.Client(client_id="pulse-demo-position-engine")
    client.on_connect    = on_connect
    client.on_message    = on_message
    client.on_disconnect = on_disconnect

    try:
        client.connect(MQTT_HOST, MQTT_PORT, keepalive=60)
        client.loop_start()
        print("Listening for beacons… (Ctrl+C to stop)\n")
        stop_event.wait()
    finally:
        client.loop_stop()
        client.disconnect()
        log.info("Stopped cleanly.")


if __name__ == "__main__":
    main()
