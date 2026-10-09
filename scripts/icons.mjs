// Dependency-free rasterization of our original flower mark, with 2x antialiasing.
import { deflateSync } from "node:zlib";
import { writeFile } from "node:fs/promises";
function crc32(data) {
  let crc = 0xffffffff;
  for (const b of data) {
    crc ^= b;
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const name = Buffer.from(type);
  const out = Buffer.alloc(data.length + 12);
  out.writeUInt32BE(data.length);
  name.copy(out, 4);
  data.copy(out, 8);
  out.writeUInt32BE(crc32(Buffer.concat([name, data])), data.length + 8);
  return out;
}
function color(x, y, mask) {
  const scale = mask ? 0.7 : 1;
  x = (x - 256) / scale + 256;
  y = (y - 256) / scale + 256;
  let result = [66, 102, 83];
  if (!mask && (x < 0 || x > 512 || y < 0 || y > 512)) return result;
  for (let i = 0; i < 6; i++) {
    const a = (i * Math.PI) / 3;
    const dx = x - 256,
      dy = y - 256;
    const tx = dx * Math.cos(a) + dy * Math.sin(a);
    const ty = -dx * Math.sin(a) + dy * Math.cos(a);
    if ((tx * tx) / (53 * 53) + ((ty + 91) * (ty + 91)) / (86 * 86) <= 1)
      result = [232, 179, 189];
  }
  if ((x - 256) ** 2 + (y - 256) ** 2 < 57 ** 2) result = [241, 211, 140];
  if (
    (x - 239) ** 2 + (y - 252) ** 2 < 6 ** 2 ||
    (x - 273) ** 2 + (y - 252) ** 2 < 6 ** 2
  )
    result = [119, 103, 79];
  if (
    x > 244 &&
    x < 268 &&
    Math.abs(y - (273 + 7.5 * (1 - ((x - 256) / 12) ** 2))) < 3
  )
    result = [119, 103, 79];
  return result;
}
async function png(size, name, mask = false) {
  const rows = Buffer.alloc((size * 3 + 1) * size);
  for (let y = 0; y < size; y++) {
    const offset = y * (size * 3 + 1);
    for (let x = 0; x < size; x++) {
      let sums = [0, 0, 0];
      for (const dx of [0.25, 0.75])
        for (const dy of [0.25, 0.75]) {
          const c = color(
            ((x + dx) * 512) / size,
            ((y + dy) * 512) / size,
            mask,
          );
          for (let k = 0; k < 3; k++) sums[k] += c[k];
        }
      for (let k = 0; k < 3; k++)
        rows[offset + 1 + x * 3 + k] = Math.round(sums[k] / 4);
    }
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8;
  header[9] = 2;
  await writeFile(
    `public/${name}`,
    Buffer.concat([
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
      chunk("IHDR", header),
      chunk("IDAT", deflateSync(rows)),
      chunk("IEND", Buffer.alloc(0)),
    ]),
  );
}
await png(192, "icon-192.png");
await png(512, "icon-512.png");
await png(180, "apple-touch-icon.png");
await png(512, "icon-maskable.png", true);
