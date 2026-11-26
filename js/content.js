// Page content. Every drawer works in millimetres with the origin at the
// finished page's lower-left corner. Specs (from Leo's reference generators):
//   guides 0.28 mm #C8C8C8, dots 0.30 mm #999 on a 5 mm grid,
//   outer margin 4.5-5 mm, gutter 8.5-9.5 mm, mirrored for left/right pages,
//   no circles anywhere except the dots themselves.

export const GUIDE = { w: 0.28, color: '#C8C8C8' };
export const DOT = { d: 0.3, color: '#999999' };
export const OUTER = 5;
export const GUTTER = 9;
const LABEL = '#9A9A9A';
const INK = '#5A5A5A';
const PAGE_NUM = '#D6D6D6';

export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAY_ABBR = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

// Content rectangle: verso (even, left-hand) has the gutter on the right.
export function contentBox(W, H, verso, outer = OUTER, gutter = GUTTER) {
  return { x: verso ? outer : gutter, y: outer, w: W - outer - gutter, h: H - 2 * outer };
}

// ---------------------------------------------------------------- dot grid
// Port of build_insert.draw_dots: dots symmetric to the page edges, the
// column nearest the fold dropped so the gutter is one extra step. If that
// leaves the margins outside 4.5-5 mm (outer) / 8.5-9.5 mm (gutter), as with
// a 3 mm step, the grid is instead centred inside those margin ranges.
export const DEFAULT_DOT_STEP = 3;
export function dotColumns(W, verso, step) {
  const nx = Math.floor((W - 9 + 1e-6) / step);
  const mx = (W - nx * step) / 2;
  let xs = [];
  for (let i = 0; i <= nx; i++) xs.push(mx + i * step);
  while (xs.length && (verso ? W - xs[xs.length - 1] : xs[0]) < 8.5 - 1e-6) {
    if (verso) xs.pop(); else xs.shift();
  }
  const outer = verso ? xs[0] : W - xs[xs.length - 1];
  const gutter = verso ? W - xs[xs.length - 1] : xs[0];
  if (outer <= 5 + 1e-6 && gutter <= 9.5 + 1e-6) return xs;
  const n = Math.floor((W - 13 + 1e-6) / step);
  const slack = W - 13 - n * step;
  const o = 4.5 + slack / 2, g = 8.5 + slack / 2;
  xs = [];
  for (let i = 0; i <= n; i++) xs.push(verso ? o + i * step : g + i * step);
  return xs;
}
export function drawDotGrid(r, W, H, verso, step = DEFAULT_DOT_STEP) {
  const xs = dotColumns(W, verso, step);
  const ny = Math.floor((H - 9 + 1e-6) / step);
  const my = (H - ny * step) / 2; // 4.5 mm (5 mm step) or 5 mm (3 mm step) for 124 mm
  const pts = [];
  for (const x of xs) for (let j = 0; j <= ny; j++) pts.push([x, my + j * step]);
  r.dots(pts, DOT.d, DOT.color);
}

// ---------------------------------------------------------------- lined
export function drawLined(r, W, H, verso, spacing = 6) {
  const b = contentBox(W, H, verso);
  const segs = [];
  for (let y = b.y + b.h; y >= b.y - 1e-6; y -= spacing) segs.push([b.x, y, b.x + b.w, y]);
  r.lines(segs, GUIDE);
}

// ---------------------------------------------------------------- dates
export function parseISODate(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || '');
  if (!m) return null;
  return new Date(+m[1], +m[2] - 1, +m[3]);
}
function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
function weekStartOf(d, ws) { // ws: 1 = Monday, 0 = Sunday
  const off = (d.getDay() - ws + 7) % 7;
  return addDays(d, -off);
}
function shortDate(d) { return `${MONTHS[d.getMonth()].slice(0, 3).toUpperCase()} ${d.getDate()}`; }

// ---------------------------------------------------------------- weekly
// Two-page spread: left = header + 4 days, right = 3 days + notes.
export function drawWeekly(r, W, H, verso, desc) {
  const o = desc.opts;
  const ws = o.weekStart === 'sun' ? 0 : 1;
  const b = contentBox(W, H, verso);
  const headH = 9;
  const top = b.y + b.h;
  const dated = o.dated && parseISODate(o.start);
  let days;
  if (dated) {
    const first = addDays(weekStartOf(parseISODate(o.start), ws), 7 * desc.unit);
    days = Array.from({ length: 7 }, (_, i) => addDays(first, i));
  }
  const names = Array.from({ length: 7 }, (_, i) => DAY_ABBR[(ws + i) % 7]);

  // header
  const hy = top - 4.2;
  if (desc.side === 'L') {
    if (dated) {
      r.text(`${shortDate(days[0])} - ${shortDate(days[6])}`, b.x, hy, { size: 7, color: INK, bold: true });
      r.text(String(days[6].getFullYear()), b.x + b.w, hy, { size: 6, color: LABEL, align: 'right' });
    } else {
      r.text('WEEK OF', b.x, hy, { size: 6, color: LABEL, bold: true });
      const lx = b.x + r.textWidth('WEEK OF', 6, true) + 2;
      r.line(lx, hy - 0.6, b.x + b.w, hy - 0.6, GUIDE);
    }
  } else if (dated) {
    const m1 = days[0].getMonth(), m2 = days[6].getMonth();
    const label = m1 === m2 ? MONTHS[m1] : `${MONTHS[m1]} / ${MONTHS[m2]}`;
    r.text(label.toUpperCase(), b.x + b.w, hy, { size: 6, color: LABEL, align: 'right', bold: true });
  }

  const slots = desc.side === 'L' ? [0, 1, 2, 3] : [4, 5, 6, 'notes'];
  const areaTop = top - headH;
  const secH = (areaTop - b.y) / 4;
  slots.forEach((s, i) => {
    const yTop = areaTop - i * secH;
    r.line(b.x, yTop, b.x + b.w, yTop, GUIDE);
    const ly = yTop - 3.2;
    if (s === 'notes') {
      r.text('NOTES', b.x + 0.6, ly, { size: 5.5, color: LABEL, bold: true });
      return;
    }
    r.text(names[s], b.x + 0.6, ly, { size: 5.5, color: LABEL, bold: true });
    if (dated) r.text(String(days[s].getDate()), b.x + 0.6 + r.textWidth(names[s], 5.5, true) + 1.4, ly, { size: 5.5, color: LABEL });
  });
  r.line(b.x, b.y, b.x + b.w, b.y, GUIDE);
}

// ---------------------------------------------------------------- monthly
// Two-page spread: left = 4 weekday columns, right = 3 weekday columns + notes.
export function drawMonthly(r, W, H, verso, desc) {
  const o = desc.opts;
  const ws = o.weekStart === 'sun' ? 0 : 1;
  const b = contentBox(W, H, verso);
  const top = b.y + b.h;
  let y0 = null, m0 = null, offset = 0, dim = 0, rows = 6;
  const dated = o.dated && /^\d{4}-\d{2}$/.test(o.month || '');
  if (dated) {
    const [yy, mm] = o.month.split('-').map(Number);
    const d = new Date(yy, mm - 1 + desc.unit, 1);
    y0 = d.getFullYear(); m0 = d.getMonth();
    offset = (d.getDay() - ws + 7) % 7;
    dim = new Date(y0, m0 + 1, 0).getDate();
    rows = Math.ceil((offset + dim) / 7);
  }
  const hy = top - 4.2;
  if (desc.side === 'L') {
    if (dated) {
      r.text(MONTHS[m0].toUpperCase(), b.x, hy, { size: 7, color: INK, bold: true });
      r.text(String(y0), b.x + b.w, hy, { size: 6, color: LABEL, align: 'right' });
    } else {
      r.text('MONTH', b.x, hy, { size: 6, color: LABEL, bold: true });
      const lx = b.x + r.textWidth('MONTH', 6, true) + 2;
      r.line(lx, hy - 0.6, b.x + b.w, hy - 0.6, GUIDE);
    }
  }
  const cols = 4;
  const colW = b.w / cols;
  const dayRowTop = top - 9;
  const gridTop = dayRowTop - 4.5;
  const cellH = (gridTop - b.y) / rows;
  const segs = [];
  for (let i = 0; i <= rows; i++) segs.push([b.x, gridTop - i * cellH, b.x + b.w, gridTop - i * cellH]);
  for (let c = 0; c <= cols; c++) segs.push([b.x + c * colW, gridTop, b.x + c * colW, b.y]);
  r.lines(segs, GUIDE);
  for (let c = 0; c < cols; c++) {
    const g = desc.side === 'L' ? c : 4 + c; // global column 0..6, 7 = notes
    const label = g === 7 ? 'NOTES' : DAY_ABBR[(ws + g) % 7];
    r.text(label, b.x + c * colW + colW / 2, dayRowTop - 3.2, { size: 5.5, color: LABEL, bold: true, align: 'center' });
    if (!dated || g === 7) continue;
    for (let row = 0; row < rows; row++) {
      const day = row * 7 + g - offset + 1;
      if (day < 1 || day > dim) continue;
      r.text(String(day), b.x + c * colW + 1, gridTop - row * cellH - 2.6, { size: 5, color: LABEL });
    }
  }
}

// ---------------------------------------------------------------- comics
// Port of build_comic.py layouts (pages 2-31 of the reference book).
const C_OUTER = 5, C_INNER = 8.5, PG = 2.75;

function splitSizes(len, weights, gutter) {
  const inner = len - gutter * (weights.length - 1);
  const tot = weights.reduce((a, b) => a + b, 0);
  let pos = 0;
  return weights.map((w) => { const s = inner * (w / tot); const o = [pos, s]; pos += s + gutter; return o; });
}
function bands(box, rowW, colRows, g = PG) {
  const [x, y, w, h] = box;
  const out = [];
  splitSizes(h, rowW, g).forEach(([rt, rh], i) => {
    const ry = y + h - rt - rh;
    for (const [cx, cw] of splitSizes(w, colRows[i], g)) out.push([x + cx, ry, cw, rh]);
  });
  return out;
}
function columns(box, colW, rowCols, g = PG) {
  const [x, y, w, h] = box;
  const out = [];
  splitSizes(w, colW, g).forEach(([cx, cw], i) => {
    for (const [rt, rh] of splitSizes(h, rowCols[i], g)) out.push([x + cx, y + h - rt - rh, cw, rh]);
  });
  return out;
}
const PANEL = { stroke: GUIDE.color, w: GUIDE.w, fill: '#FFFFFF' };
function rects(r, list) { for (const q of list) r.rect(...q, PANEL); }

function sideOf(p, a, b) { return (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]); }
function lineIx(p1, p2, p3, p4) {
  const den = (p1[0] - p2[0]) * (p3[1] - p4[1]) - (p1[1] - p2[1]) * (p3[0] - p4[0]);
  if (Math.abs(den) < 1e-12) return null;
  const t = ((p1[0] - p3[0]) * (p3[1] - p4[1]) - (p1[1] - p3[1]) * (p3[0] - p4[0])) / den;
  return [p1[0] + t * (p2[0] - p1[0]), p1[1] + t * (p2[1] - p1[1])];
}
function uniq(pts, eps = 0.02) {
  const out = [];
  for (const p of pts) if (!out.some((q) => Math.hypot(p[0] - q[0], p[1] - q[1]) < eps)) out.push(p);
  return out;
}
function orderConvex(pts) {
  pts = uniq(pts);
  const cx = pts.reduce((a, p) => a + p[0], 0) / pts.length;
  const cy = pts.reduce((a, p) => a + p[1], 0) / pts.length;
  return pts.sort((a, b) => Math.atan2(a[1] - cy, a[0] - cx) - Math.atan2(b[1] - cy, b[0] - cx));
}
function clipLineRect(a, b, [x, y, w, h]) {
  const edges = [[[x, y], [x + w, y]], [[x + w, y], [x + w, y + h]], [[x + w, y + h], [x, y + h]], [[x, y + h], [x, y]]];
  const hits = [];
  for (const [e1, e2] of edges) {
    const ip = lineIx(a, b, e1, e2);
    if (ip && ip[0] >= x - 1e-4 && ip[0] <= x + w + 1e-4 && ip[1] >= y - 1e-4 && ip[1] <= y + h + 1e-4) hits.push(ip);
  }
  return uniq(hits, 0.05);
}
function splitRectByLine(box, a, b, g = PG) {
  const [x, y, w, h] = box;
  const corners = [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const nx = -(b[1] - a[1]) / L, ny = (b[0] - a[0]) / L, half = g / 2;
  const panel = (s) => {
    const oa = [a[0] + s * nx * half, a[1] + s * ny * half];
    const ob = [b[0] + s * nx * half, b[1] + s * ny * half];
    const pts = corners.filter((c) => s * sideOf(c, oa, ob) >= -1e-6);
    pts.push(...clipLineRect(oa, ob, box));
    return orderConvex(pts);
  };
  return [panel(1), panel(-1)];
}
function slantedTiers(box, n = 3, slant = 8.5, g = PG) {
  const [x, y, w, h] = box;
  const th = Math.atan(slant / w);
  const vh = g / 2 / Math.cos(th);
  const mids = Array.from({ length: n - 1 }, (_, i) => y + h * ((i + 1) / n));
  const lr = (m, d) => [m - slant / 2 + d, m + slant / 2 + d];
  const polys = [];
  for (let i = 0; i < n; i++) {
    let bot, tp;
    if (i === 0) bot = [[x, y], [x + w, y]];
    else { const [ly, ry] = lr(mids[i - 1], vh); bot = [[x, ly], [x + w, ry]]; }
    if (i === n - 1) tp = [[x, y + h], [x + w, y + h]];
    else { const [ly, ry] = lr(mids[i], -vh); tp = [[x, ly], [x + w, ry]]; }
    polys.push([bot[0], bot[1], tp[1], tp[0]]);
  }
  return polys.reverse();
}
function bleedPanel(r, x, y, w, h) {
  const t = 3.2, o = { w: 0.22, color: '#D0D0D0' };
  r.lines([
    [x, y + t, x, y], [x, y, x + t, y],
    [x + w - t, y, x + w, y], [x + w, y, x + w, y + t],
    [x + w, y + h - t, x + w, y + h], [x + w, y + h, x + w - t, y + h],
    [x + t, y + h, x, y + h], [x, y + h, x, y + h - t],
  ], o);
}

// [panel count, description, special?, draw(r, box)]
export const COMIC_LAYOUTS = [
  [3, 'Classic 3-tier', false, (r, b) => rects(r, bands(b, [1, 1, 1], [[1], [1], [1]]))],
  [3, 'Dominant tall left, two stacked right', false, (r, b) => rects(r, columns(b, [1.4, 1], [[1], [1, 1]]))],
  [3, 'Dominant wide top, two below', false, (r, b) => rects(r, bands(b, [1.4, 1], [[1], [1, 1]]))],
  [5, 'Sandwich 2-1-2', false, (r, b) => rects(r, bands(b, [1, 1.35, 1], [[1, 1], [1], [1, 1]]))],
  [3, 'Cinematic thin-tall-thin', false, (r, b) => rects(r, bands(b, [0.85, 2.0, 0.85], [[1], [1], [1]]))],
  [3, 'Two stacked left, tall right', false, (r, b) => rects(r, columns(b, [1, 1.25], [[1, 1], [1]]))],
  [3, 'Bottom-weighted thirds', false, (r, b) => rects(r, bands(b, [0.9, 0.85, 1.4], [[1], [1], [1]]))],
  [5, 'Classic 1-2-2', false, (r, b) => rects(r, bands(b, [1.35, 1, 1], [[1], [1, 1], [1, 1]]))],
  [5, 'Tall left with 2x2 right', false, (r, b) => {
    const [x, y, w, h] = b;
    const [[lx, lw], [rx, rw]] = splitSizes(w, [1.15, 1], PG);
    r.rect(x + lx, y, lw, h, PANEL);
    rects(r, bands([x + rx, y, rw, h], [1, 1], [[1, 1], [1, 1]]));
  }],
  [2, 'Surprise: diagonal gutter', true, (r, b) => {
    const [x, y, w, h] = b;
    for (const p of splitRectByLine(b, [x, y], [x + w, y + h])) r.poly(p, PANEL);
  }],
  [3, 'Three verticals, wide center', false, (r, b) => rects(r, columns(b, [0.85, 1.3, 0.85], [[1], [1], [1]]))],
  [7, 'Dense 3-2-2', false, (r, b) => rects(r, bands(b, [1, 1, 1.05], [[1, 1, 1], [1, 1], [1, 1]]))],
  [1, 'Single splash', false, (r, b) => r.rect(...b, PANEL)],
  [5, 'Three across, two below', false, (r, b) => rects(r, bands(b, [1, 1.25], [[1, 1, 1], [1, 1]]))],
  [2, 'Surprise: overlapping inset', true, (r, b) => {
    const [x, y, w, h] = b;
    r.rect(...b, PANEL);
    const iw = 0.42 * w, ih = 0.34 * h, ix = x + w - iw - 3, iy = y + 3;
    r.rect(ix - 2, iy - 2, iw + 4, ih + 4, { stroke: null, fill: '#FFFFFF' });
    r.rect(ix, iy, iw, ih, PANEL);
  }],
  [3, 'Uneven thirds', false, (r, b) => rects(r, bands(b, [0.7, 1.5, 1.1], [[1], [1], [1]]))],
  [7, 'Classic 2-3-2', false, (r, b) => rects(r, bands(b, [1, 1.15, 1], [[1, 1], [1, 1, 1], [1, 1]]))],
  [3, 'Top-weighted, skinny middle', false, (r, b) => rects(r, bands(b, [1.25, 0.7, 1.05], [[1], [1], [1]]))],
  [3, 'Two unequal top, wide bottom', false, (r, b) => rects(r, bands(b, [1, 1.6], [[0.42, 0.58], [1]]))],
  [5, 'Staggered 2-2-1', false, (r, b) => rects(r, bands(b, [1, 1, 1.25], [[0.4, 0.6], [0.6, 0.4], [1]]))],
  [1, 'Surprise: borderless bleed', true, (r, b) => bleedPanel(r, ...b)],
  [7, '3-3-1 wide bottom', false, (r, b) => rects(r, bands(b, [1, 1, 1.3], [[1, 1, 1], [1, 1, 1], [1]]))],
  [3, 'Narrow tall left, two stacked right', false, (r, b) => rects(r, columns(b, [0.48, 1], [[1], [1.3, 1]]))],
  [5, '1-3-1', false, (r, b) => rects(r, bands(b, [1, 0.9, 1.05], [[1], [1, 1, 1], [1]]))],
  [3, 'Descending thirds', false, (r, b) => rects(r, bands(b, [1.5, 1.1, 0.8], [[1], [1], [1]]))],
  [7, '2-2-3', false, (r, b) => rects(r, bands(b, [1, 1, 1.2], [[1, 1], [1, 1], [1, 1, 1]]))],
  [5, 'Narrow left, four stacked right', false, (r, b) => rects(r, columns(b, [0.42, 1], [[1], [1, 1, 1, 1]]))],
  [3, 'Two stacked left, tall right', false, (r, b) => rects(r, columns(b, [1, 1.15], [[0.7, 1.15], [1]]))],
  [5, 'Staggered 1-2-2', false, (r, b) => rects(r, bands(b, [1.15, 1, 1], [[1], [0.38, 0.62], [0.62, 0.38]]))],
  [3, 'Surprise: slanted tiers', true, (r, b) => { for (const p of slantedTiers(b, 3, 8.5)) r.poly(p, PANEL); }],
];

export function comicLayoutFor(idx, opts) {
  const list = opts.surprise === false ? COMIC_LAYOUTS.filter((l) => !l[2]) : COMIC_LAYOUTS;
  const start = Math.max(0, (opts.startLayout | 0) - 1);
  return list[(start + idx) % list.length];
}

export function drawComic(r, W, H, verso, desc) {
  const box = [verso ? C_OUTER : C_INNER, C_OUTER, W - C_OUTER - C_INNER, H - 2 * C_OUTER];
  comicLayoutFor(desc.unit, desc.opts)[3](r, box);
}

// ---------------------------------------------------------------- word search
function wordSearchGeom(W, H, verso) {
  const b = contentBox(W, H, verso);
  const n = desiredGrid(b.w);
  const cell = Math.min(6, b.w / n);
  const gw = cell * n;
  return { b, n, cell, gx: b.x + (b.w - gw) / 2, gTop: b.y + b.h - 9 };
}
function desiredGrid() { return 12; }

export function drawWordSearch(r, W, H, verso, desc) {
  const p = desc.puzzle;
  const { b, n, cell, gx, gTop } = wordSearchGeom(W, H, verso);
  const top = b.y + b.h;
  r.text('WORD SEARCH', b.x, top - 4.2, { size: 6.5, color: INK, bold: true });
  r.text(`${p.theme.toUpperCase()}  #${p.number}`, b.x + b.w, top - 4.2, { size: 6, color: LABEL, align: 'right' });
  r.rect(gx - 0.8, gTop - n * cell - 0.8, n * cell + 1.6, n * cell + 1.6, { stroke: GUIDE.color, w: GUIDE.w });
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    r.text(p.grid[i][j], gx + j * cell + cell / 2, gTop - i * cell - cell * 0.72, { size: 9, color: INK, align: 'center' });
  }
  // word list, 3 columns, small square checkboxes
  const listTop = gTop - n * cell - 6;
  const colW = b.w / 3;
  p.words.forEach((w, k) => {
    const c = k % 3, row = Math.floor(k / 3);
    const x = b.x + c * colW, y = listTop - row * 4.6;
    r.rect(x, y - 0.2, 1.9, 1.9, { stroke: GUIDE.color, w: GUIDE.w });
    r.text(w, x + 3, y, { size: 5.8, color: INK });
  });
}

// ---------------------------------------------------------------- sudoku
export function drawSudoku(r, W, H, verso, desc) {
  const p = desc.puzzle;
  const b = contentBox(W, H, verso);
  const top = b.y + b.h;
  r.text('SUDOKU', b.x, top - 4.2, { size: 6.5, color: INK, bold: true });
  r.text(`${p.level.toUpperCase()}  #${p.number}`, b.x + b.w, top - 4.2, { size: 6, color: LABEL, align: 'right' });
  const cell = Math.min(7.6, b.w / 9);
  const g = cell * 9;
  const gx = b.x + (b.w - g) / 2;
  const gTop = top - 10;
  drawSudokuGrid(r, gx, gTop, cell, p.puzzle, null, 11);
  // notes area under the grid
  const ny = gTop - g - 6;
  r.text('NOTES', b.x, ny, { size: 5.5, color: LABEL, bold: true });
}

function drawSudokuGrid(r, gx, gTop, cell, givens, solution, size) {
  const thin = [], thick = [];
  for (let i = 0; i <= 9; i++) {
    const t = i % 3 === 0 ? thick : thin;
    t.push([gx, gTop - i * cell, gx + 9 * cell, gTop - i * cell]);
    t.push([gx + i * cell, gTop, gx + i * cell, gTop - 9 * cell]);
  }
  r.lines(thin, GUIDE);
  r.lines(thick, { w: 0.45, color: '#9A9A9A', cap: 2 });
  for (let i = 0; i < 9; i++) for (let j = 0; j < 9; j++) {
    const v = givens[i * 9 + j];
    const s = v || (solution ? solution[i * 9 + j] : 0);
    if (!s) continue;
    r.text(String(s), gx + j * cell + cell / 2, gTop - i * cell - cell * 0.7, { size, color: v ? INK : '#A8A8A8', align: 'center', bold: !!(v && solution) });
  }
}

// ---------------------------------------------------------------- answer keys
export function drawKeyPage(r, W, H, verso, desc) {
  const b = contentBox(W, H, verso);
  const top = b.y + b.h;
  r.text(desc.kind === 'wskey' ? 'WORD SEARCH ANSWERS' : 'SUDOKU SOLUTIONS', b.x, top - 4.2, { size: 6.5, color: INK, bold: true });
  const slotW = (b.w - 4) / 2;
  const slotH = (b.h - 9) / 2;
  desc.items.forEach((p, k) => {
    const c = k % 2, row = Math.floor(k / 2);
    const sx = b.x + c * (slotW + 4);
    const sTop = top - 9 - row * slotH;
    r.text(`#${p.number}${p.theme ? '  ' + p.theme : ''}${p.level ? '  ' + p.level : ''}`, sx, sTop - 2.5, { size: 5.5, color: LABEL, bold: true });
    if (desc.kind === 'wskey') {
      const n = p.grid.length;
      const cell = Math.min(slotW / n, (slotH - 6) / n);
      const gTop = sTop - 4.5;
      for (const [i, j] of p.cells) r.rect(sx + j * cell, gTop - (i + 1) * cell, cell, cell, { stroke: null, fill: '#E4E4E4' });
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
        const on = p.cellSet.has(i * n + j);
        r.text(p.grid[i][j], sx + j * cell + cell / 2, gTop - i * cell - cell * 0.75, { size: 4.6, color: on ? '#333333' : '#B8B8B8', align: 'center', bold: on });
      }
    } else {
      const cell = Math.min(slotW / 9, (slotH - 6) / 9);
      drawSudokuGrid(r, sx, sTop - 4.5, cell, p.puzzle, p.solution, 5);
    }
  });
}

// ---------------------------------------------------------------- dispatcher
export function drawPageNumber(r, W, verso, n) {
  if (verso) r.text(String(n), 2, 1.8, { size: 4, color: PAGE_NUM });
  else r.text(String(n), W - 2, 1.8, { size: 4, color: PAGE_NUM, align: 'right' });
}

export function drawPage(r, desc, ctx) {
  const { W, H, pageNum, total, pageNumbers } = ctx;
  const verso = pageNum % 2 === 0;
  switch (desc.kind) {
    case 'dot': drawDotGrid(r, W, H, verso, desc.opts.spacing || DEFAULT_DOT_STEP); break;
    case 'lined': drawLined(r, W, H, verso, desc.opts.spacing || 6); break;
    case 'blank': break;
    case 'weekly': drawWeekly(r, W, H, verso, desc); break;
    case 'monthly': drawMonthly(r, W, H, verso, desc); break;
    case 'comic': drawComic(r, W, H, verso, desc); break;
    case 'wordsearch': drawWordSearch(r, W, H, verso, desc); break;
    case 'sudoku': drawSudoku(r, W, H, verso, desc); break;
    case 'wskey': case 'sdkey': drawKeyPage(r, W, H, verso, desc); break;
    default: break;
  }
  if (pageNumbers && pageNum !== 1 && pageNum !== total) drawPageNumber(r, W, verso, pageNum);
}
