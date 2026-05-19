import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.resolve(__dirname, "..", "..", "backend");
const result = spawnSync("python", ["-m", "scripts.seed_aux_availability_june"], {
  cwd: backendRoot,
  stdio: "inherit",
  env: process.env,
});
process.exit(result.status ?? 1);
