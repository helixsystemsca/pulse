import type { LucideIcon } from "lucide-react";
import {
  ClipboardList,
  History,
  LayoutList,
  Monitor,
  PackagePlus,
  Receipt,
  ScanBarcode,
  ShoppingCart,
  Store,
} from "lucide-react";
import type { PurchasingModuleConfig } from "@/lib/purchasing/purchasing-module-config";

export type InventoryWorkspaceTab =
  | "list"
  | "queue"
  | "vendors"
  | "quick_purchase"
  | "receipts"
  | "history";

type TabNavItem = {
  kind: "tab";
  id: InventoryWorkspaceTab;
  label: string;
  icon: LucideIcon;
};

type LinkNavItem = {
  kind: "link";
  href: string;
  label: string;
  icon: LucideIcon;
  external?: boolean;
};

export type InventoryNavItem = TabNavItem | LinkNavItem;

export function buildInventoryWorkspaceNav(options: {
  purchasing: PurchasingModuleConfig;
  replenishmentLabel: string;
  canScanner: boolean;
  issueHref: string;
  receiveHref: string;
  kioskHref: string;
}): InventoryNavItem[] {
  const { purchasing, replenishmentLabel, canScanner, issueHref, receiveHref, kioskHref } = options;
  const items: InventoryNavItem[] = [
    { kind: "tab", id: "list", label: "List", icon: LayoutList },
  ];

  if (!purchasing.enabled || purchasing.enable_replenishment_requests) {
    items.push({
      kind: "tab",
      id: "queue",
      label: replenishmentLabel || "Queue",
      icon: ClipboardList,
    });
  }

  items.push({ kind: "tab", id: "vendors", label: "Vendors", icon: Store });

  if (purchasing.enabled && purchasing.enable_quick_purchases) {
    items.push({ kind: "tab", id: "quick_purchase", label: "Quick purchase", icon: ShoppingCart });
  }

  if (canScanner) {
    items.push(
      { kind: "link", href: receiveHref, label: "Receive", icon: PackagePlus },
      { kind: "link", href: issueHref, label: "Issue", icon: ScanBarcode },
    );
  }

  if (purchasing.enabled && purchasing.enable_receipt_uploads) {
    items.push({ kind: "tab", id: "receipts", label: "Receipts", icon: Receipt });
  }

  if (purchasing.enabled && purchasing.enable_purchase_history) {
    items.push({ kind: "tab", id: "history", label: "History", icon: History });
  }

  if (canScanner) {
    items.push({
      kind: "link",
      href: kioskHref,
      label: "Kiosk display",
      icon: Monitor,
      external: true,
    });
  }

  return items;
}

export function isWorkspaceTab(id: string): id is InventoryWorkspaceTab {
  return ["list", "queue", "vendors", "quick_purchase", "receipts", "history"].includes(id);
}
