// Seeded generators for word searches and sudoku. Same seed -> same puzzle,
// so the on-screen preview and the PDF always match.

export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function shuffle(arr, rand) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

// Built-in word lists (written for this project, free to reuse). Max 10 letters.
export const WORD_LISTS = {
  Travel: ['PASSPORT', 'TICKET', 'LUGGAGE', 'JOURNEY', 'COMPASS', 'MAP', 'TRAIN', 'FERRY', 'HOSTEL', 'BORDER', 'POSTCARD', 'SUITCASE', 'AIRPORT', 'VOYAGE', 'ROUTE', 'CAMERA', 'SOUVENIR', 'STATION', 'ITINERARY', 'TERMINAL', 'BACKPACK', 'HARBOUR', 'DETOUR', 'GUIDEBOOK'],
  Stationery: ['NOTEBOOK', 'PENCIL', 'ERASER', 'STAPLE', 'FOUNTAIN', 'INK', 'PAPER', 'RULER', 'STAMP', 'JOURNAL', 'MARKER', 'BINDER', 'ENVELOPE', 'SKETCH', 'GRID', 'CLIP', 'SHARPENER', 'NIB', 'DIARY', 'LEDGER', 'FOLIO', 'WASHI', 'BOOKMARK', 'GLUE'],
  Nature: ['FOREST', 'RIVER', 'MEADOW', 'CANYON', 'GLACIER', 'PRAIRIE', 'LAKE', 'CEDAR', 'ASPEN', 'MOSS', 'FERN', 'BOULDER', 'SUMMIT', 'VALLEY', 'CREEK', 'WILLOW', 'TUNDRA', 'MARSH', 'SPRUCE', 'THUNDER', 'AURORA', 'PEBBLE', 'CLOVER', 'BREEZE'],
  Kitchen: ['SPATULA', 'WHISK', 'SKILLET', 'LADLE', 'COLANDER', 'KETTLE', 'TOASTER', 'BLENDER', 'OVEN', 'GRATER', 'TONGS', 'APRON', 'TEAPOT', 'SAUCEPAN', 'ROLLINGPIN', 'MUFFIN', 'BISCUIT', 'NOODLE', 'PANTRY', 'SPOON', 'CUTLERY', 'MORTAR', 'PESTLE', 'TIMER'],
  Animals: ['MOOSE', 'BEAVER', 'OTTER', 'FALCON', 'BISON', 'LYNX', 'MARMOT', 'HERON', 'BADGER', 'COYOTE', 'MAGPIE', 'WOLVERINE', 'CARIBOU', 'PUFFIN', 'WALRUS', 'RACCOON', 'SQUIRREL', 'OSPREY', 'CHIPMUNK', 'PELICAN', 'GROUSE', 'ELK', 'LOON', 'HARE'],
  Space: ['GALAXY', 'NEBULA', 'COMET', 'PLANET', 'ORBIT', 'ROCKET', 'METEOR', 'SATURN', 'JUPITER', 'MERCURY', 'ECLIPSE', 'ASTEROID', 'QUASAR', 'PULSAR', 'LUNAR', 'SOLAR', 'GRAVITY', 'COSMOS', 'STARDUST', 'TELESCOPE', 'MARS', 'VENUS', 'CRATER', 'ZENITH'],
};

const DIRS = [[0, 1], [1, 0], [1, 1], [-1, 1], [0, -1], [-1, 0], [-1, -1], [1, -1]];
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

export function makeWordSearch(seed, theme, n = 12, count = 12) {
  const rand = rng(seed);
  const pool = WORD_LISTS[theme] || WORD_LISTS.Travel;
  const chosen = shuffle(pool, rand).filter((w) => w.length <= n).slice(0, count).sort((a, b) => b.length - a.length);
  const grid = Array.from({ length: n }, () => Array(n).fill(''));
  const placed = [];
  const cells = [];
  for (const word of chosen) {
    let ok = false;
    for (let t = 0; t < 400 && !ok; t++) {
      const [di, dj] = DIRS[Math.floor(rand() * DIRS.length)];
      const i0 = Math.floor(rand() * n), j0 = Math.floor(rand() * n);
      const iE = i0 + di * (word.length - 1), jE = j0 + dj * (word.length - 1);
      if (iE < 0 || iE >= n || jE < 0 || jE >= n) continue;
      let fits = true;
      for (let k = 0; k < word.length; k++) {
        const c = grid[i0 + di * k][j0 + dj * k];
        if (c && c !== word[k]) { fits = false; break; }
      }
      if (!fits) continue;
      for (let k = 0; k < word.length; k++) {
        grid[i0 + di * k][j0 + dj * k] = word[k];
        cells.push([i0 + di * k, j0 + dj * k]);
      }
      ok = true;
    }
    if (ok) placed.push(word);
  }
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) if (!grid[i][j]) grid[i][j] = LETTERS[Math.floor(rand() * 26)];
  const cellSet = new Set(cells.map(([i, j]) => i * n + j));
  return { theme, grid, words: placed.sort(), cells, cellSet };
}

// ---------------------------------------------------------------- sudoku
function candidates(g, idx) {
  const r = Math.floor(idx / 9), c = idx % 9;
  const used = new Set();
  for (let k = 0; k < 9; k++) { used.add(g[r * 9 + k]); used.add(g[k * 9 + c]); }
  const br = r - (r % 3), bc = c - (c % 3);
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) used.add(g[(br + i) * 9 + bc + j]);
  const out = [];
  for (let v = 1; v <= 9; v++) if (!used.has(v)) out.push(v);
  return out;
}
function fill(g, rand) {
  const idx = g.indexOf(0);
  if (idx < 0) return true;
  for (const v of shuffle(candidates(g, idx), rand)) {
    g[idx] = v;
    if (fill(g, rand)) return true;
  }
  g[idx] = 0;
  return false;
}
function countSolutions(g, limit = 2) {
  let best = -1, bestC = null;
  for (let i = 0; i < 81; i++) {
    if (g[i]) continue;
    const c = candidates(g, i);
    if (c.length === 0) return 0;
    if (!bestC || c.length < bestC.length) { best = i; bestC = c; if (c.length === 1) break; }
  }
  if (best < 0) return 1;
  let total = 0;
  for (const v of bestC) {
    g[best] = v;
    total += countSolutions(g, limit - total);
    if (total >= limit) break;
  }
  g[best] = 0;
  return total;
}
const CLUES = { Easy: 38, Medium: 32, Hard: 27 };
export function makeSudoku(seed, level = 'Medium') {
  const rand = rng(seed);
  const sol = Array(81).fill(0);
  fill(sol, rand);
  const puz = sol.slice();
  let clues = 81;
  const target = CLUES[level] || 32;
  for (const i of shuffle([...Array(81).keys()], rand)) {
    if (clues <= target) break;
    const v = puz[i];
    puz[i] = 0;
    if (countSolutions(puz.slice()) !== 1) puz[i] = v; else clues--;
  }
  return { level, puzzle: puz, solution: sol };
}
