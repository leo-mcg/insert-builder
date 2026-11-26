// PDF output: saddle-stitch imposition (port of build_insert.py) and a flat
// reading-order file. Everything is vector, drawn with pdf-lib.
import { PdfRenderer, MM } from './render.js';
import { drawPage } from './content.js';
import { PAPERS, pageSize } from './plan.js';

const CROP_LEN = 5, CROP_GAP = 2, CROP_W = 0.25 / MM; // 0.25 pt
const MARK = '#222222', LABEL = '#666666';

// Page numbers on booklet sheet k (1 = outermost), as in build_insert.booklet_pages
export function bookletPages(k, n) {
  return { frontLeft: n + 2 - 2 * k, frontRight: 2 * k - 1, backLeft: 2 * k, backRight: n + 1 - 2 * k };
}

// Full sheet map, for checking: [{sheet, front:{top:[l,r], bottom:[l,r]}, back:{...}}]
export function impositionTable(n) {
  const nPaper = n / 8;
  const rows = [];
  for (let i = 1; i <= nPaper; i++) {
    const t = bookletPages(i, n), b = bookletPages(i + nPaper, n);
    rows.push({
      sheet: i,
      front: { top: [t.frontLeft, t.frontRight], bottom: [b.frontLeft, b.frontRight] },
      back: { top: [t.backLeft, t.backRight], bottom: [b.backLeft, b.backRight] },
    });
  }
  return rows;
}

async function newDoc(title) {
  const L = window.PDFLib;
  const doc = await L.PDFDocument.create();
  doc.setTitle(title);
  doc.setAuthor('Insert Builder');
  doc.setCreator('Insert Builder (leo-mcg.github.io/insert-builder)');
  doc.setProducer('pdf-lib');
  const fonts = {
    regular: await doc.embedFont(L.StandardFonts.Helvetica),
    bold: await doc.embedFont(L.StandardFonts.HelveticaBold),
  };
  return { doc, fonts };
}

function drawSlot(r, x, y, W, H, n, plan, state) {
  r.setOrigin(0, 0);
  r.clipStart(x, y, W, H);
  r.setOrigin(x, y);
  drawPage(r, plan.pages[n - 1], { W, H, pageNum: n, total: plan.N, pageNumbers: state.pageNumbers });
  r.setOrigin(0, 0);
  r.clipEnd();
}

function cropMarks(r, x, y, SW, SH, PW, topFree, bottomFree) {
  const g = CROP_GAP, L = CROP_LEN, h = SH, w = SW, fx = x + PW;
  const s = [];
  if (topFree) {
    s.push([x, y + h + g, x, y + h + g + L], [x + w, y + h + g, x + w, y + h + g + L], [fx, y + h + g, fx, y + h + g + L]);
  }
  if (bottomFree) {
    s.push([x, y - g, x, y - g - L], [x + w, y - g, x + w, y - g - L], [fx, y - g - L, fx, y - g]);
  }
  s.push([x - g - L, y, x - g, y], [x + w + g, y, x + w + g + L, y], [x - g - L, y + h, x - g, y + h], [x + w + g, y + h, x + w + g + L, y + h]);
  r.lines(s, { w: CROP_W, color: MARK, cap: 1 });
}

function ruler(r, x, y) {
  // 50 mm scale check with 5 mm ticks; ticks hang down from the baseline.
  const segs = [[x, y, x + 50, y]];
  for (let i = 0; i <= 10; i++) {
    const len = i === 0 || i === 10 ? 2 : i % 2 === 0 ? 1.5 : 0.9;
    segs.push([x + i * 5, y, x + i * 5, y - len]);
  }
  r.lines(segs, { w: CROP_W * 1.2, color: MARK, cap: 0 });
  r.text('0', x, y + 0.9, { size: 4.5, color: LABEL, align: 'center' });
  r.text('50 mm', x + 50, y + 0.9, { size: 4.5, color: LABEL, align: 'center' });
  r.text('Scale check: this bar must measure exactly 50 mm. If not, print at 100% / Actual size.', x + 54, y - 1.4, { size: 5, color: LABEL });
}

export async function buildImposedPdf(state, plan) {
  const { W, H } = pageSize(state);
  const paper = PAPERS[state.paper];
  const N = plan.N;
  const nBooklet = N / 4, nPaper = nBooklet / 2;
  const { doc, fonts } = await newDoc(`Notebook insert - ${N} pages - ${W} x ${H} mm - ${paper.name}`);
  doc.setSubject(`Saddle-stitched ${N}-page insert, ${W} x ${H} mm, imposed 2-up on ${paper.name}, duplex flip on long edge, print at 100%.`);
  const SW = 2 * W, SH = H;
  const x = (paper.W - SW) / 2;
  const yBot = (paper.H - 2 * SH) / 2;
  const yTop = yBot + SH;
  for (let i = 1; i <= nPaper; i++) {
    const topK = i, botK = i + nPaper;
    for (const face of ['front', 'back']) {
      const page = doc.addPage([paper.W * MM, paper.H * MM]);
      const r = new PdfRenderer(page, fonts);
      for (const [y, k] of [[yTop, topK], [yBot, botK]]) {
        const p = bookletPages(k, N);
        const [left, right] = face === 'front' ? [p.frontLeft, p.frontRight] : [p.backLeft, p.backRight];
        drawSlot(r, x, y, W, H, left, plan, state);
        drawSlot(r, x + W, y, W, H, right, plan, state);
      }
      cropMarks(r, x, yTop, SW, SH, W, true, false);
      cropMarks(r, x, yBot, SW, SH, W, false, true);
      // labels in the waste margin
      const lab = (k) => {
        const p = bookletPages(k, N);
        const pp = face === 'front' ? `${p.frontLeft} | ${p.frontRight}` : `${p.backLeft} | ${p.backRight}`;
        return `Booklet sheet ${k} of ${nBooklet}   -   pp. ${pp}`;
      };
      r.text(lab(topK), x - 9.5, yTop + SH / 2, { size: 6, color: LABEL, align: 'center', rotate: 90 });
      r.text(lab(botK), x - 9.5, yBot + SH / 2, { size: 6, color: LABEL, align: 'center', rotate: 90 });
      r.text('fold', x + W + 1.2, yTop + SH + 4.6, { size: 5.5, color: LABEL });
      r.text('fold', x + W + 1.2, yBot - 6.4, { size: 5.5, color: LABEL });
      r.text('cut', x + SW + 9.2, yTop, { size: 5.5, color: LABEL, align: 'center', rotate: -90 });
      r.text(`${N} pages  -  ${W} x ${H} mm  -  ${paper.name} sheet ${i} of ${nPaper} (${face})  -  Print at 100% / Actual size  -  Duplex: flip on long edge`,
        paper.W / 2, 7, { size: 6.5, color: LABEL, align: 'center' });
      ruler(r, x + 11, Math.min(paper.H - 6, yTop + SH + 12));
    }
  }
  return doc.save();
}

export async function buildFlatPdf(state, plan) {
  const { W, H } = pageSize(state);
  const { doc, fonts } = await newDoc(`Notebook insert - ${plan.N} pages - reading order`);
  for (let n = 1; n <= plan.N; n++) {
    const page = doc.addPage([W * MM, H * MM]);
    const r = new PdfRenderer(page, fonts);
    drawSlot(r, 0, 0, W, H, n, plan, state);
  }
  return doc.save();
}
