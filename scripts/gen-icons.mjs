// Generates the production PWA app icons — the "emerald" modern mosque design.
// Dependency-free: draws on a diagonal teal→emerald gradient, supersampled for
// smooth edges, and encodes PNGs via Node's built-in zlib.
// Regenerate with: node scripts/gen-icons.mjs
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';

const OUT = new URL('../icons/', import.meta.url);
mkdirSync(OUT, { recursive: true });

const GOLD = [0xe9, 0xc4, 0x6a], GOLD_D = [0xc9, 0x9a, 0x3b], CREAM = [0xf6, 0xec, 0xd2];
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const lerp = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
const clamp01 = t => Math.max(0, Math.min(1, t));
const disc = (x, y, cx, cy, r) => (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
const rect = (x, y, a, b, c, d) => x >= a && x <= c && y >= b && y <= d;
const sparkle = (x, y, cx, cy, r) => {
  const dx = Math.abs(x - cx), dy = Math.abs(y - cy);
  const arm = Math.min(dx, dy) * 3.2 + Math.max(dx, dy);
  return arm < r ? clamp01((r - arm) / (r * 0.6)) : 0;
};

// emerald diagonal gradient + glow (+ optional stars)
function bg(x, y, S, stars) {
  let c = mix([0x10, 0x7a, 0x63], [0x05, 0x3d, 0x2c], clamp01((x + y) / (2 * S)));
  const gl = clamp01(1 - Math.hypot(x - 0.72 * S, y - 0.26 * S) / (0.4 * S));
  c = mix(c, [0x7f, 0xf0, 0xc8], gl * 0.18);
  if (stars) for (const [sx, sy, sr] of [[0.20, 0.22, 0.02], [0.30, 0.14, 0.014], [0.80, 0.62, 0.016]])
    c = mix(c, CREAM, sparkle(x, y, sx * S, sy * S, sr * S) * 0.8);
  return c;
}

// mosque glyph — coords are fractions of S; returns part name or null
function mosque(x, y, S) {
  const u = S;
  if (disc(x, y, 0.5 * u, 0.535 * u, 0.14 * u) && y <= 0.535 * u) return 'dome';
  if (disc(x, y, 0.5 * u, 0.325 * u, 0.05 * u) && !disc(x, y, 0.52 * u, 0.318 * u, 0.043 * u)) return 'finial';
  if (rect(x, y, 0.492 * u, 0.355 * u, 0.508 * u, 0.40 * u)) return 'finial';
  for (const mx of [0.255 * u, 0.745 * u]) {
    if (rect(x, y, mx - 0.026 * u, 0.40 * u, mx + 0.026 * u, 0.745 * u)) return 'minaret';
    if (disc(x, y, mx, 0.40 * u, 0.03 * u) && y <= 0.40 * u) return 'minaret';
    if (disc(x, y, mx, 0.352 * u, 0.014 * u)) return 'finial';
  }
  if (rect(x, y, 0.335 * u, 0.535 * u, 0.665 * u, 0.745 * u)) {
    const door = x > 0.45 * u && x < 0.55 * u &&
      ((y > 0.62 * u) || (disc(x, y, 0.45 * u, 0.62 * u, 0.10 * u) && disc(x, y, 0.55 * u, 0.62 * u, 0.10 * u)));
    return door ? 'door' : 'body';
  }
  return null;
}
const partColor = (p, y, S) => p === 'dome' ? lerp(GOLD, GOLD_D, clamp01((y / S - 0.4) / 0.15)) : GOLD;

// render one icon. maskable => full-bleed bg, content scaled into safe zone.
function render(size, { maskable = false, scale = 1, stars = true } = {}) {
  const ss = 4, S = size * ss, buf = Buffer.alloc(S * S * 4);
  const radius = maskable ? 0 : S * 0.24;
  const cScale = maskable ? 0.78 : scale;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const i = (y * S + x) * 4;
    let alpha = 1;
    if (radius > 0) {
      const rx = Math.min(x, S - 1 - x), ry = Math.min(y, S - 1 - y);
      if (rx < radius && ry < radius) { const d = Math.hypot(radius - rx, radius - ry); alpha = clamp01(radius - d + 0.5); }
    }
    if (alpha <= 0) continue;
    let rgb = bg(x, y, S, stars && !maskable);
    // scaled content coordinate (shrink toward centre for maskable)
    const mx = (0.5 + (x / S - 0.5) / cScale) * S, my = (0.5 + (y / S - 0.5) / cScale) * S;
    const p = mosque(mx, my, S);
    if (p && p !== 'door') rgb = partColor(p, my, S);
    buf[i] = Math.round(rgb[0]); buf[i + 1] = Math.round(rgb[1]); buf[i + 2] = Math.round(rgb[2]); buf[i + 3] = Math.round(255 * alpha);
  }
  return downscale(buf, S, ss);
}
function downscale(buf, S, ss) {
  const out = S / ss, dst = Buffer.alloc(out * out * 4);
  for (let y = 0; y < out; y++) for (let x = 0; x < out; x++) {
    let r = 0, g = 0, b = 0, a = 0;
    for (let yy = 0; yy < ss; yy++) for (let xx = 0; xx < ss; xx++) {
      const i = (((y * ss + yy) * S) + (x * ss + xx)) * 4;
      r += buf[i]; g += buf[i + 1]; b += buf[i + 2]; a += buf[i + 3];
    }
    const n = ss * ss, j = (y * out + x) * 4;
    dst[j] = Math.round(r / n); dst[j + 1] = Math.round(g / n); dst[j + 2] = Math.round(b / n); dst[j + 3] = Math.round(a / n);
  }
  return { data: dst, size: out };
}
function crc32(b) { let c = ~0; for (let i = 0; i < b.length; i++) { c ^= b[i]; for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xEDB88320 & -(c & 1)); } return (~c) >>> 0; }
function chunk(t, d) { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const body = Buffer.concat([Buffer.from(t), d]); const cr = Buffer.alloc(4); cr.writeUInt32BE(crc32(body)); return Buffer.concat([l, body, cr]); }
function encodePNG({ data, size }) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 6;
  const stride = size * 4, raw = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y++) { raw[y * (stride + 1)] = 0; data.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride); }
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

const targets = [
  { name: 'icon-192.png', size: 192, opts: {} },
  { name: 'icon-512.png', size: 512, opts: {} },
  { name: 'icon-maskable-192.png', size: 192, opts: { maskable: true } },
  { name: 'icon-maskable-512.png', size: 512, opts: { maskable: true } },
  { name: 'apple-touch-icon.png', size: 180, opts: { scale: 0.9, stars: false } },
];
for (const t of targets) {
  writeFileSync(new URL(t.name, OUT), encodePNG(render(t.size, t.opts)));
  console.log('wrote', t.name);
}
