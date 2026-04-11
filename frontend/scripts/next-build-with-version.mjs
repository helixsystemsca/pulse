import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const versionPath = join(root, "build-version.json");

const skipBump =
  process.argv.includes("--no-bump") || process.env.SKIP_BUILD_VERSION_BUMP === "1";

const raw = JSON.parse(readFileSync(versionPath, "utf8"));
const hundredths = typeof raw.hundredths === "number" ? raw.hundredths : 101;
const display = `v${(hundredths / 100).toFixed(2)}`;

const nextBin = join(root, "node_modules", "next", "dist", "bin", "next");
if (!existsSync(nextBin)) {
  console.error("Next.js not found at", nextBin, "(run npm install in frontend/)");
  process.exit(1);
}

const env = { ...process.env, NEXT_PUBLIC_PULSE_BUILD_VERSION: display };
const r = spawnSync(process.execPath, [nextBin, "build"], { cwd: root, stdio: "inherit", env });

if (r.status !== 0 && r.status !== null) {
  process.exit(r.status);
}
if (r.signal) {
  process.exit(1);
}

if (!skipBump) {
  writeFileSync(versionPath, `${JSON.stringify({ hundredths: hundredths + 1 })}\n`);
}
