/**
 * Pack app/icon.png (City of Vernon mark, 32×32) into app/favicon.ico
 * with 16×16 + 32×32 PNG frames so browsers requesting /favicon.ico
 * get the same artwork as /icon.png.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PNG } from "pngjs";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const srcPath = path.join(root, "app", "icon.png");
const outPath = path.join(root, "app", "favicon.ico");

const srcBuf = fs.readFileSync(srcPath);
const src = PNG.sync.read(srcBuf);
if (src.width !== 32 || src.height !== 32) {
  throw new Error(`Expected 32×32 icon.png, got ${src.width}×${src.height}`);
}

function downscale(source, size) {
  const out = new PNG({ width: size, height: size });
  const scaleX = source.width / size;
  const scaleY = source.height / size;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      let n = 0;
      const x0 = Math.floor(x * scaleX);
      const y0 = Math.floor(y * scaleY);
      const x1 = Math.max(x0 + 1, Math.floor((x + 1) * scaleX));
      const y1 = Math.max(y0 + 1, Math.floor((y + 1) * scaleY));
      for (let yy = y0; yy < y1; yy++) {
        for (let xx = x0; xx < x1; xx++) {
          const i = (yy * source.width + xx) << 2;
          r += source.data[i];
          g += source.data[i + 1];
          b += source.data[i + 2];
          a += source.data[i + 3];
          n += 1;
        }
      }
      const o = (y * size + x) << 2;
      out.data[o] = Math.round(r / n);
      out.data[o + 1] = Math.round(g / n);
      out.data[o + 2] = Math.round(b / n);
      out.data[o + 3] = Math.round(a / n);
    }
  }
  return PNG.sync.write(out);
}

function packIco(images) {
  const count = images.length;
  let offset = 6 + 16 * count;
  const entries = images.map((img) => {
    const entry = { ...img, size: img.png.length, offset };
    offset += img.png.length;
    return entry;
  });
  const buf = Buffer.alloc(offset);
  buf.writeUInt16LE(0, 0);
  buf.writeUInt16LE(1, 2);
  buf.writeUInt16LE(count, 4);
  let pos = 6;
  for (const entry of entries) {
    buf.writeUInt8(entry.width >= 256 ? 0 : entry.width, pos);
    buf.writeUInt8(entry.height >= 256 ? 0 : entry.height, pos + 1);
    buf.writeUInt8(0, pos + 2);
    buf.writeUInt8(0, pos + 3);
    buf.writeUInt16LE(1, pos + 4);
    buf.writeUInt16LE(32, pos + 6);
    buf.writeUInt32LE(entry.size, pos + 8);
    buf.writeUInt32LE(entry.offset, pos + 12);
    pos += 16;
  }
  for (const entry of entries) {
    entry.png.copy(buf, entry.offset);
  }
  return buf;
}

const ico = packIco([
  { width: 16, height: 16, png: downscale(src, 16) },
  { width: 32, height: 32, png: srcBuf },
]);
fs.writeFileSync(outPath, ico);
console.log("Wrote", outPath, `(${ico.length} bytes, 16+32 PNG ICO)`);
