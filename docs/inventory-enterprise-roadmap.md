# Inventory enterprise capabilities

## Already in Helix (before Phase 1 extension)

| Capability | Status |
|------------|--------|
| Vendor directory (contacts, terms, addresses) | `inventory_vendors` + Vendors panel |
| Quick purchases + vendor performance | Purchasing module |
| Multi-location (legacy) | `location_stock` in item custom attributes + zones |
| Movement / usage audit | `inventory_movements`, `inventory_usage`, detail history |
| Work request consumption | `POST /api/inventory/{id}/use` |
| Low stock + material request queue | Auto-queue, MR export, email alerts |
| Static reorder thresholds | `low_stock_threshold`, `maximum_qty` |
| Barcode / scanner | Inventory scanner kiosk + SKU lookup |
| Item photos | Per-item image upload |

## Phase 1 (migration `1035_inventory_enterprise`)

| Capability | API |
|------------|-----|
| Asset lifecycle fields | `PATCH /api/inventory/{id}/lifecycle`, `POST …/dispose` |
| Depreciation snapshot (straight-line) | `GET …/lifecycle` → `book_value` |
| Vendor FK on items + lead time on vendors | Lifecycle patch `vendor_id`; vendor `lead_time_days` |
| Check-out / check-in | `POST …/checkout`, `POST …/checkin`, `GET …/checkout/open` |
| Contextual reorder policy | `PUT …/reorder-policy` (seasonal + event multipliers) |
| Consumption forecast | `GET …/forecast` |
| Smart MR queue sort | `priority_score`, `urgency_tier`, `days_until_stockout`, `anomaly_flag` |
| QR history card | `GET …/history-card` |
| Multi-location balances (first-class) | `GET/PUT …/location-balances` |

## Planned next (not in Phase 1)

- PM work order auto-decrement from procedure/BOM part lines linked to `inventory_items`
- Movement photo upload endpoint (condition at checkout/usage)
- District asset reporting CSV export
- One-click reorder from vendor + PO history rollup UI
