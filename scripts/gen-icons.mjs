// Generates PNG app icons for the Salah tracker PWA — no external deps.
// Draws a gold crescent + star on the app's green gradient, supersampled for
// smooth edges, then encoded to PNG via Node's built-in zlib.
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';

const OUT = new URL('../icons/', import.meta.url);
mkdirSync(OUT, { recursive: true });

// ---- colours (match index.html theme) ----
const TOP = [0x14, 0x50, 0x3a];   // #14503a
const BOT = [0x0b, 0x1f, 0x17];   // #0b1f17
const GOLD = [0xe9, 0xc4, 0x6a];  // #e9c46a
const GOLD_D = [0xc9, 0x9a, 0x3b];

function lerp(a, b, t) { return a.map((v, i) => Math.round(v + (b[i] - v) * t)); }
function dist(x, y, cx, cy) { return Math.hypot(x - cx, y - cy); }

// Renders one icon at `size`, supersampled by `ss`. `maskable` fills the whole
// canvas (safe-zone content stays centred); otherwise corners are rounded.
function render(size, { maskable = false } = {}) {
  const ss = 4;
  const S = size * ss;
  const buf = Buffer.alloc(S * S * 4);
  const cx = S / 2, cy = S / 2;
  const radius = maskable ? S : S * 0.24;     // corner radius (full = square-ish for mask bg)
  const contentScale = maskable ? 0.62 : 0.72; // shrink crescent inside safe zone for maskable

  // crescent geometry
  const R = (S * contentScale) / 2;
  const ccx = cx + R * 0.08, ccy = cy;
  const carveR = R * 0.86;
  const carveDx = R * 0.42, carveDy = -R * 0.06;
  // star (four-point sparkle) position, in the crescent opening
  const sx = ccx + R * 0.72, sy = ccy - R * 0.55;

  const setPx = (i, rgb, a = 255) => {
    buf[i] = rgb[0]; buf[i + 1] = rgb[1]; buf[i + 2] = rgb[2]; buf[i + 3] = a;
  };

  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const i = (y * S + x) * 4;

      // rounded-rect alpha (for non-maskable)
      let inShape = 1;
      if (!maskable) {
        // distance into the rounded corner
        const rx = Math.min(x, S - 1 - x);
        const ry = Math.min(y, S - 1 - y);
        if (rx < radius && ry < radius) {
          const d = dist(rx, ry, radius, radius);
          inShape = Math.max(0, Math.min(1, radius - d + 0.5));
        }
      }
      if (inShape <= 0) { setPx(i, BOT, 0); continue; }

      // vertical gradient background
      let rgb = lerp(TOP, BOT, y / S);

      // subtle radial glow top-centre
      const gd = dist(x, y, cx, S * 0.12) / (S * 0.6);
      if (gd < 1) rgb = lerp(rgb, GOLD, (1 - gd) * 0.05);

      // crescent = big gold disc minus an offset disc
      const dOuter = dist(x, y, ccx, ccy);
      const dCarve = dist(x, y, ccx + carveDx, ccy + carveDy);
      const inCrescent = dOuter <= R && dCarve > carveR;
      if (inCrescent) {
        // gold with a soft top-to-bottom shade
        const shade = lerp(GOLD, GOLD_D, (y - (ccy - R)) / (2 * R));
        // anti-alias the two circle edges
        const eOuter = Math.min(1, R - dOuter + 0.5);
        const eCarve = Math.min(1, dCarve - carveR + 0.5);
        const a = Math.max(0, Math.min(1, Math.min(eOuter, eCarve)));
        rgb = lerp(rgb, shade, a);
      }

      // star sparkle (4-point): |dx|+|dy| small along axes
      const dx = Math.abs(x - sx), dy = Math.abs(y - sy);
      const starR = R * 0.22;
      const arm = Math.min(dx, dy) * 3 + Math.max(dx, dy);
      if (arm < starR) {
        const a = Math.max(0, Math.min(1, (starR - arm) / (starR * 0.5)));
        rgb = lerp(rgb, GOLD, a);
      }

      setPx(i, rgb, Math.round(255 * inShape));
    }
  }

  return downscale(buf, S, ss);
}

// Box-average downscale by factor `ss` -> final size S/ss.
function downscale(buf, S, ss) {
  const out = S / ss;
  const dst = Buffer.alloc(out * out * 4);
  for (let y = 0; y < out; y++) {
    for (let x = 0; x < out; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let yy = 0; yy < ss; yy++) {
        for (let xx = 0; xx < ss; xx++) {
          const i = (((y * ss + yy) * S) + (x * ss + xx)) * 4;
          r += buf[i]; g += buf[i + 1]; b += buf[i + 2]; a += buf[i + 3];
        }
      }
      const n = ss * ss, j = (y * out + x) * 4;
      dst[j] = Math.round(r / n); dst[j + 1] = Math.round(g / n);
      dst[j + 2] = Math.round(b / n); dst[j + 3] = Math.round(a / n);
    }
  }
  return { data: dst, size: out };
}

// ---- minimal PNG encoder ----
function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xEDB88320 & -(c & 1));
  }
  return (~c) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const t = Buffer.from(type, 'ascii');
  const body = Buffer.concat([t, data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
function encodePNG({ data, size }) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0; // 8-bit RGBA
  // add filter byte (0) per scanline
  const stride = size * 4;
  const raw = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (stride + 1)] = 0;
    data.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

const targets = [
  { name: 'icon-192.png', size: 192 },
  { name: 'icon-512.png', size: 512 },
  { name: 'icon-maskable-192.png', size: 192, maskable: true },
  { name: 'icon-maskable-512.png', size: 512, maskable: true },
  { name: 'apple-touch-icon.png', size: 180 },
];
for (const t of targets) {
  const png = encodePNG(render(t.size, { maskable: t.maskable }));
  writeFileSync(new URL(t.name, OUT), png);
  console.log('wrote', t.name, png.length, 'bytes');
}
