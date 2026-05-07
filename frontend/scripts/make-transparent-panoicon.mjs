import fs from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";

const root = path.resolve(process.cwd());
const iconPath = path.join(root, "public", "images", "panoicon.png");

if (!fs.existsSync(iconPath)) {
  console.error(`Missing file: ${iconPath}`);
  process.exit(1);
}

const input = fs.readFileSync(iconPath);
const png = PNG.sync.read(input);

// Convert grayscale-on-black into a clean alpha mask.
// We keep bright pixels as opaque and fade midtones to preserve anti-aliased edges.
const cutoff = 90; // below this becomes fully transparent
const full = 235; // at/above this becomes fully opaque
for (let i = 0; i < png.data.length; i += 4) {
  const r = png.data[i];
  const g = png.data[i + 1];
  const b = png.data[i + 2];
  const a = png.data[i + 3];
  if (a === 0) continue;
  const v = Math.max(r, g, b);
  if (v <= cutoff) {
    png.data[i + 3] = 0;
    continue;
  }
  const t = Math.min(1, Math.max(0, (v - cutoff) / (full - cutoff)));
  png.data[i] = 255;
  png.data[i + 1] = 255;
  png.data[i + 2] = 255;
  png.data[i + 3] = Math.round(255 * t);
}

fs.writeFileSync(iconPath, PNG.sync.write(png));
console.log("Updated:", iconPath);

