// Turns the block list into an ordered list of finished pages.
import { makeWordSearch, makeSudoku } from './puzzles.js';

export const PAGE_SIZES = {
  passport: { label: "Traveler's Company passport (89 × 124 mm)", W: 89, H: 124 },
  custom: { label: 'Custom size', W: null, H: null },
};
export const PAPERS = {
  letter: { label: 'US Letter (8.5 × 11 in)', W: 215.9, H: 279.4, name: 'US Letter' },
  a4: { label: 'A4 (210 × 297 mm)', W: 210, H: 297, name: 'A4' },
};

function today() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }

export const BLOCK_TYPES = {
  dot: { label: 'Dot grid', unit: 'pages', per: 1, opts: () => ({ spacing: 3 }) },
  lined: { label: 'Lined', unit: 'pages', per: 1, opts: () => ({ spacing: 6 }) },
  blank: { label: 'Blank', unit: 'pages', per: 1, opts: () => ({}) },
  weekly: { label: 'Weekly spread', unit: 'weeks', per: 2, spread: true, opts: () => ({ dated: false, start: today(), weekStart: 'mon' }) },
  monthly: { label: 'Monthly spread', unit: 'months', per: 2, spread: true, opts: () => ({ dated: false, month: today().slice(0, 7), weekStart: 'mon' }) },
  comic: { label: 'Comic panels', unit: 'pages', per: 1, opts: () => ({ surprise: true, startLayout: 1 }) },
  wordsearch: { label: 'Word search', unit: 'puzzles', per: 1, opts: () => ({ theme: 'Travel', seed: newSeed() }) },
  sudoku: { label: 'Sudoku', unit: 'puzzles', per: 1, opts: () => ({ level: 'Medium', seed: newSeed() }) },
};

export function newSeed() { return Math.floor(Math.random() * 1e9); }

let uid = 1;
export function newBlock(type, count) {
  const t = BLOCK_TYPES[type];
  return { id: `b${Date.now().toString(36)}${uid++}`, type, count: count ?? (t.per === 2 ? 1 : 4), opts: t.opts() };
}

const cache = new Map();
function cached(key, fn) {
  if (!cache.has(key)) { if (cache.size > 400) cache.clear(); cache.set(key, fn()); }
  return cache.get(key);
}

export function pageSize(state) {
  if (state.size === 'custom') return { W: +state.customW || 89, H: +state.customH || 124 };
  return { W: PAGE_SIZES.passport.W, H: PAGE_SIZES.passport.H };
}

// Spreads must fit two-up on the paper with room for crop marks and labels.
export function sizeProblem(state) {
  const { W, H } = pageSize(state);
  const p = PAPERS[state.paper];
  if (!(W >= 40 && H >= 60)) return 'Page size must be at least 40 × 60 mm.';
  if (2 * W > p.W - 24) return `Pages wider than ${((p.W - 24) / 2).toFixed(1)} mm do not fit two-up on ${p.name}.`;
  if (2 * H > p.H - 24) return `Pages taller than ${((p.H - 24) / 2).toFixed(1)} mm do not fit two spreads on ${p.name}.`;
  return null;
}

export function buildPlan(state) {
  const N = state.total;
  const body = [];
  const ws = [], sd = [];
  let pads = 0;
  for (const b of state.blocks) {
    const t = BLOCK_TYPES[b.type];
    if (!t) continue;
    const count = Math.max(0, Math.min(64, b.count | 0));
    if (t.spread && count > 0 && (body.length + 1) % 2 === 1) {
      // next page would be a right-hand page; pad so the spread faces
      body.push({ kind: 'dot', pad: true, block: b.id, opts: {} });
      pads++;
    }
    for (let u = 0; u < count; u++) {
      if (t.per === 2) {
        body.push({ kind: b.type, side: 'L', unit: u, block: b.id, opts: b.opts });
        body.push({ kind: b.type, side: 'R', unit: u, block: b.id, opts: b.opts });
      } else if (b.type === 'wordsearch') {
        const p = cached(`ws:${b.opts.seed}:${b.opts.theme}:${u}`, () => makeWordSearch(b.opts.seed + u * 7919, b.opts.theme));
        const puzzle = { ...p, number: ws.length + 1 };
        ws.push(puzzle);
        body.push({ kind: 'wordsearch', unit: u, block: b.id, opts: b.opts, puzzle });
      } else if (b.type === 'sudoku') {
        const p = cached(`sd:${b.opts.seed}:${b.opts.level}:${u}`, () => makeSudoku(b.opts.seed + u * 104729, b.opts.level));
        const puzzle = { ...p, number: sd.length + 1 };
        sd.push(puzzle);
        body.push({ kind: 'sudoku', unit: u, block: b.id, opts: b.opts, puzzle });
      } else {
        body.push({ kind: b.type, unit: u, block: b.id, opts: b.opts });
      }
    }
  }
  const keys = [];
  for (let i = 0; i < ws.length; i += 4) keys.push({ kind: 'wskey', items: ws.slice(i, i + 4), opts: {} });
  for (let i = 0; i < sd.length; i += 4) keys.push({ kind: 'sdkey', items: sd.slice(i, i + 4), opts: {} });
  const fill = N - body.length - keys.length;
  const pages = body.slice();
  for (let i = 0; i < fill; i++) pages.push({ kind: 'dot', fill: true, opts: {} });
  pages.push(...keys);
  return {
    N, pages,
    used: body.length - pads, pads, keys: keys.length,
    fill: Math.max(0, fill), overflow: Math.max(0, -fill),
  };
}
