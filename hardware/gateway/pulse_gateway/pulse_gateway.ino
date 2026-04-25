/*
 * Pulse · ESP32 GATEWAY Firmware
 * ════════════════════════════════════════════════════════════════════════════
 * Role: ESP-NOW receiver + WiFi/MQTT uplink to RPI5.
 *
 * What this does
 * ---------------
 * 1. Receives ESP-NOW packets from all nearby Nodes (no limit on node count)
 * 2. Also does its own BLE scan (covers its immediate area)
 * 3. Merges all readings into a single batch
 * 4. Connects to the LTE hub's private WiFi network (your hotspot, not facility WiFi)
 * 5. Publishes batches to the MQTT broker on the RPI5 every 2 seconds
 *
 * Network topology
 * -----------------
 *
 *  [Node]──ESP-NOW──┐
 *  [Node]──ESP-NOW──┤
 *  [Node]──ESP-NOW──┼──► [GATEWAY] ──WiFi──► [LTE Hub] ──LTE──► Internet
 *  [Node]──ESP-NOW──┤                              │
 *  (self BLE scan)──┘                         [RPI5 on USB]
 *                                                  │
 *                                             MQTT broker
 *                                                  │
 *                                          FastAPI on Render
 *
 * The LTE hub broadcasts a private WiFi SSID (your hotspot).
 * The RPI5 is connected to the LTE hub via USB ethernet adapter or USB tethering.
 * Both the Gateway ESP32s and RPI5 are on the same private network.
 *
 * Hardware required per Gateway
 * -------------------------------
 * - ESP32 dev board
 * - Reliable 5V power (wall adapter preferred — gateway is always-on)
 *
 * Flash instructions
 * -------------------
 * 1. Flash and open Serial monitor at 115200 baud
 * 2. FIRST BOOT: note the MAC address printed — paste it into all Node firmwares
 *    as GATEWAY_MAC before flashing Nodes
 * 3. Set GATEWAY_ID to match the identifier you registered in Pulse's Devices tab
 * 4. Set WIFI_SSID/WIFI_PASSWORD to your LTE hub's hotspot credentials
 * 5. Set MQTT_HOST to the RPI5's IP on the LTE hub network (usually 192.168.x.x)
 */

#include <Arduino.h>
#include <BLEDevice.h>
#include <BLEScan.h>
#include <esp_now.h>
#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>

// ── CONFIG — edit before flashing each gateway ───────────────────────────────

// Must match the "identifier" field in AutomationGateway in your Pulse Devices tab
static const char* GATEWAY_ID = "gw-ice-a-01";

// Your LTE hub's private WiFi hotspot — NOT the facility WiFi
static const char* WIFI_SSID     = "Pulse-LTE-Hub";
static const char* WIFI_PASSWORD = "your-hub-password";

// RPI5's IP address on the LTE hub network
// Find this by running `hostname -I` on the RPI5 after connecting to the hub
static const char* MQTT_HOST = "192.168.8.100";
static const int   MQTT_PORT = 1883;

// MQTT topic this gateway publishes to (position engine subscribes to ble/rssi/#)
// Must follow: ble/rssi/{GATEWAY_ID}
#define MQTT_TOPIC_PREFIX "ble/rssi/"

// BLE scan for own area
static const int SCAN_DURATION_SEC = 1;

// How often to publish to MQTT (milliseconds)
static const unsigned long PUBLISH_INTERVAL_MS = 2000;

// RSSI threshold — ignore very distant/noisy beacons
static const int RSSI_THRESHOLD_DBM = -90;

// Max readings in one MQTT message (keep payload under ~4KB)
static const int MAX_BATCH_SIZE = 50;

// ── Reading buffer ────────────────────────────────────────────────────────────
// Shared between BLE scan callback, ESP-NOW receive callback, and publish loop.
// Protected by a mutex.

struct Reading {
  char    mac[18];
  int8_t  rssi;
  char    source[20];  // which node or "self" — useful for debugging
};

static Reading      g_batch[MAX_BATCH_SIZE];
static int          g_batchCount = 0;
static portMUX_TYPE g_mux        = portMUX_INITIALIZER_UNLOCKED;

static void addReading(const char* mac, int rssi, const char* source) {
  portENTER_CRITICAL(&g_mux);
  if (g_batchCount < MAX_BATCH_SIZE) {
    strncpy(g_batch[g_batchCount].mac,    mac,    17);
    strncpy(g_batch[g_batchCount].source, source, 19);
    g_batch[g_batchCount].mac[17]    = '\0';
    g_batch[g_batchCount].source[19] = '\0';
    g_batch[g_batchCount].rssi       = (int8_t)rssi;
    g_batchCount++;
  }
  portEXIT_CRITICAL(&g_mux);
}

// ── BLE — own scan ────────────────────────────────────────────────────────────

class GatewayScanCallbacks : public BLEAdvertisedDeviceCallbacks {
  void onResult(BLEAdvertisedDevice device) override {
    if (device.getRSSI() < RSSI_THRESHOLD_DBM) return;
    String mac = device.getAddress().toString().c_str();
    mac.toUpperCase();
    addReading(mac.c_str(), device.getRSSI(), "self");
  }
};

// ── ESP-NOW receive callback ──────────────────────────────────────────────────
// Called when a Node sends us a batch.
// Runs on the WiFi task — must be fast, no Serial, no blocking.

void onDataReceived(const uint8_t* mac_addr, const uint8_t* data, int len) {
  // Deserialise the compact node payload
  // {"n":"node-id","t":1234,"r":[{"m":"MAC","s":-65},...]}
  StaticJsonDocument<240> doc;
  DeserializationError err = deserializeJson(doc, data, len);
  if (err) return;

  const char* nodeId   = doc["n"] | "unknown";
  JsonArray   readings = doc["r"];
  if (readings.isNull()) return;

  for (JsonObject r : readings) {
    const char* mac = r["m"] | "";
    int         rssi = r["s"] | -99;
    if (strlen(mac) < 12) continue;
    addReading(mac, rssi, nodeId);
  }
}

// ── WiFi + MQTT ───────────────────────────────────────────────────────────────

static WiFiClient   g_wifiClient;
static PubSubClient g_mqtt(g_wifiClient);

void connectWifi() {
  if (WiFi.status() == WL_CONNECTED) return;
  Serial.printf("[GW] Connecting to WiFi: %s\n", WIFI_SSID);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 20) {
    delay(500);
    Serial.print(".");
    attempts++;
  }
  if (WiFi.status() == WL_CONNECTED) {
    Serial.printf("\n[GW] WiFi OK — IP: %s\n", WiFi.localIP().toString().c_str());
  } else {
    Serial.println("\n[GW] WiFi FAILED — will retry next cycle");
  }
}

void connectMqtt() {
  if (g_mqtt.connected()) return;
  Serial.printf("[GW] Connecting to MQTT %s:%d\n", MQTT_HOST, MQTT_PORT);
  String clientId = String("gw-") + GATEWAY_ID;
  if (g_mqtt.connect(clientId.c_str())) {
    Serial.println("[GW] MQTT connected");
  } else {
    Serial.printf("[GW] MQTT failed state=%d\n", g_mqtt.state());
  }
}

// ── Publish batch to MQTT ─────────────────────────────────────────────────────

void publishBatch() {
  // Snapshot and clear the buffer
  portENTER_CRITICAL(&g_mux);
  int   count = g_batchCount;
  Reading local[MAX_BATCH_SIZE];
  memcpy(local, g_batch, sizeof(Reading) * count);
  g_batchCount = 0;
  portEXIT_CRITICAL(&g_mux);

  if (count == 0) {
    // Send a heartbeat even when empty so RPI5 knows gateway is alive
    // Heartbeat payload: {"gateway_id":"gw-xxx","ts":1234,"readings":[]}
    DynamicJsonDocument doc(128);
    doc["gateway_id"] = GATEWAY_ID;
    doc["ts"]         = (uint32_t)(millis() / 1000);
    doc.createNestedArray("readings");
    String topic = String(MQTT_TOPIC_PREFIX) + GATEWAY_ID;
    String payload;
    serializeJson(doc, payload);
    g_mqtt.publish(topic.c_str(), payload.c_str());
    return;
  }

  // Build full MQTT payload
  // {"gateway_id":"gw-ice-a-01","ts":1714000000,"readings":[{"mac":"AA:BB...","rssi":-65,"node":"node-ice-a-01"},...]}
  DynamicJsonDocument doc(4096);
  doc["gateway_id"] = GATEWAY_ID;
  doc["ts"]         = (uint32_t)(millis() / 1000);

  JsonArray arr = doc.createNestedArray("readings");
  for (int i = 0; i < count; i++) {
    JsonObject r = arr.createNestedObject();
    r["mac"]  = local[i].mac;
    r["rssi"] = local[i].rssi;
    r["node"] = local[i].source;   // which node saw this beacon
  }

  String topic = String(MQTT_TOPIC_PREFIX) + GATEWAY_ID;
  String payload;
  serializeJson(doc, payload);

  bool ok = g_mqtt.publish(topic.c_str(), payload.c_str(), /*retained=*/false);
  Serial.printf("[GW] published %d readings to %s (%s)\n",
                count, topic.c_str(), ok ? "OK" : "FAIL");
}

// ── Setup ─────────────────────────────────────────────────────────────────────

void setup() {
  Serial.begin(115200);
  delay(500);
  Serial.printf("\n[GW] %s starting up\n", GATEWAY_ID);

  // WiFi must be STA mode for both ESP-NOW and WiFi to coexist.
  // ESP-NOW and WiFi share the same radio — they use the same channel.
  // Key: set WiFi channel BEFORE connecting so ESP-NOW Nodes know which
  // channel to use (Nodes use channel 0 = auto-match Gateway's channel).
  WiFi.mode(WIFI_STA);
  Serial.printf("[GW] MAC address: %s  ← paste this into Node GATEWAY_MAC\n",
                WiFi.macAddress().c_str());

  // Connect to LTE hub WiFi
  connectWifi();

  // Init ESP-NOW (after WiFi so channel is set)
  if (esp_now_init() != ESP_OK) {
    Serial.println("[GW] FATAL: ESP-NOW init failed");
    while (true) delay(1000);
  }
  esp_now_register_recv_cb(onDataReceived);
  Serial.println("[GW] ESP-NOW receiver ready — Nodes can now connect");

  // MQTT
  g_mqtt.setServer(MQTT_HOST, MQTT_PORT);
  g_mqtt.setBufferSize(4096);   // raise from default 256 — our payloads are larger
  connectMqtt();

  // BLE scanner for own area
  BLEDevice::init("");
  BLEScan* scan = BLEDevice::getScan();
  scan->setAdvertisedDeviceCallbacks(new GatewayScanCallbacks(), true);
  scan->setActiveScan(false);
  scan->setInterval(100);
  scan->setWindow(99);

  Serial.println("[GW] Setup complete — scanning + listening for nodes");
}

// ── Loop ──────────────────────────────────────────────────────────────────────

static unsigned long g_lastPublish = 0;

void loop() {
  // Keep WiFi + MQTT alive
  if (WiFi.status() != WL_CONNECTED) {
    connectWifi();
    return;
  }
  if (!g_mqtt.connected()) {
    connectMqtt();
  }
  g_mqtt.loop();

  // Do own BLE scan
  BLEDevice::getScan()->start(SCAN_DURATION_SEC, false);
  BLEDevice::getScan()->clearResults();

  // Publish on interval
  unsigned long now = millis();
  if (now - g_lastPublish >= PUBLISH_INTERVAL_MS) {
    publishBatch();
    g_lastPublish = now;
  }
}
