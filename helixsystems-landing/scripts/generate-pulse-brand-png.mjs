import sharp from "sharp";
import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const brand = join(__dirname, "..", "public", "brand");

const jobs = [
  { file: "pulse-logo-light.svg", out: "pulse-logo-light.png", width: 720 },
  { file: "pulse-logo-dark.svg", out: "pulse-logo-dark.png", width: 720 },
  { file: "pulse-icon.svg", out: "pulse-icon.png", width: 256 },
];

for (const { file, out, width } of jobs) {
  const svg = readFileSync(join(brand, file));
  await sharp(svg, { density: 300 }).resize({ width }).png().toFile(join(brand, out));
  console.log("Wrote", out);
}
