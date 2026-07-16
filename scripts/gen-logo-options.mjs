// Renders several logo/icon options for the Salah tracker so the user can pick.
// Dependency-free: draws each motif on the brand green gradient, supersampled
// for smooth edges, and composes a numbered contact sheet.
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';

const OUT = new URL('../options/', import.meta.url);
mkdirSync(OUT, { recursive: true });

const TOP = [0x14, 0x50, 0x3a], BOT = [0x0b, 0x1f, 0x17];
const GOLD = [0xe9, 0xc4, 0x6a], GOLD_D = [0xc9, 0x9a, 0x3b];
const lerp = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
const goldAt = (y, S) => lerp(GOLD, GOLD_D, Math.min(1, (y / S) * 0.85));

// ---- geometry helpers (supersampled coords) ----
const D2 = (x, y, cx, cy) => (x - cx) ** 2 + (y - cy) ** 2;
const disc = (x, y, cx, cy, r) => D2(x, y, cx, cy) <= r * r;
const rect = (x, y, a, b, c, d) => x >= a && x <= c && y >= b && y <= d;
function inPoly(x, y, pts) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i], [xj, yj] = pts[j];
    if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) inside = !inside;
  }
  return inside;
}
const rotSquare = (x, y, cx, cy, h, ang) => {
  const c = Math.cos(ang), s = Math.sin(ang), dx = x - cx, dy = y - cy;
  return Math.abs(dx * c + dy * s) <= h && Math.abs(-dx * s + dy * c) <= h;
};

// ---- motifs: colorFn(x,y,S) -> [r,g,b] overlay or null (use gradient) ----
const motifs = {
  // 1. Mosque: dome + minarets + arched door
  mosque(x, y, S) {
    const u = S, g = goldAt(y, S);
    const mL = rect(x, y, 0.235 * u, 0.40 * u, 0.285 * u, 0.735 * u);
    const mR = rect(x, y, 0.715 * u, 0.40 * u, 0.765 * u, 0.735 * u);
    const fL = disc(x, y, 0.26 * u, 0.365 * u, 0.02 * u);
    const fR = disc(x, y, 0.74 * u, 0.365 * u, 0.02 * u);
    const base = rect(x, y, 0.32 * u, 0.52 * u, 0.68 * u, 0.735 * u);
    const dome = disc(x, y, 0.5 * u, 0.52 * u, 0.135 * u) && y <= 0.52 * u;
    const dfin = disc(x, y, 0.5 * u, 0.345 * u, 0.022 * u) || rect(x, y, 0.495 * u, 0.345 * u, 0.505 * u, 0.39 * u);
    const solid = mL || mR || fL || fR || base || dome || dfin;
    if (!solid) return null;
    // carve green pointed-arch door in the base
    const door = x > 0.445 * u && x < 0.555 * u &&
      ((y > 0.60 * u && y < 0.735 * u) ||
       (y <= 0.60 * u && disc(x, y, 0.445 * u, 0.60 * u, 0.11 * u) && disc(x, y, 0.555 * u, 0.60 * u, 0.11 * u)));
    if (base && door && !(dome)) return null;
    return g;
  },
  // 2. Khatam — eight-point Islamic star (two overlaid squares)
  star(x, y, S) {
    const u = S, h = 0.30 * u;
    const a = rotSquare(x, y, 0.5 * u, 0.5 * u, h, 0);
    const b = rotSquare(x, y, 0.5 * u, 0.5 * u, h, Math.PI / 4);
    if (!(a || b)) return null;
    if (disc(x, y, 0.5 * u, 0.5 * u, 0.115 * u) && !disc(x, y, 0.5 * u, 0.5 * u, 0.05 * u)) return null;
    return goldAt(y, S);
  },
  // 3. Misbaha — prayer beads ring with a tassel
  beads(x, y, S) {
    const u = S, R = 0.265 * u, cx = 0.5 * u, cy = 0.42 * u, bead = 0.042 * u, N = 12;
    for (let i = 0; i < N; i++) {
      const ang = -Math.PI / 2 + i * (2 * Math.PI / N);
      if (disc(x, y, cx + R * Math.cos(ang), cy + R * Math.sin(ang), bead)) return goldAt(y, S);
    }
    for (const ty of [cy + R + 0.06 * u, cy + R + 0.125 * u, cy + R + 0.19 * u])
      if (disc(x, y, cx, ty, 0.032 * u)) return goldAt(y, S);
    if (inPoly(x, y, [[cx - 0.055 * u, cy + R + 0.22 * u], [cx + 0.055 * u, cy + R + 0.22 * u], [cx, cy + R + 0.33 * u]]))
      return goldAt(y, S);
    return null;
  },
  // 4. Mihrab — pointed prayer niche with a hanging lamp
  mihrab(x, y, S) {
    const u = S, ax0 = 0.34 * u, ax1 = 0.66 * u, spring = 0.44 * u, baseY = 0.72 * u, r = 0.32 * u, t = 0.055 * u;
    const outer = (x >= ax0 && x <= ax1 && y >= spring && y <= baseY) ||
      (y < spring && disc(x, y, ax0, spring, r) && disc(x, y, ax1, spring, r));
    const inner = (x >= ax0 + t && x <= ax1 - t && y >= spring && y <= baseY - t) ||
      (y < spring && disc(x, y, ax0 + t, spring, r - t) && disc(x, y, ax1 - t, spring, r - t));
    const archBorder = outer && !inner;
    const baseBar = rect(x, y, 0.30 * u, 0.72 * u, 0.70 * u, 0.765 * u);
    const lamp = disc(x, y, 0.5 * u, 0.40 * u, 0.028 * u) || rect(x, y, 0.497 * u, 0.30 * u, 0.503 * u, 0.375 * u);
    return (archBorder || baseBar || lamp) ? goldAt(y, S) : null;
  },
  // 5. Kaaba — 3D cube with kiswah band
  kaaba(x, y, S) {
    const u = S;
    const fx0 = 0.32 * u, fx1 = 0.68 * u, fy0 = 0.44 * u, fy1 = 0.74 * u, dx = 0.06 * u, dy = 0.09 * u;
    const front = rect(x, y, fx0, fy0, fx1, fy1);
    const top = inPoly(x, y, [[fx0, fy0], [fx0 + dx, fy0 - dy], [fx1 + dx, fy0 - dy], [fx1, fy0]]);
    const side = inPoly(x, y, [[fx1, fy0], [fx1 + dx, fy0 - dy], [fx1 + dx, fy1 - dy], [fx1, fy1]]);
    if (!(front || top || side)) return null;
    const band = front && y >= 0.505 * u && y <= 0.55 * u;
    const door = front && x >= 0.47 * u && x <= 0.53 * u && y >= 0.60 * u;
    const sideBand = side && y >= 0.505 * u - dy * ((x - fx1) / dx) && y <= 0.55 * u - dy * ((x - fx1) / dx);
    if (band || door || sideBand) return goldAt(y, S);
    if (top) return [0x25, 0x30, 0x2a];
    if (side) return [0x10, 0x17, 0x13];
    return [0x18, 0x20, 0x1b];
  },
  // 6. Crescent cradling a mosque dome
  crescentDome(x, y, S) {
    const u = S, R = 0.30 * u, ccx = 0.44 * u, ccy = 0.5 * u;
    const crescent = disc(x, y, ccx, ccy, R) && !disc(x, y, ccx + 0.17 * u, ccy - 0.03 * u, R * 0.92);
    const dCx = 0.63 * u, dCy = 0.57 * u;
    const dome = disc(x, y, dCx, dCy, 0.10 * u) && y <= dCy;
    const dBase = rect(x, y, dCx - 0.10 * u, dCy, dCx + 0.10 * u, dCy + 0.12 * u);
    const dFin = disc(x, y, dCx, dCy - 0.13 * u, 0.016 * u) || rect(x, y, dCx - 0.005 * u, dCy - 0.13 * u, dCx + 0.005 * u, dCy - 0.10 * u);
    return (crescent || dome || dBase || dFin) ? goldAt(y, S) : null;
  },
};

// ---- render one icon (supersampled -> downscaled) ----
function renderIcon(colorFn, size = 512, ss = 3) {
  const S = size * ss, buf = Buffer.alloc(S * S * 4);
  const radius = S * 0.24;
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const i = (y * S + x) * 4;
      // rounded-corner alpha
      let alpha = 1;
      const rx = Math.min(x, S - 1 - x), ry = Math.min(y, S - 1 - y);
      if (rx < radius && ry < radius) {
        const d = Math.hypot(radius - rx, radius - ry);
        alpha = Math.max(0, Math.min(1, radius - d + 0.5));
      }
      if (alpha <= 0) continue;
      let rgb = lerp(TOP, BOT, y / S);
      const gd = Math.hypot(x - S / 2, y - S * 0.12) / (S * 0.6);
      if (gd < 1) rgb = lerp(rgb, GOLD, (1 - gd) * 0.05);
      const m = colorFn(x, y, S);
      if (m) rgb = m;
      buf[i] = rgb[0]; buf[i + 1] = rgb[1]; buf[i + 2] = rgb[2]; buf[i + 3] = Math.round(255 * alpha);
    }
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

// ---- 7-seg digit for numbering the contact sheet ----
// segment order: [a(top), f(top-left), b(top-right), g(mid), e(bot-left), c(bot-right), d(bot)]
const SEG = { 1: [0, 0, 1, 0, 0, 1, 0], 2: [1, 0, 1, 1, 1, 0, 1], 3: [1, 0, 1, 1, 0, 1, 1], 4: [0, 1, 1, 1, 0, 1, 0], 5: [1, 1, 0, 1, 0, 1, 1], 6: [1, 1, 0, 1, 1, 1, 1] };
function drawDigit(sheet, W, n, x0, y0, w, h, col) {
  const segs = SEG[n], th = Math.round(w * 0.22);
  const put = (px, py) => { if (px < 0 || py < 0 || px >= W) return; const i = (py * W + px) * 4; sheet[i] = col[0]; sheet[i + 1] = col[1]; sheet[i + 2] = col[2]; sheet[i + 3] = 255; };
  const hbar = (x, y) => { for (let dy = 0; dy < th; dy++) for (let dx = 0; dx < w; dx++) put(x0 + x + dx, y0 + y + dy); };
  const vbar = (x, y) => { for (let dy = 0; dy < h / 2; dy++) for (let dx = 0; dx < th; dx++) put(x0 + x + dx, y0 + y + dy); };
  if (segs[0]) hbar(0, 0);                    // top
  if (segs[1]) vbar(0, 0);                     // top-left
  if (segs[2]) vbar(w - th, 0);                // top-right
  if (segs[3]) hbar(0, h / 2 - th / 2);        // middle
  if (segs[4]) vbar(0, h / 2);                 // bottom-left
  if (segs[5]) vbar(w - th, h / 2);            // bottom-right
  if (segs[6]) hbar(0, h - th);                // bottom
}

// ---- PNG encoder ----
function crc32(buf) { let c = ~0; for (let i = 0; i < buf.length; i++) { c ^= buf[i]; for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xEDB88320 & -(c & 1)); } return (~c) >>> 0; }
function chunk(type, data) { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const body = Buffer.concat([Buffer.from(type, 'ascii'), data]); const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body)); return Buffer.concat([len, body, crc]); }
function encodePNG({ data, size }, w = size, h = size) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  const stride = w * 4, raw = Buffer.alloc((stride + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (stride + 1)] = 0; data.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride); }
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

// ---- render all + contact sheet ----
const order = [
  ['mosque', 'mosque'], ['star', 'star'], ['beads', 'beads'],
  ['mihrab', 'mihrab'], ['kaaba', 'kaaba'], ['crescentDome', 'crescentDome'],
];
const IC = 512;
const icons = order.map(([k]) => renderIcon(motifs[k], IC));
order.forEach(([k], idx) => writeFileSync(new URL(`opt${idx + 1}-${k}.png`, OUT), encodePNG(icons[idx])));

// contact sheet 3x2
const cols = 3, rows = 2, gap = 34, margin = 40, label = 70;
const W = margin * 2 + cols * IC + (cols - 1) * gap;
const H = margin * 2 + rows * (IC + label) + (rows - 1) * gap;
const sheet = Buffer.alloc(W * H * 4);
for (let i = 0; i < W * H; i++) { sheet[i * 4] = 0x0a; sheet[i * 4 + 1] = 0x14; sheet[i * 4 + 2] = 0x0f; sheet[i * 4 + 3] = 255; }
function blit(icon, ox, oy) {
  for (let y = 0; y < IC; y++) for (let x = 0; x < IC; x++) {
    const s = (y * IC + x) * 4, a = icon.data[s + 3] / 255;
    const px = ox + x, py = oy + y; if (px < 0 || py < 0 || px >= W || py >= H) continue;
    const d = (py * W + px) * 4;
    for (let c = 0; c < 3; c++) sheet[d + c] = Math.round(icon.data[s + c] * a + sheet[d + c] * (1 - a));
    sheet[d + 3] = 255;
  }
}
icons.forEach((icon, idx) => {
  const cx = idx % cols, cy = Math.floor(idx / cols);
  const ox = margin + cx * (IC + gap), oy = margin + cy * (IC + label + gap);
  drawDigit(sheet, W, idx + 1, ox + IC / 2 - 20, oy + IC + 12, 40, 46, GOLD);
  blit(icon, ox, oy);
});
writeFileSync(new URL('contact-sheet.png', OUT), encodePNG({ data: sheet, size: W }, W, H));
console.log('wrote', order.length, 'options + contact-sheet.png', W + 'x' + H);
