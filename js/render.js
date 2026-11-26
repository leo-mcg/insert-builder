// Two renderers with the same drawing API, in millimetres, origin at the
// lower-left of the current frame (PDF convention).
//   PdfRenderer    -> vector output into a pdf-lib page
//   CanvasRenderer -> on-screen thumbnails
// Content code only talks to this API, so the preview and the PDF match.

export const MM = 72 / 25.4; // points per millimetre

export function hexToRgb01(hex) {
  const h = hex.replace('#', '');
  const f = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  return [0, 2, 4].map((i) => parseInt(f.slice(i, i + 2), 16) / 255);
}

const KAPPA = 0.5522847498;

export class PdfRenderer {
  constructor(page, fonts) {
    this.page = page;
    this.fonts = fonts; // {regular, bold}
    this.ox = 0;
    this.oy = 0;
    const L = window.PDFLib;
    this.L = L;
  }
  setOrigin(ox, oy) { this.ox = ox; this.oy = oy; }
  _x(x) { return (this.ox + x) * MM; }
  _y(y) { return (this.oy + y) * MM; }
  _ops(...ops) { this.page.pushOperators(...ops); }
  _stroke(color, w, cap = 0) {
    const L = this.L;
    const [r, g, b] = hexToRgb01(color);
    return [L.setStrokingRgbColor(r, g, b), L.setLineWidth(w * MM), L.setLineCap(cap), L.setLineJoin(0)];
  }
  _fill(color) {
    const [r, g, b] = hexToRgb01(color);
    return [this.L.setFillingRgbColor(r, g, b)];
  }
  line(x1, y1, x2, y2, { w = 0.28, color = '#C8C8C8', cap = 0 } = {}) {
    const L = this.L;
    this._ops(L.pushGraphicsState(), ...this._stroke(color, w, cap),
      L.moveTo(this._x(x1), this._y(y1)), L.lineTo(this._x(x2), this._y(y2)), L.stroke(), L.popGraphicsState());
  }
  lines(segs, opts = {}) {
    // segs: [[x1,y1,x2,y2], ...] in one path
    const L = this.L;
    const { w = 0.28, color = '#C8C8C8', cap = 0 } = opts;
    const ops = [L.pushGraphicsState(), ...this._stroke(color, w, cap)];
    for (const [x1, y1, x2, y2] of segs) ops.push(L.moveTo(this._x(x1), this._y(y1)), L.lineTo(this._x(x2), this._y(y2)));
    ops.push(L.stroke(), L.popGraphicsState());
    this._ops(...ops);
  }
  poly(pts, { stroke = '#C8C8C8', fill = null, w = 0.28, closed = true } = {}) {
    const L = this.L;
    const ops = [L.pushGraphicsState()];
    if (stroke) ops.push(...this._stroke(stroke, w));
    if (fill) ops.push(...this._fill(fill));
    ops.push(L.moveTo(this._x(pts[0][0]), this._y(pts[0][1])));
    for (const p of pts.slice(1)) ops.push(L.lineTo(this._x(p[0]), this._y(p[1])));
    if (closed) ops.push(L.closePath());
    if (stroke && fill) ops.push(L.fillAndStroke());
    else if (fill) ops.push(L.fill());
    else ops.push(L.stroke());
    ops.push(L.popGraphicsState());
    this._ops(...ops);
  }
  rect(x, y, w, h, opts = {}) {
    this.poly([[x, y], [x + w, y], [x + w, y + h], [x, y + h]], opts);
  }
  // Round dots (the only round marks allowed): d = diameter in mm.
  dots(points, d = 0.3, color = '#999999') {
    const L = this.L;
    const r = (d / 2) * MM;
    const k = r * KAPPA;
    const ops = [L.pushGraphicsState(), ...this._fill(color)];
    for (const [px, py] of points) {
      const cx = this._x(px), cy = this._y(py);
      ops.push(
        L.moveTo(cx + r, cy),
        L.appendBezierCurve(cx + r, cy + k, cx + k, cy + r, cx, cy + r),
        L.appendBezierCurve(cx - k, cy + r, cx - r, cy + k, cx - r, cy),
        L.appendBezierCurve(cx - r, cy - k, cx - k, cy - r, cx, cy - r),
        L.appendBezierCurve(cx + k, cy - r, cx + r, cy - k, cx + r, cy),
        L.closePath(),
      );
    }
    ops.push(L.fill(), L.popGraphicsState());
    this._ops(...ops);
  }
  textWidth(str, size, bold = false) {
    const f = bold ? this.fonts.bold : this.fonts.regular;
    return f.widthOfTextAtSize(str, size) / MM; // mm
  }
  // size in points; x,y in mm (baseline)
  text(str, x, y, { size = 6, color = '#999999', align = 'left', rotate = 0, bold = false } = {}) {
    const L = this.L;
    const f = bold ? this.fonts.bold : this.fonts.regular;
    const wmm = this.textWidth(str, size, bold);
    const shift = align === 'center' ? wmm / 2 : align === 'right' ? wmm : 0;
    const rad = (rotate * Math.PI) / 180;
    const tx = x - shift * Math.cos(rad);
    const ty = y - shift * Math.sin(rad);
    const [r, g, b] = hexToRgb01(color);
    this.page.drawText(str, { x: this._x(tx), y: this._y(ty), size, font: f, color: L.rgb(r, g, b), rotate: L.degrees(rotate) });
  }
  clipStart(x, y, w, h) {
    const L = this.L;
    this._ops(L.pushGraphicsState(), L.rectangle(this._x(x), this._y(y), w * MM, h * MM), L.clip(), L.endPath());
  }
  clipEnd() { this._ops(this.L.popGraphicsState()); }
}

// Canvas renderer for thumbnails. `scale` = pixels per mm. Height in mm is
// needed to flip the y axis. `boost` darkens light guides so they read on screen.
export class CanvasRenderer {
  constructor(ctx, scale, heightMm, { boost = true } = {}) {
    this.ctx = ctx;
    this.s = scale;
    this.h = heightMm;
    this.ox = 0;
    this.oy = 0;
    this.boost = boost;
  }
  setOrigin(ox, oy) { this.ox = ox; this.oy = oy; }
  _x(x) { return (this.ox + x) * this.s; }
  _y(y) { return (this.h - (this.oy + y)) * this.s; }
  _c(color) {
    if (!this.boost) return color;
    const [r, g, b] = hexToRgb01(color).map((v) => v * 255);
    const f = (v) => (v >= 160 ? Math.round(70 + (v - 160) * 0.9) : v);
    return `rgb(${f(r)},${f(g)},${f(b)})`;
  }
  _lw(w) { return Math.max(w * this.s, 0.6); }
  line(x1, y1, x2, y2, opts = {}) { this.lines([[x1, y1, x2, y2]], opts); }
  lines(segs, { w = 0.28, color = '#C8C8C8', cap = 0 } = {}) {
    const c = this.ctx;
    c.save();
    c.strokeStyle = this._c(color);
    c.lineWidth = this._lw(w);
    c.lineCap = cap === 1 ? 'round' : 'butt';
    c.beginPath();
    for (const [x1, y1, x2, y2] of segs) { c.moveTo(this._x(x1), this._y(y1)); c.lineTo(this._x(x2), this._y(y2)); }
    c.stroke();
    c.restore();
  }
  poly(pts, { stroke = '#C8C8C8', fill = null, w = 0.28, closed = true } = {}) {
    const c = this.ctx;
    c.save();
    c.beginPath();
    c.moveTo(this._x(pts[0][0]), this._y(pts[0][1]));
    for (const p of pts.slice(1)) c.lineTo(this._x(p[0]), this._y(p[1]));
    if (closed) c.closePath();
    if (fill) { c.fillStyle = fill === '#FFFFFF' ? '#fff' : this._c(fill); c.fill(); }
    if (stroke) { c.strokeStyle = this._c(stroke); c.lineWidth = this._lw(w); c.lineJoin = 'miter'; c.stroke(); }
    c.restore();
  }
  rect(x, y, w, h, opts = {}) { this.poly([[x, y], [x + w, y], [x + w, y + h], [x, y + h]], opts); }
  dots(points, d = 0.3, color = '#999999') {
    const c = this.ctx;
    c.save();
    c.fillStyle = this._c(color);
    const r = Math.max((d / 2) * this.s, 0.55);
    for (const [px, py] of points) c.fillRect(this._x(px) - r, this._y(py) - r, 2 * r, 2 * r);
    c.restore();
  }
  _font(size, bold) { return `${bold ? 'bold ' : ''}${(size / MM) * this.s}px Helvetica, Arial, sans-serif`; }
  textWidth(str, size, bold = false) {
    this.ctx.font = this._font(size, bold);
    return this.ctx.measureText(str).width / this.s;
  }
  text(str, x, y, { size = 6, color = '#999999', align = 'left', rotate = 0, bold = false } = {}) {
    const c = this.ctx;
    c.save();
    c.font = this._font(size, bold);
    c.fillStyle = this._c(color);
    c.textAlign = align;
    c.textBaseline = 'alphabetic';
    c.translate(this._x(x), this._y(y));
    if (rotate) c.rotate((-rotate * Math.PI) / 180);
    c.fillText(str, 0, 0);
    c.restore();
  }
  clipStart(x, y, w, h) {
    const c = this.ctx;
    c.save();
    c.beginPath();
    c.rect(this._x(x), this._y(y + h), w * this.s, h * this.s);
    c.clip();
  }
  clipEnd() { this.ctx.restore(); }
}
