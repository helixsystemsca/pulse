/*
 * Pulse · ESP32 NODE Firmware
 * ════════════════════════════════════════════════════════════════════════════
 * Role: BLE scanner only. No WiFi. No MQTT.
 *
 * What this does
 * ---------------
 * 1. Scans for BLE advertisements every second
 * 2. Collects RSSI readings for any MAC it hears
 * 3. Forwards batches to the nearest Gateway ESP32 via ESP-NOW
 *    (ESP-NOW is a Espressif peer-to-peer protocol — no router needed,
 *     no captive portal, works through walls, ~200m range)
 *
 * What is a Node vs a Gateway?
 * -----------------------------
 * NODE    = BLE scanner only. Cheap. Scatter many of these around the
 *           facility — one per zone, one per room, wherever you need coverage.
 *           Nodes never touch the internet. They only talk to their Gateway.
 *
 * GATEWAY = BLE scanner + ESP-NOW receiver + WiFi uplink to LTE hub.
 *           One per LTE hub coverage area. Receives readings from all nearby
 *           Nodes via ESP-NOW, merges them, and forwards to the RPI5 MQTT broker.
 *
 * Hardware required per Node
 * ---------------------------
 * - Any ESP32 dev board (ESP32-WROOM-32 recommended, ~$3-5 each)
 * - USB power or 5V supply (can run on a small LiPo with deep sleep)
 *
 * Wiring
 * -------
 * No external wiring needed. Just power.
 *
 * Flash instructions
 * -------------------
 * 1. Open Arduino IDE
 * 2. Install board: "esp32" by Espressif (Board Manager)
 * 3. Install libraries: ArduinoJson (by Benoit Blanchon)
 * 4. Select board: "ESP32 Dev Module"
 * 5. Set GATEWAY_MAC to the MAC address of your Gateway ESP32
 *    (print it with the Gateway firmware's Serial output on first boot)
 * 6. Set NODE_ID to a unique name for this node
 * 7. Flash and deploy
 *
 * ESP-NOW payload (sent to Gateway)
 * -----------------------------------
 * Compact binary-ish JSON, kept under 250 bytes (ESP-NOW limit):
 * {"n":"node-ice-a-01","r":[{"m":"AA:BB:CC:DD:EE:FF","s":-65},...],"t":1714000000}
 * n = node_id, r = readings array, s = rssi, t = unix timestamp
 */

#include <Arduino.h>
#include <BLEDevice.h>
#include <BLEScan.h>
#include <esp_now.h>
#include <WiFi.h>
#include <ArduinoJson.h>

// ── CONFIG — edit before flashing each node ──────────────────────────────────

// Unique identifier for this node. Use location names.
// Must be ≤ 16 chars to fit in ESP-NOW payload.
static const char* NODE_ID = "node-ice-a-01";

// MAC address of the Gateway ESP32 this node reports to.
// Get this from the Gateway's Serial output on first boot.
// Format: {0xAA, 0xBB, 0xCC, 0xDD, 0xEE, 0xFF}
static uint8_t GATEWAY_MAC[6] = {0xAA, 0xBB, 0xCC, 0xDD, 0xEE, 0xFF};

// BLE scan duration in seconds per cycle
static const int SCAN_DURATION_SEC = 1;

// Maximum readings per batch (ESP-NOW 250 byte limit means ~8-10 MACs max)
static const int MAX_READINGS_PER_BATCH = 8;

// Only report beacons with RSSI stronger than this (filters distant noise)
static const int RSSI_THRESHOLD_DBM = -90;

// ── State ────────────────────────────────────────────────────────────────────

struct Reading {
  char  mac[18];   // "AA:BB:CC:DD:EE:FF\0"
  int8_t rssi;
};

static Reading     g_readings[MAX_READINGS_PER_BATCH];
static int         g_readingCount = 0;
static bool        g_peerAdded    = false;
static portMUX_TYPE g_mux = portMUX_INITIALIZER_UNLOCKED;

// ── BLE Scan Callbacks ────────────────────────────────────────────────────────

class NodeScanCallbacks : public BLEAdvertisedDeviceCallbacks {
  void onResult(BLEAdvertisedDevice device) override {
    int rssi = device.getRSSI();
    if (rssi < RSSI_THRESHOLD_DBM) return;

    portENTER_CRITICAL(&g_mux);
    if (g_readingCount < MAX_READINGS_PER_BATCH) {
      String mac = device.getAddress().toString().c_str();
      mac.toUpperCase();
      mac.toCharArray(g_readings[g_readingCount].mac, 18);
      g_readings[g_readingCount].rssi = (int8_t)rssi;
      g_readingCount++;
    }
    portEXIT_CRITICAL(&g_mux);
  }
};

// ── ESP-NOW Send Callback ─────────────────────────────────────────────────────

void onDataSent(const uint8_t* mac_addr, esp_now_send_status_t status) {
  if (status != ESP_NOW_SEND_SUCCESS) {
    Serial.printf("[NODE] ESP-NOW send FAILED to gateway — check GATEWAY_MAC\n");
  }
}

// ── Build & Send Batch ────────────────────────────────────────────────────────

void sendBatch() {
  portENTER_CRITICAL(&g_mux);
  int count = g_readingCount;
  Reading local[MAX_READINGS_PER_BATCH];
  memcpy(local, g_readings, sizeof(Reading) * count);
  g_readingCount = 0;
  portEXIT_CRITICAL(&g_mux);

  if (count == 0) return;

  // Build compact JSON — must stay under 250 bytes (ESP-NOW limit)
  // Format: {"n":"node-id","t":1234567890,"r":[{"m":"MAC","s":-65},...]}
  StaticJsonDocument<240> doc;
  doc["n"] = NODE_ID;
  doc["t"] = (uint32_t)(millis() / 1000);  // relative timestamp (RPI5 adds wall clock)

  JsonArray arr = doc.createNestedArray("r");
  for (int i = 0; i < count; i++) {
    JsonObject r = arr.createNestedObject();
    r["m"] = local[i].mac;
    r["s"] = local[i].rssi;
  }

  uint8_t buf[250];
  size_t len = serializeJson(doc, buf, sizeof(buf));

  if (len >= 250) {
    Serial.println("[NODE] WARNING: payload too large — reduce MAX_READINGS_PER_BATCH");
    return;
  }

  esp_err_t result = esp_now_send(GATEWAY_MAC, buf, len);
  if (result == ESP_OK) {
    Serial.printf("[NODE] sent %d readings to gateway (%d bytes)\n", count, (int)len);
  } else {
    Serial.printf("[NODE] esp_now_send error: %d\n", result);
  }
}

// ── Setup ─────────────────────────────────────────────────────────────────────

void setup() {
  Serial.begin(115200);
  delay(500);
  Serial.printf("\n[NODE] %s starting up\n", NODE_ID);

  // WiFi must be initialised for ESP-NOW (even though we don't connect to any AP)
  WiFi.mode(WIFI_STA);
  WiFi.disconnect();

  Serial.printf("[NODE] MAC address: %s\n", WiFi.macAddress().c_str());

  // Init ESP-NOW
  if (esp_now_init() != ESP_OK) {
    Serial.println("[NODE] FATAL: ESP-NOW init failed");
    while (true) delay(1000);
  }
  esp_now_register_send_cb(onDataSent);

  // Register Gateway as a peer
  esp_now_peer_info_t peer = {};
  memcpy(peer.peer_addr, GATEWAY_MAC, 6);
  peer.channel = 0;      // 0 = use current channel
  peer.encrypt = false;  // no encryption (add if needed)

  if (esp_now_add_peer(&peer) != ESP_OK) {
    Serial.println("[NODE] WARNING: failed to add gateway peer — check GATEWAY_MAC");
  } else {
    g_peerAdded = true;
    Serial.println("[NODE] Gateway peer registered OK");
  }

  // Init BLE scanner
  BLEDevice::init("");
  BLEScan* scan = BLEDevice::getScan();
  scan->setAdvertisedDeviceCallbacks(new NodeScanCallbacks(), /*wantDuplicates=*/true);
  scan->setActiveScan(false);   // passive scan = lower power, sufficient for RSSI
  scan->setInterval(100);
  scan->setWindow(99);

  Serial.println("[NODE] BLE scanner ready");
}

// ── Loop ──────────────────────────────────────────────────────────────────────

void loop() {
  if (!g_peerAdded) {
    Serial.println("[NODE] no gateway peer — retrying setup in 5s");
    delay(5000);
    return;
  }

  // Scan for BLE beacons
  BLEDevice::getScan()->start(SCAN_DURATION_SEC, false);
  BLEDevice::getScan()->clearResults();

  // Send whatever we collected to the Gateway
  sendBatch();
}
