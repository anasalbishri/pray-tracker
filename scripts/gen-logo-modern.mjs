// Modern gradient takes on the mosque logo (option 1). Renders 4 gradient
// styles + a numbered contact sheet. Dependency-free.
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';

const OUT = new URL('../options/', import.meta.url);
mkdirSync(OUT, { recursive: true });

const lerp = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t); // float
const clamp01 = t => Math.max(0, Math.min(1, t));
const D2 = (x, y, cx, cy) => (x - cx) ** 2 + (y - cy) ** 2;
const disc = (x, y, cx, cy, r) => D2(x, y, cx, cy) <= r * r;
const rect = (x, y, a, b, c, d) => x >= a && x <= c && y >= b && y <= d;
const GOLD = [0xe9, 0xc4, 0x6a], GOLD_D = [0xc9, 0x9a, 0x3b];
const CREAM = [0xf6, 0xec, 0xd2], WHITE = [0xf8, 0xfa, 0xf7];

// refined, modern mosque — returns part name or null
function mosque(x, y, S) {
  const u = S;
  if (disc(x, y, 0.5 * u, 0.535 * u, 0.14 * u) && y <= 0.535 * u) return 'dome';
  // crescent finial above the dome
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

const sparkle = (x, y, cx, cy, r) => {
  const dx = Math.abs(x - cx), dy = Math.abs(y - cy);
  const arm = Math.min(dx, dy) * 3.2 + Math.max(dx, dy);
  return arm < r ? clamp01((r - arm) / (r * 0.6)) : 0;
};

// ---- four modern styles ----
const styles = [
  { // 1 — Emerald: diagonal teal→emerald, all-gold mosque, soft glow + stars
    name: 'emerald',
    bg(x, y, S) {
      let c = mix([0x10, 0x7a, 0x63], [0x05, 0x3d, 0x2c], clamp01((x + y) / (2 * S)));
      const gl = clamp01(1 - Math.hypot(x - 0.72 * S, y - 0.26 * S) / (0.4 * S));
      c = mix(c, [0x7f, 0xf0, 0xc8], gl * 0.18);
      for (const [sx, sy, sr] of [[0.20, 0.22, 0.02], [0.30, 0.14, 0.014], [0.80, 0.62, 0.016]])
        c = mix(c, CREAM, sparkle(x, y, sx * S, sy * S, sr * S) * 0.8);
      return c;
    },
    part(p, y, S) {
      if (p === 'dome') return lerp(GOLD, GOLD_D, clamp01((y / S - 0.4) / 0.15));
      return GOLD;
    },
  },
  { // 2 — Royal: diagonal green, cream body + gold dome/finials
    name: 'royal',
    bg(x, y, S) {
      let c = mix([0x18, 0x7a, 0x45], [0x04, 0x2b, 0x1a], clamp01((x * 0.6 + y * 1.4) / (2 * S)));
      const gl = clamp01(1 - Math.hypot(x - 0.5 * S, y - 0.30 * S) / (0.5 * S));
      c = mix(c, [0xd9, 0xf7, 0xe4], gl * 0.10);
      return c;
    },
    part(p) {
      if (p === 'body') return CREAM;
      if (p === 'dome') return GOLD;
      return GOLD;
    },
  },
  { // 3 — Night: deep green→navy, big soft moon behind, gold mosque, stars
    name: 'night',
    bg(x, y, S) {
      let c = mix([0x0c, 0x40, 0x2e], [0x0a, 0x1c, 0x2b], clamp01((x + y) / (2 * S)));
      const moon = clamp01(1 - Math.hypot(x - 0.62 * S, y - 0.34 * S) / (0.26 * S));
      c = mix(c, [0xe8, 0xef, 0xf5], moon * moon * 0.5);
      for (const [sx, sy, sr] of [[0.24, 0.20, 0.018], [0.34, 0.30, 0.012], [0.18, 0.40, 0.012]])
        c = mix(c, WHITE, sparkle(x, y, sx * S, sy * S, sr * S) * 0.9);
      return c;
    },
    part(p, y, S) {
      if (p === 'body') return lerp(GOLD, GOLD_D, 0.25);
      return GOLD;
    },
  },
  { // 4 — Aurora: vertical deep-green→gold glow, gold mosque with warm base
    name: 'aurora',
    bg(x, y, S) {
      const t = clamp01(y / S);
      let c = mix([0x0e, 0x53, 0x38], [0x07, 0x2a, 0x1e], t);
      const glow = clamp01(1 - Math.hypot(x - 0.5 * S, y - 0.80 * S) / (0.55 * S));
      c = mix(c, [0xe9, 0xc4, 0x6a], glow * 0.22);
      const halo = clamp01(1 - Math.hypot(x - 0.5 * S, y - 0.5 * S) / (0.34 * S));
      c = mix(c, [0x1a, 0x6b, 0x4b], halo * 0.5);
      return c;
    },
    part(p, y, S) {
      if (p === 'dome') return lerp(GOLD, GOLD_D, clamp01((y / S - 0.4) / 0.16));
      return GOLD;
    },
  },
];

function renderStyle(style, size = 512, ss = 3) {
  const S = size * ss, buf = Buffer.alloc(S * S * 4), radius = S * 0.24;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const i = (y * S + x) * 4;
    let alpha = 1;
    const rx = Math.min(x, S - 1 - x), ry = Math.min(y, S - 1 - y);
    if (rx < radius && ry < radius) { const d = Math.hypot(radius - rx, radius - ry); alpha = clamp01(radius - d + 0.5); }
    if (alpha <= 0) continue;
    let rgb = style.bg(x, y, S);
    const p = mosque(x, y, S);
    if (p === 'door') { /* keep bg (carved) */ }
    else if (p) rgb = style.part(p, y, S);
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

// digit (7-seg) — order [a,f,b,g,e,c,d]
const SEG = { 1: [0, 0, 1, 0, 0, 1, 0], 2: [1, 0, 1, 1, 1, 0, 1], 3: [1, 0, 1, 1, 0, 1, 1], 4: [0, 1, 1, 1, 0, 1, 0] };
function drawDigit(sheet, W, H, n, x0, y0, w, h, col) {
  const s = SEG[n], th = Math.round(w * 0.22);
  const put = (px, py) => { if (px < 0 || py < 0 || px >= W || py >= H) return; const i = (py * W + px) * 4; sheet[i] = col[0]; sheet[i + 1] = col[1]; sheet[i + 2] = col[2]; sheet[i + 3] = 255; };
  const hbar = (x, y) => { for (let dy = 0; dy < th; dy++) for (let dx = 0; dx < w; dx++) put(x0 + x + dx, y0 + y + dy); };
  const vbar = (x, y) => { for (let dy = 0; dy < h / 2; dy++) for (let dx = 0; dx < th; dx++) put(x0 + x + dx, y0 + y + dy); };
  if (s[0]) hbar(0, 0); if (s[1]) vbar(0, 0); if (s[2]) vbar(w - th, 0); if (s[3]) hbar(0, h / 2 - th / 2);
  if (s[4]) vbar(0, h / 2); if (s[5]) vbar(w - th, h / 2); if (s[6]) hbar(0, h - th);
}

// PNG
function crc32(b) { let c = ~0; for (let i = 0; i < b.length; i++) { c ^= b[i]; for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xEDB88320 & -(c & 1)); } return (~c) >>> 0; }
function chunk(t, d) { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const body = Buffer.concat([Buffer.from(t), d]); const cr = Buffer.alloc(4); cr.writeUInt32BE(crc32(body)); return Buffer.concat([l, body, cr]); }
function encodePNG(data, w, h) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  const stride = w * 4, raw = Buffer.alloc((stride + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (stride + 1)] = 0; data.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride); }
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

const IC = 512;
const rendered = styles.map(s => renderStyle(s));
styles.forEach((s, i) => writeFileSync(new URL(`modern${i + 1}-${s.name}.png`, OUT), encodePNG(rendered[i].data, IC, IC)));

// 2x2 contact sheet
const cols = 2, rows = 2, gap = 40, margin = 44, label = 74;
const W = margin * 2 + cols * IC + (cols - 1) * gap;
const H = margin * 2 + rows * (IC + label) + (rows - 1) * gap;
const sheet = Buffer.alloc(W * H * 4);
for (let i = 0; i < W * H; i++) { sheet[i * 4] = 0x0a; sheet[i * 4 + 1] = 0x14; sheet[i * 4 + 2] = 0x0f; sheet[i * 4 + 3] = 255; }
rendered.forEach((icon, idx) => {
  const cx = idx % cols, cy = Math.floor(idx / cols);
  const ox = margin + cx * (IC + gap), oy = margin + cy * (IC + label + gap);
  drawDigit(sheet, W, H, idx + 1, ox + IC / 2 - 20, oy + IC + 14, 40, 46, GOLD);
  for (let y = 0; y < IC; y++) for (let x = 0; x < IC; x++) {
    const s = (y * IC + x) * 4, a = icon.data[s + 3] / 255, px = ox + x, py = oy + y;
    const d = (py * W + px) * 4;
    for (let c = 0; c < 3; c++) sheet[d + c] = Math.round(icon.data[s + c] * a + sheet[d + c] * (1 - a));
    sheet[d + 3] = 255;
  }
});
writeFileSync(new URL('modern-sheet.png', OUT), encodePNG(sheet, W, H));
console.log('wrote 4 modern styles + modern-sheet.png', W + 'x' + H);
