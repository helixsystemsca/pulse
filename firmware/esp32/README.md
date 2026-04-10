# ESP32 gateway firmware

Reference implementation: **BLE tags → gateway → HTTPS API**. Build with [PlatformIO](https://platformio.org/).

## Build and flash

1. Install PlatformIO (VS Code extension or CLI).
2. Copy `include/secrets.h.example` → `include/secrets.h` and set Wi‑Fi, `API_BASE_URL` (no trailing slash), and `GATEWAY_ID`.
3. Edit `src/main.cpp` → `kKnownTags` for your tag MACs (worker vs equipment).
4. Default board in `platformio.ini` is **ESP32‑C3 DevKitM‑1**. For a different chip, change `board` (e.g. `esp32dev` for classic ESP32).
5. From this directory: `pio run -t upload` and `pio device monitor` (115200 baud).

The sketch uses **Arduino** framework + **NimBLE-Arduino** and posts `proximity_update` JSON to `API_BASE_URL` + `/api/v1/events` unless you override `API_EVENTS_PATH` in `secrets.h`.

---

## Security reference (production contract)

Use the patterns below when hardening this reference for production. Larger deployments may keep firmware in a dedicated repo or submodule; this README is the contract IT and firmware teams can share.

### Network posture

- **Outbound-only:** use `WiFiClientSecure` (Arduino) or equivalent; connect to `https://api.example.com` on **443** only.
- **No listening services** in production builds (no unauthenticated HTTP server on `:80`).
- **Certificate validation:** load the **ISRG Root X1** (Let’s Encrypt) or your CA bundle; **do not** use `setInsecure()` or disable verification in production.
- **Enterprise Wi‑Fi:** support WPA2-Enterprise (PEAP) if required; credentials belong in **NVS**, not source code.

### Provisioning (Wi‑Fi + API secret)

1. **Factory / first boot:** open a **captive AP** (“Helix-GW-xxxx”) with a **one-time** setup token printed on the device label.
2. Operator opens a **local** page (served only while AP mode is active and authenticated) to set SSID/password and paste **ingest secret** from Pulse (**rotate** flow in admin UI).
3. Persist Wi‑Fi and secret in **NVS**; optionally encrypt NVS partition (ESP-IDF `nvs_flash` encryption).
4. Reboot to **station mode** only; disable AP and debug UART in **production** builds (`CONFIG_ESP_CONSOLE_NONE` or gate `Serial` behind `#ifdef DEBUG`).

### Cloud ingest (HTTPS)

- **URL:** `POST /api/v1/device/events`
- **Headers:**
  - `X-Gateway-Id: <gateway UUID from Pulse>`
  - `Authorization: Bearer <ingest_secret>`
  - `Content-Type: application/json`
- **Body:** same JSON shape as operator documentation for automation events (`event_type`, proximity fields, etc.). **`company_id` in JSON is ignored** for device auth — the server binds the gateway to a tenant.

Prefer **short keep-alive** connections and backoff (exponential) on **429** / **5xx**.

### BLE security

- **Whitelist** MAC addresses or vendor-specific identifiers that match tags registered in Pulse.
- **Drop** packets that fail length / AD structure checks; do not forward raw unknown devices to the cloud (optional: local count only).
- **Debounce / rate limit:** aggregate scans (e.g. 100–200 ms window) before emitting HTTP; cap requests per second per gateway.
- **Do not trust RSSI alone** for safety interlocks; server-side logic already applies floors and arbitration.

### OTA updates

- Fetch firmware only over **HTTPS** from a **versioned** manifest (e.g. JSON with semver, URL, SHA-256).
- **Verify** Ed25519 or RSA signature over the **staged binary** before `esp_ota_set_boot_partition`.
- Keep **two OTA slots**; confirm boot success before marking new image valid (`esp_ota_mark_app_valid_cancel_rollback`).

### Local fail-safe

If Wi‑Fi or cloud is unavailable:

- Continue **local timers** or **GPIO interlocks** required by your safety case (e.g. pump / CO₂ rules).
- **Queue** events in SPIFFS / NVS with a **bounded ring buffer** and drop oldest on overflow (with metrics).

### Debugging

- **Development:** UART logs allowed.
- **Production:** disable verbose logs; strip firmware symbols; avoid printing secrets or full BLE payloads.

For backend behavior (rate limits, audit events, HTTPS enforcement), see **`docs/SECURITY_OVERVIEW.md`**.
