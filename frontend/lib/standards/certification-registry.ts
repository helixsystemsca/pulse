/**
 * Canonical certification registry — company-defined license/credential types.
 * Employee certification rows must reference a registry code (no freeform drift).
 */
import { CERT_CODE_LABELS } from "@/lib/schedule/certifications";

export type CertificationCategory = "safety" | "trade" | "operations" | "pool" | "other";

export type CanonicalCertificationDef = {
  code: string;
  label: string;
  category: CertificationCategory;
  /** Default validity period in months when issuing; null = no default expiry */
  defaultExpiryMonths: number | null;
  requiresProof: boolean;
  active: boolean;
};

const BUILTIN_REGISTRY: readonly CanonicalCertificationDef[] = [
  { code: "RO", label: CERT_CODE_LABELS.RO ?? "Refrigeration Operator", category: "trade", defaultExpiryMonths: 36, requiresProof: true, active: true },
  { code: "P1", label: CERT_CODE_LABELS.P1 ?? "Pool Operator Level 1", category: "pool", defaultExpiryMonths: 24, requiresProof: true, active: true },
  { code: "P2", label: CERT_CODE_LABELS.P2 ?? "Pool Operator Level 2", category: "pool", defaultExpiryMonths: 24, requiresProof: true, active: true },
  { code: "P4", label: CERT_CODE_LABELS.P4 ?? "4th Class Power Engineer", category: "trade", defaultExpiryMonths: 60, requiresProof: true, active: true },
  { code: "FA", label: CERT_CODE_LABELS.FA ?? "First Aid", category: "safety", defaultExpiryMonths: 36, requiresProof: true, active: true },
  { code: "WHMIS", label: "WHMIS", category: "safety", defaultExpiryMonths: 12, requiresProof: false, active: true },
  { code: "FORKLIFT", label: "Forklift operator", category: "operations", defaultExpiryMonths: 36, requiresProof: true, active: true },
];

const STORAGE_KEY = "pulse.standards.certification_registry.v1";

export function defaultCertificationRegistry(): CanonicalCertificationDef[] {
  return BUILTIN_REGISTRY.map((r) => ({ ...r }));
}

export function readCompanyCertificationRegistry(): CanonicalCertificationDef[] {
  if (typeof window === "undefined") return defaultCertificationRegistry();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultCertificationRegistry();
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return defaultCertificationRegistry();
    const merged = new Map<string, CanonicalCertificationDef>();
    for (const r of defaultCertificationRegistry()) merged.set(r.code, r);
    for (const row of parsed) {
      if (!row || typeof row !== "object") continue;
      const code = String((row as CanonicalCertificationDef).code ?? "").trim().toUpperCase();
      if (!code) continue;
      merged.set(code, {
        code,
        label: String((row as CanonicalCertificationDef).label ?? code).trim(),
        category: (row as CanonicalCertificationDef).category ?? "other",
        defaultExpiryMonths: (row as CanonicalCertificationDef).defaultExpiryMonths ?? null,
        requiresProof: Boolean((row as CanonicalCertificationDef).requiresProof),
        active: (row as CanonicalCertificationDef).active !== false,
      });
    }
    return [...merged.values()].filter((r) => r.active).sort((a, b) => a.label.localeCompare(b.label));
  } catch {
    return defaultCertificationRegistry();
  }
}

export function writeCompanyCertificationRegistry(rows: readonly CanonicalCertificationDef[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rows));
  } catch {
    /* ignore */
  }
}

export function resolveRegistryEntry(
  registry: readonly CanonicalCertificationDef[],
  nameOrCode: string,
): CanonicalCertificationDef | undefined {
  const raw = nameOrCode.trim();
  const upper = raw.toUpperCase();
  return (
    registry.find((r) => r.code === upper) ??
    registry.find((r) => r.label.toLowerCase() === raw.toLowerCase())
  );
}
