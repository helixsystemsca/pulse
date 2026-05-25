import { describe, expect, it } from "vitest";

import { computeWorkforceSiteCertCoverage } from "@/lib/dashboard/workforce-site-certs";

describe("computeWorkforceSiteCertCoverage", () => {
  const workers = [
    { id: "a", email: "a@x.com", full_name: "Alex", certifications: ["RO", "FA"] },
    { id: "b", email: "b@x.com", full_name: "Blake", certifications: ["P2"] },
  ];

  it("marks pool covered when any pool level is held on site", () => {
    const rows = computeWorkforceSiteCertCoverage(workers, ["b"], []);
    const pool = rows.find((r) => r.id === "pool");
    expect(pool?.status).toBe("covered");
    expect(pool?.holderNames).toContain("Blake");
  });

  it("marks missing when no on-site worker holds the cert", () => {
    const rows = computeWorkforceSiteCertCoverage(workers, ["b"], []);
    const ro = rows.find((r) => r.id === "ro");
    expect(ro?.status).toBe("missing");
  });

  it("omits WHMIS from the site cert strip", () => {
    const rows = computeWorkforceSiteCertCoverage(workers, ["a", "b"], []);
    expect(rows.some((r) => r.id === "whmis")).toBe(false);
  });

  it("shows pool and first aid as covered until full cert detection ships", () => {
    const rows = computeWorkforceSiteCertCoverage(workers, ["b"], []);
    expect(rows.find((r) => r.id === "pool")?.status).toBe("covered");
    expect(rows.find((r) => r.id === "fa")?.status).toBe("covered");
  });
});
