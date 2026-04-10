/**
 * What this file does (simple explanation):
 *
 * This is the on-site radio box firmware. It listens passively for Bluetooth beacons (tags) that
 * you configured, smooths noisy signal strength, guesses “near / medium / far” and “moving /
 * stationary,” and sends **short summaries** to your FastAPI server—without blocking the device.
 *
 * In plain terms:
 * Think of it like a motion-and-distance reporter on a wall: it does not talk to people; it
 * quietly watches badges and tool tags, then phones home with “here is what I think I see.”
 * Your backend then figures out **who** and **which tool** those tags belong to.
 *
 * Why this exists:
 * Raw radio is jumpy and repeats endlessly. This chip turns that stream into calmer, rate-limited
 * messages so the cloud does not drown and workers are not spammed by flapping state.
 *
 * How the bigger system fits together (step-by-step):
 *
 * 1. Tags advertised in the building are heard by one or more gateways like this one.
 * 2. This code filters, smooths, and classifies what it heard.
 * 3. It posts a `proximity_update` JSON payload over Wi‑Fi to your API.
 * 4. The server enriches addresses → real people/tools, picks which gateway to trust when several
 *    overlap, and runs proximity/automation rules (notifications, sessions, etc.).
 * 5. Your web UI helps teams install gateways, map zones, and monitor what happened.
 *
 * Technical stack note for implementers: Arduino framework + NimBLE-Arduino.
 * Copy include/secrets.h.example → include/secrets.h for Wi‑Fi and API settings.
 */

#include <Arduino.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <NimBLEDevice.h>
#include <cmath>
#include <cstring>
#include <ctime>
#include <cstdint>

// ---- User configuration -------------------------------------------------
// Create include/secrets.h from secrets.h.example
#if __has_include("secrets.h")
#include "secrets.h"
#else
#define WIFI_SSID "YOUR_SSID"
#define WIFI_PASS "YOUR_PASSWORD"
#define API_BASE_URL "{http://host:PORT}"
#define GATEWAY_ID "gateway-local-01"
#endif

#ifndef API_EVENTS_PATH
#define API_EVENTS_PATH "/api/v1/events"
#endif

// Install-time list: which radio addresses belong to a **person badge** vs **equipment tag**
// (determines which JSON field we fill when that address is heard).
struct KnownTag {
  const char *mac_str;
  bool is_worker;  // true → worker_tag_mac in JSON; false → equipment_tag_mac
};

static const KnownTag kKnownTags[] = {
    // TODO: replace with your registry
    {"AA:BB:CC:11:22:01", true},
    {"AA:BB:CC:11:22:02", false},
};
static constexpr size_t kNumKnownTags = sizeof(kKnownTags) / sizeof(kKnownTags[0]);

// Signal strength smoothing: a gentle rolling average so one bad reading does not jerk distance.
static constexpr float kRssiEmaAlpha = 0.3f;

// Distance bands use different “in” vs “out” thresholds so labels do not chatter at the edge.
static constexpr int kNearEnterDb = -65;  // from medium: smoothed above this → near
static constexpr int kNearExitDb = -68;   // from near: smoothed at/below → medium
static constexpr int kFarEnterDb = -80;   // from medium: smoothed below this → far
static constexpr int kFarExitDb = -77;    // from far: smoothed at/above → medium

// Movement hint: big enough jump in smoothed signal counts as “probably motion,” not wall bounce.
static constexpr int kMovementJumpDb = 5;
// Need this many consecutive "big jump" steps (after EMA update) to call moving
static constexpr int kMovingScoreThreshold = 2;
static constexpr int kMovingScoreMax = 4;

// Upload pacing: avoid stacking HTTP calls; still allow heartbeats and important changes.
static constexpr uint32_t kResendIntervalMs = 2000;
static constexpr uint32_t kMinHttpGapMs = 300;
static constexpr uint32_t kPerDeviceSendCooldownMs = 500;  // minimum gap between posts for same tag
static constexpr uint32_t kHttpCriticalRetryDelayMs = 180; // non-blocking single retry after failed critical POST

// WiFi
static constexpr uint32_t kWifiReconnectMs = 5000;

// NTP (UTC) for ISO8601 timestamps
static constexpr char kNtpServer[] = "pool.ntp.org";
static constexpr long kGmtOffsetSec = 0;
static constexpr int kDaylightOffsetSec = 0;

// Scan timing (Bluetooth units): how often and how long we listen each cycle.
static constexpr uint16_t kScanIntervalUnits = 320;  // ~200 ms
static constexpr uint16_t kScanWindowUnits = 160;      // ~100 ms

// Ignore advertisements weaker than this (noise / unreliable RSSI).
static constexpr int kRssiNoiseFloorDb = -90;

// If we stop hearing a tag for this long, assume it left range: say “far” once, then rest until it returns.
static constexpr uint32_t kDeviceExpireAfterMs = 3000;
// After reappear from expired_lost, hold off expiration this long (wrap-safe delta vs reacquired_at_ms).
static constexpr uint32_t kReacquireGraceMs = 1000;

// Cap |Δ smoothed RSSI| per EMA tick (dB) to limit single-packet impulse noise.
static constexpr float kEmaMaxStepDb = 6.0f;

// RSSI report window for optional payload metric (~1 s, wrap-safe).
static constexpr uint32_t kSeenCountWindowMs = 1000;

// After this many consecutive scan samples without a "large" RSSI step, reset movement score (avoids stuck "moving").
static constexpr uint8_t kMoveStableCyclesForReset = 5;

// ---- Tag state ----------------------------------------------------------

enum class DistanceClass : uint8_t { Near, Medium, Far };

enum class MovementClass : uint8_t { Stationary, Moving };

struct TagState {
  uint8_t mac[6];
  bool is_worker;
  bool valid;
  int8_t rssi;
  float smoothed_rssi;
  bool smoothed_init;
  uint32_t last_seen_ms;
  uint32_t last_sent_ms;
  DistanceClass distance;
  MovementClass movement;
  int8_t prev_smoothed_i8;  // previous rounded smoothed, for movement detector
  int8_t move_score;
  /** Consecutive samples with no large RSSI step; when high, move_score resets to 0. */
  uint8_t move_stable_cycles;
  bool pending_send;
  /** True after successful "lost signal" POST; cleared when BLE heard again. */
  bool expired_lost;
  /** Forces a single send when tag passes expiration (far / stationary). */
  bool loss_one_shot;
  /** Last 3 raw RSSI samples (after noise floor); median feeds EMA. */
  int8_t rssi_hist[3];
  uint8_t rssi_hist_count;
  /** millis() when tag came back from expired_lost; 0 = no fresh reacquire grace active. */
  uint32_t reacquired_at_ms;
  /** ~1 s sliding advertisement count: in-window tally and last completed window for JSON. */
  uint16_t seen_adv_window;
  uint16_t seen_adv_reported;
  uint32_t seen_window_start_ms;
};

static TagState g_tags[kNumKnownTags];
static uint32_t g_last_http_ms = 0;

/** One outstanding HTTP retry for a critical send (distance change or loss_one_shot). */
static struct {
  bool active;
  size_t tag_i;
  uint32_t due_ms;
} g_http_retry;
// ---- Helpers ------------------------------------------------------------

static bool parseMac(const char *str, uint8_t out[6]) {
  int v[6];
  if (sscanf(str, "%2x:%2x:%2x:%2x:%2x:%2x", &v[0], &v[1], &v[2], &v[3], &v[4], &v[5]) != 6 &&
      sscanf(str, "%2X:%2X:%2X:%2X:%2X:%2X", &v[0], &v[1], &v[2], &v[3], &v[4], &v[5]) != 6) {
    return false;
  }
  for (int i = 0; i < 6; i++) out[i] = (uint8_t)v[i];
  return true;
}

static void macToStr(const uint8_t m[6], char *buf, size_t bufLen) {
  snprintf(buf, bufLen, "%02X:%02X:%02X:%02X:%02X:%02X", m[0], m[1], m[2], m[3], m[4], m[5]);
}

static const char *distanceStr(DistanceClass d) {
  switch (d) {
    case DistanceClass::Near:
      return "near";
    case DistanceClass::Medium:
      return "medium";
    case DistanceClass::Far:
      return "far";
  }
  return "medium";
}

static const char *movementStr(MovementClass m) {
  return m == MovementClass::Moving ? "moving" : "stationary";
}

/** Median of 1–3 values (small fixed buffer, no alloc). */
static int8_t medianRssiHist(const int8_t *h, uint8_t n) {
  if (n == 0) return kRssiNoiseFloorDb;
  if (n == 1) return h[0];
  if (n == 2) return (int8_t)(((int)h[0] + (int)h[1]) / 2);
  int a = (int)h[0], b = (int)h[1], c = (int)h[2];
  int mn = min(min(a, b), c);
  int mx = max(max(a, b), c);
  return (int8_t)(a + b + c - mn - mx);
}

static DistanceClass classifyDistanceHysteresis(float smoothed, DistanceClass prev) {
  switch (prev) {
    case DistanceClass::Near:
      if (smoothed < (float)kFarEnterDb) return DistanceClass::Far;
      if (smoothed <= (float)kNearExitDb) return DistanceClass::Medium;
      return DistanceClass::Near;
    case DistanceClass::Far:
      if (smoothed > (float)kNearEnterDb) return DistanceClass::Near;
      if (smoothed >= (float)kFarExitDb) return DistanceClass::Medium;
      return DistanceClass::Far;
    case DistanceClass::Medium:
      if (smoothed > (float)kNearEnterDb) return DistanceClass::Near;
      if (smoothed < (float)kFarEnterDb) return DistanceClass::Far;
      return DistanceClass::Medium;
  }
  return DistanceClass::Medium;
}

static void initTagStates() {
  for (size_t i = 0; i < kNumKnownTags; i++) {
    g_tags[i] = {};
    if (!parseMac(kKnownTags[i].mac_str, g_tags[i].mac)) {
      Serial.printf("Invalid MAC in config index %u\n", (unsigned)i);
      g_tags[i].valid = false;
      continue;
    }
    g_tags[i].is_worker = kKnownTags[i].is_worker;
    g_tags[i].valid = true;
    g_tags[i].smoothed_init = false;
    g_tags[i].prev_smoothed_i8 = 0;
    g_tags[i].move_score = 0;
    g_tags[i].move_stable_cycles = 0;
    g_tags[i].distance = DistanceClass::Medium;
    g_tags[i].movement = MovementClass::Stationary;
    g_tags[i].last_sent_ms = 0;
    g_tags[i].expired_lost = false;
    g_tags[i].loss_one_shot = false;
    g_tags[i].rssi_hist_count = 0;
    g_tags[i].reacquired_at_ms = 0;
    g_tags[i].seen_adv_window = 0;
    g_tags[i].seen_adv_reported = 0;
    g_tags[i].seen_window_start_ms = 0;
  }
}

static int indexForMac(const uint8_t mac[6]) {
  for (size_t i = 0; i < kNumKnownTags; i++) {
    if (!g_tags[i].valid) continue;
    if (memcmp(mac, g_tags[i].mac, 6) == 0) return (int)i;
  }
  return -1;
}

/**
 * What this does:
 *   Turns one new signal strength reading into smoothed distance, movement hint, and ad counters.
 * When this runs:
 *   Each time the scanner hears an advertisement from a known tag that passed the noise floor.
 */
static void applyRssiSample(TagState &t, int8_t rssi, uint32_t now_ms) {
  const bool waking_from_expire = t.expired_lost;
  // Live traffic again: allow normal tracking and future loss detection.
  t.expired_lost = false;
  t.loss_one_shot = false;
  if (waking_from_expire) {
    t.reacquired_at_ms = now_ms;  // arm grace: skip immediate re-expiration on flaky RF
  }

  t.last_seen_ms = now_ms;
  t.rssi = rssi;  // last raw (post noise floor) for payload

  // ~1 s seen_count window (wrap-safe); roll before incrementing this packet.
  if (t.seen_window_start_ms == 0) t.seen_window_start_ms = now_ms;
  if ((uint32_t)(now_ms - t.seen_window_start_ms) >= kSeenCountWindowMs) {
    t.seen_adv_reported = t.seen_adv_window;
    t.seen_adv_window = 0;
    t.seen_window_start_ms = now_ms;
  }
  t.seen_adv_window++;

  // Median-of-3 pre-filter: shift FIFO, then feed EMA the median of filled history.
  if (t.rssi_hist_count < 3) {
    t.rssi_hist[t.rssi_hist_count++] = rssi;
  } else {
    t.rssi_hist[0] = t.rssi_hist[1];
    t.rssi_hist[1] = t.rssi_hist[2];
    t.rssi_hist[2] = rssi;
  }
  int8_t med = medianRssiHist(t.rssi_hist, t.rssi_hist_count);

  if (!t.smoothed_init) {
    t.smoothed_rssi = (float)med;
    t.smoothed_init = true;
    t.prev_smoothed_i8 = med;
  } else {
    float nxt = kRssiEmaAlpha * (float)med + (1.0f - kRssiEmaAlpha) * t.smoothed_rssi;
    // Limit single-step EMA move so one bad frame cannot jerk distance state.
    float lo = t.smoothed_rssi - kEmaMaxStepDb;
    float hi = t.smoothed_rssi + kEmaMaxStepDb;
    if (nxt < lo) nxt = lo;
    if (nxt > hi) nxt = hi;
    t.smoothed_rssi = nxt;
  }

  int8_t sm = (int8_t)lroundf(t.smoothed_rssi);
  int diff = abs((int)sm - (int)t.prev_smoothed_i8);
  if (diff > kMovementJumpDb) {
    t.move_score = min((int)t.move_score + 1, (int)kMovingScoreMax);
    t.move_stable_cycles = 0;
  } else {
    // No significant step: count stable cycles, then hard-reset score (prevents lingering "moving").
    if (t.move_stable_cycles < 255) t.move_stable_cycles++;
    if (t.move_stable_cycles >= kMoveStableCyclesForReset) {
      t.move_score = 0;
      t.move_stable_cycles = 0;
    }
  }
  t.prev_smoothed_i8 = sm;

  DistanceClass prev_d = t.distance;
  t.distance = classifyDistanceHysteresis(t.smoothed_rssi, prev_d);
  t.movement = (t.move_score >= kMovingScoreThreshold) ? MovementClass::Moving : MovementClass::Stationary;
  t.pending_send = true;
}

// ---- BLE callbacks ------------------------------------------------------

class ScanCallbacks : public NimBLEAdvertisedDeviceCallbacks {
  void onResult(NimBLEAdvertisedDevice *adv) override {
    const uint8_t *addr = adv->getAddress().getNative();
    uint8_t mac[6];
    memcpy(mac, addr, 6);
    int idx = indexForMac(mac);
    if (idx < 0) return;

    if (!adv->haveRSSI()) return;
    int8_t rssi = adv->getRSSI();
    // Drop very weak readings — mostly noise, avoids EMA / movement jitter.
    if (rssi < kRssiNoiseFloorDb) return;
    uint32_t now = millis();
    applyRssiSample(g_tags[idx], rssi, now);
  }
};

static ScanCallbacks g_scanCb;
static NimBLEScan *g_scan = nullptr;

static void bleSetup() {
  NimBLEDevice::init("");
  g_scan = NimBLEDevice::getScan();
  // wantDuplicates=true so same MAC yields repeated callbacks for RSSI EMA / movement
  g_scan->setAdvertisedDeviceCallbacks(&g_scanCb, true);
  g_scan->setActiveScan(false);  // passive
  g_scan->setInterval(kScanIntervalUnits);
  g_scan->setWindow(kScanWindowUnits);
  g_scan->setDuplicateFilter(false);
  // duration 0 = continuous passive scan (callback-driven)
  if (!g_scan->start(0, nullptr, true)) {
    Serial.println("BLE scan start failed");
  }
}

// ---- WiFi ---------------------------------------------------------------

static uint32_t g_last_wifi_attempt = 0;

static void wifiMaintain(uint32_t now_ms) {
  if (WiFi.status() == WL_CONNECTED) return;
  if ((uint32_t)(now_ms - g_last_wifi_attempt) < kWifiReconnectMs) return;
  g_last_wifi_attempt = now_ms;
  Serial.println("WiFi disconnected — reconnecting…");
  WiFi.disconnect(true, false);
  WiFi.mode(WIFI_STA);
  WiFi.setSleep(false);
  WiFi.begin(WIFI_SSID, WIFI_PASS);
}

static void wifiWaitSetup() {
  WiFi.mode(WIFI_STA);
  WiFi.setSleep(false);
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  uint32_t start = millis();
  while (WiFi.status() != WL_CONNECTED && (uint32_t)(millis() - start) < 20000) {
    delay(250);
    Serial.print(".");
  }
  Serial.println();
  if (WiFi.status() == WL_CONNECTED) {
    Serial.print("WiFi OK ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("WiFi failed — will retry in loop");
  }
}

// ---- HTTP -------------------------------------------------------------

/**
 * What this does:
 *   Writes a human timestamp string for each upload.
 * Why it matters:
 *   Office dashboards read time order; if the clock is not set yet we still send a stable placeholder.
 */
static void fillEventTimestamp(char *buf, size_t len) {
  time_t t = time(nullptr);
  if (t >= 1000000000) {
    struct tm ti;
    gmtime_r(&t, &ti);
    strftime(buf, len, "%Y-%m-%dT%H:%M:%SZ", &ti);
    return;
  }
  snprintf(buf, len, "boot+%lu", (unsigned long)millis());
}

/**
 * What this does:
 *   Sends one JSON “proximity_update” message for a single tag’s current distance/movement snapshot.
 * When this runs:
 *   From the send scheduler when Wi‑Fi is up—never waits inside Bluetooth callbacks.
 */
static bool postProximity(const TagState &t) {
  if (WiFi.status() != WL_CONNECTED) return false;

  char macStr[18];
  macToStr(t.mac, macStr, sizeof(macStr));

  char ts[40];
  fillEventTimestamp(ts, sizeof(ts));

  JsonDocument doc;
  doc["event_type"] = "proximity_update";
  doc["gateway_id"] = GATEWAY_ID;
  doc["worker_tag_mac"] = t.is_worker ? macStr : "";
  doc["equipment_tag_mac"] = t.is_worker ? "" : macStr;
  doc["distance"] = distanceStr(t.distance);
  doc["movement"] = movementStr(t.movement);
  doc["rssi"] = (int)t.rssi;
  doc["timestamp"] = ts;
  doc["time_synced"] = (time(nullptr) >= 1000000000);
  doc["tag_seen_count_1s"] = t.seen_adv_reported;

  String body;
  serializeJson(doc, body);

  String url = String(API_BASE_URL) + API_EVENTS_PATH;
  HTTPClient http;
  http.setTimeout(8000);
  if (!http.begin(url)) {
    Serial.println("http.begin failed");
    return false;
  }
  http.addHeader("Content-Type", "application/json");
  int code = http.POST(body);
  http.end();

  if (code >= 200 && code < 300) {
    Serial.printf("POST ok %d %s dist=%s mov=%s\n", code, macStr, distanceStr(t.distance),
                  movementStr(t.movement));
    return true;
  }
  Serial.printf("POST fail %d %s\n", code, macStr);
  return false;
}

// Tracks what we last successfully announced (for change detection)
static DistanceClass g_sent_distance[kNumKnownTags];
static MovementClass g_sent_movement[kNumKnownTags];
static bool g_sent_init[kNumKnownTags];

/**
 * What this does:
 *   If a known tag goes quiet too long, mark it “far” and queue one honest loss message.
 * Why it matters:
 *   Without this, the server might think someone is still standing there when the radio simply faded.
 */
static void processDeviceExpiration(uint32_t now_ms) {
  for (size_t i = 0; i < kNumKnownTags; i++) {
    TagState &t = g_tags[i];
    if (!t.valid || !t.smoothed_init) continue;
    if (t.expired_lost) continue;
    if ((uint32_t)(now_ms - t.last_seen_ms) <= kDeviceExpireAfterMs) continue;
    // Grace after coming back from "lost" so a brief gap does not immediately re-fire loss.
    if (t.reacquired_at_ms != 0 && (uint32_t)(now_ms - t.reacquired_at_ms) < kReacquireGraceMs) continue;

    t.distance = DistanceClass::Far;
    t.movement = MovementClass::Stationary;
    t.rssi = kRssiNoiseFloorDb;  // sentinel: out of reliable range
    t.loss_one_shot = true;
    t.pending_send = true;
  }
}

/**
 * What this does:
 *   If an important POST fails, try **once** again a little later—without freezing the main loop.
 * Rule:
 *   Only distance changes and “we lost the tag” qualify as important enough to retry.
 */
static void processHttpRetry(uint32_t now_ms) {
  if (!g_http_retry.active) return;
  // Due-time not reached (uint32 millis comparison safe within ~24 days of scheduling).
  if ((uint32_t)(now_ms - g_http_retry.due_ms) > (UINT32_MAX / 2u)) return;
  if (WiFi.status() != WL_CONNECTED) {
    g_http_retry.active = false;
    return;
  }
  if ((uint32_t)(now_ms - g_last_http_ms) < kMinHttpGapMs) {
    g_http_retry.due_ms = g_last_http_ms + kMinHttpGapMs;
    return;
  }

  size_t i = g_http_retry.tag_i;
  if (i >= kNumKnownTags || !g_tags[i].valid) {
    g_http_retry.active = false;
    return;
  }
  TagState &t = g_tags[i];
  if (t.last_sent_ms != 0 && (uint32_t)(now_ms - t.last_sent_ms) < kPerDeviceSendCooldownMs) {
    g_http_retry.due_ms = t.last_sent_ms + kPerDeviceSendCooldownMs;
    return;
  }

  g_http_retry.active = false;
  if (!postProximity(t)) {
    Serial.println("HTTP critical retry failed (giving up until next trigger)");
    return;
  }

  g_last_http_ms = now_ms;
  t.last_sent_ms = now_ms;
  t.pending_send = false;
  g_sent_distance[i] = t.distance;
  g_sent_movement[i] = t.movement;
  g_sent_init[i] = true;
  if (t.loss_one_shot) {
    t.loss_one_shot = false;
    t.expired_lost = true;
  }
}

/**
 * What this does:
 *   Chooses **at most one** tag worth uploading this loop—the most urgent kind of news first.
 * Priority (plain language):
 *   1) “We think the tag disappeared”  2) distance label changed  3) movement changed
 *   4) time-based heartbeat if nothing else changed but we owe a check-in
 */
static void processPendingSends(uint32_t now_ms) {
  if (WiFi.status() != WL_CONNECTED) return;
  if ((uint32_t)(now_ms - g_last_http_ms) < kMinHttpGapMs) return;

  size_t best_i = kNumKnownTags;
  int best_pri = -1;

  for (size_t i = 0; i < kNumKnownTags; i++) {
    TagState &t = g_tags[i];
    if (!t.valid || !t.pending_send) continue;
    if (!t.smoothed_init) continue;
    if (t.expired_lost) {
      t.pending_send = false;
      continue;
    }
    if (g_http_retry.active && g_http_retry.tag_i == i) continue;

    bool dist_changed = !g_sent_init[i] || g_sent_distance[i] != t.distance;
    bool mov_changed = !g_sent_init[i] || g_sent_movement[i] != t.movement;
    bool time_elapsed =
        (t.last_sent_ms == 0) || ((uint32_t)(now_ms - t.last_sent_ms) >= kResendIntervalMs);
    bool want = dist_changed || mov_changed || time_elapsed || t.loss_one_shot;

    if (!want) {
      t.pending_send = false;
      continue;
    }

    if (t.last_sent_ms != 0 && (uint32_t)(now_ms - t.last_sent_ms) < kPerDeviceSendCooldownMs) {
      continue;
    }

    int pri = 0;
    if (t.loss_one_shot)
      pri = 3;
    else if (dist_changed)
      pri = 2;
    else if (mov_changed)
      pri = 1;
    else
      pri = 0;

    if (pri > best_pri) {
      best_pri = pri;
      best_i = i;
    }
  }

  if (best_i >= kNumKnownTags) return;

  TagState &t = g_tags[best_i];
  bool dist_changed = !g_sent_init[best_i] || g_sent_distance[best_i] != t.distance;

  if (postProximity(t)) {
    if (g_http_retry.active && g_http_retry.tag_i == best_i) g_http_retry.active = false;
    g_last_http_ms = now_ms;
    t.last_sent_ms = now_ms;
    t.pending_send = false;
    g_sent_distance[best_i] = t.distance;
    g_sent_movement[best_i] = t.movement;
    g_sent_init[best_i] = true;
    if (t.loss_one_shot) {
      t.loss_one_shot = false;
      t.expired_lost = true;
    }
    return;
  }

  bool critical = t.loss_one_shot || dist_changed;
  if (critical && !g_http_retry.active) {
    g_http_retry.active = true;
    g_http_retry.tag_i = best_i;
    g_http_retry.due_ms = now_ms + kHttpCriticalRetryDelayMs;
  }
}

// ---- Setup / loop -------------------------------------------------------

/**
 * What runs once at power-up:
 *   Prepare tag memory, connect Wi‑Fi, sync time if possible, then start passive Bluetooth listening.
 */
void setup() {
  Serial.begin(115200);
  delay(200);

  initTagStates();
  wifiWaitSetup();

  if (WiFi.status() == WL_CONNECTED) {
    configTime(kGmtOffsetSec, kDaylightOffsetSec, kNtpServer);
    for (int i = 0; i < 30 && time(nullptr) < 1000000000; i++) delay(200);
    if (time(nullptr) >= 1000000000) {
      Serial.println("NTP time valid (UTC timestamps in events)");
    } else {
      Serial.println("NTP unavailable — events will use boot+millis() until time syncs");
    }
  }

  bleSetup();
  Serial.println("BLE gateway running (passive scan)");
}

void loop() {
  uint32_t now = millis();
  wifiMaintain(now);
  processDeviceExpiration(now);
  processHttpRetry(now);
  processPendingSends(now);
  delay(5);  // brief yield so radio background work can run smoothly
}
