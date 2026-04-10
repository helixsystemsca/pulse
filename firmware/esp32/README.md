# ESP32 gateway firmware

Reference implementation: **BLE tags → gateway → HTTPS API**. Build with [PlatformIO](https://platformio.org/).

## Build and flash

1. Install PlatformIO (VS Code extension or CLI).
2. Copy `include/secrets.h.example` → `include/secrets.h` and set Wi‑Fi, `API_BASE_URL` (no trailing slash), and `GATEWAY_ID`.
3. Edit `src/main.cpp` → `kKnownTags` for your tag MACs (worker vs equipment).
4. Pick the **`[env:...]`** in `platformio.ini` that matches **flash size and family**:
   - **Waveshare ESP32‑S3 Mini / S3‑Tiny (ESP32‑S3FH4R2, usually 4 MB flash + 2 MB PSRAM):** default **`waveshare_s3_mini`** (uses a 4 MB partition table — do **not** use the 8 MB DevKitC preset on this chip).
   - **Espressif ESP32‑S3‑DevKitC‑1 N8 (8 MB, no PSRAM):** build with `-e esp32-s3-devkitc-1` or set `default_envs` in `platformio.ini`.
   For other modules, adjust `board` / partitions per [PlatformIO boards](https://docs.platformio.org/en/latest/boards/index.html).
5. From this directory: `pio run -t upload` (or `pio run -e waveshare_s3_mini -t upload`) and `pio device monitor` (115200 baud).

The sketch uses **Arduino** framework + **NimBLE-Arduino** and posts `proximity_update` JSON to `API_BASE_URL` + `/api/v1/events` unless you override `API_EVENTS_PATH` in `secrets.h`.

**Serial monitor looks connected but shows no text:** With **USB CDC** (`ARDUINO_USB_CDC_ON_BOOT`), open the monitor *first* or press the board **RST** after opening so you catch `Helix gateway: boot`. The firmware waits briefly for USB; if you still see nothing, try the **other COM port** in Device Manager. For deeper crash info, use `build_type = debug` in `platformio.ini` or see [PlatformIO build configurations](https://docs.platformio.org/en/latest/projectconf/build_configurations.html).

### Serial monitor reboot loop (`esp_core_dump_flash` / CRC)

If the log shows **`Core dump flash config is corrupted!`** then **`Rebooting...`**, the **coredump partition** in the default 8 MB table can trip a CRC check and reset before your sketch runs. This project uses **`partitions_8MB_no_coredump.csv`** in `platformio.ini` so that partition is not present.

Still stuck after changing `platformio.ini`? Do this in order:

1. **Full chip erase**, then **Upload** (not only “upload” over an old table):  
   `pio run -t erase` → `pio run -t upload` (or **Erase Flash** in the IDE, then **Upload**).
2. **Serial monitor resetting the board:** many USB–UART adapters wire **DTR/RTS** to **EN / BOOT**. Opening the monitor can pulse those lines and cause a **reset loop**. This repo sets **`monitor_rts = 0`** and **`monitor_dtr = 0`** in `platformio.ini`; if you use an external terminal, use **`pio device monitor --rts 0 --dtr 0`**.
3. **Wrong COM port on ESP32-S3:** some boards show **two** serial devices (UART bridge vs native USB). Try the other port, or see the commented **`ARDUINO_USB_CDC_ON_BOOT`** line in `platformio.ini` if you use the native USB connector only.
4. **Hardware mismatch:** `esp32-s3-devkitc-1` assumes **8 MB** flash, **no PSRAM**. If your module is **16 MB**, DevKitM, or a clone, pick the correct [PlatformIO `board`](https://docs.platformio.org/en/latest/boards/) and a matching **partition CSV** (do not use this 8 MB file on a 16 MB layout without editing sizes).

The **RGB “power” LED** on DevKitC may not blink in a way you notice during a tight reset loop; fixing resets usually restores normal behavior.

Erasing flash wipes **all** on-chip data (Wi‑Fi calibration, FS); that is expected for a clean recovery.

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
