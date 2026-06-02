/**
 * Inventory notification contacts (wizard + module settings).
 * Stored under `settings.notifications` in inventory module settings JSON.
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type InventoryNotificationsConfig = {
  /** All emails added for this tenant (master list). */
  email_directory: string[];
  low_stock_enabled: boolean;
  low_stock_emails: string[];
  /** Default recipients when exporting a material request spreadsheet. */
  mr_export_emails: string[];
};

export const DEFAULT_INVENTORY_NOTIFICATIONS: InventoryNotificationsConfig = {
  email_directory: [],
  low_stock_enabled: true,
  low_stock_emails: [],
  mr_export_emails: [],
};

export function parseEmailList(raw: string | string[] | undefined | null): string[] {
  if (raw == null) return [];
  const parts = Array.isArray(raw)
    ? raw.map((x) => String(x).trim())
    : String(raw)
        .replace(/;/g, ",")
        .replace(/\n/g, ",")
        .split(",");
  const out: string[] = [];
  const seen = new Set<string>();
  for (const p of parts) {
    const e = p.trim().toLowerCase();
    if (!e || seen.has(e) || !EMAIL_RE.test(e)) continue;
    seen.add(e);
    out.push(e);
  }
  return out;
}

export function mergeInventoryNotificationsConfig(
  raw: Partial<InventoryNotificationsConfig> | undefined,
): InventoryNotificationsConfig {
  const directory = parseEmailList(raw?.email_directory);
  const dirSet = new Set(directory);
  const pick = (list: string[] | undefined) =>
    parseEmailList(list).filter((e) => dirSet.has(e));
  return {
    email_directory: directory,
    low_stock_enabled: raw?.low_stock_enabled !== false,
    low_stock_emails: raw?.low_stock_emails?.length ? pick(raw.low_stock_emails) : [...directory],
    mr_export_emails: raw?.mr_export_emails?.length ? pick(raw.mr_export_emails) : [...directory],
  };
}

export function inventoryNotificationsBlockForSave(
  config: InventoryNotificationsConfig,
): InventoryNotificationsConfig {
  const directory = parseEmailList(config.email_directory);
  const dirSet = new Set(directory);
  const subset = (list: string[]) => list.filter((e) => dirSet.has(e));
  return {
    email_directory: directory,
    low_stock_enabled: config.low_stock_enabled,
    low_stock_emails: subset(parseEmailList(config.low_stock_emails)),
    mr_export_emails: subset(parseEmailList(config.mr_export_emails)),
  };
}
