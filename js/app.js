import { BLOCK_TYPES, PAGE_SIZES, PAPERS, newBlock, newSeed, buildPlan, pageSize, sizeProblem } from './plan.js';
import { WORD_LISTS } from './puzzles.js';
import { CanvasRenderer } from './render.js';
import { drawPage, COMIC_LAYOUTS } from './content.js';
import { buildImposedPdf, buildFlatPdf } from './impose.js';

const STORE = 'insert-builder-v1';
const $ = (s) => document.querySelector(s);

function defaults() {
  return {
    size: 'passport', customW: 89, customH: 124, paper: 'letter', total: 32, pageNumbers: true,
    blocks: [
      newBlock('blank', 1),
      newBlock('monthly', 1),
      newBlock('weekly', 4),
      newBlock('dot', 4),
      newBlock('comic', 6),
      newBlock('lined', 4),
      newBlock('wordsearch', 2),
      newBlock('sudoku', 2),
    ],
  };
}

function load() {
  try {
    const s = JSON.parse(localStorage.getItem(STORE));
    if (s && Array.isArray(s.blocks)) {
      s.blocks = s.blocks.filter((b) => BLOCK_TYPES[b.type]).map((b) => ({ ...b, opts: { ...BLOCK_TYPES[b.type].opts(), ...b.opts } }));
      return { ...defaults(), ...s, total: s.total === 64 ? 64 : 32 };
    }
  } catch (e) { /* ignore */ }
  return defaults();
}
let state = load();
function save() { try { localStorage.setItem(STORE, JSON.stringify(state)); } catch (e) { /* private mode */ } }

// ------------------------------------------------------------ settings
function initSettings() {
  const size = $('#size');
  for (const [k, v] of Object.entries(PAGE_SIZES)) size.add(new Option(v.label, k));
  const paper = $('#paper');
  for (const [k, v] of Object.entries(PAPERS)) paper.add(new Option(v.label, k));
  size.value = state.size; paper.value = state.paper;
  $('#customW').value = state.customW; $('#customH').value = state.customH;
  $('#pageNumbers').checked = state.pageNumbers;
  document.querySelectorAll('input[name=total]').forEach((r) => { r.checked = +r.value === state.total; });
  size.addEventListener('change', () => { state.size = size.value; changed(); });
  paper.addEventListener('change', () => { state.paper = paper.value; changed(); });
  $('#customW').addEventListener('input', (e) => { state.customW = +e.target.value; changed(); });
  $('#customH').addEventListener('input', (e) => { state.customH = +e.target.value; changed(); });
  $('#pageNumbers').addEventListener('change', (e) => { state.pageNumbers = e.target.checked; changed(); });
  document.querySelectorAll('input[name=total]').forEach((r) => r.addEventListener('change', () => { state.total = +r.value; changed(); }));
  const add = $('#add-buttons');
  for (const [k, t] of Object.entries(BLOCK_TYPES)) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'btn'; b.textContent = `+ ${t.label}`;
    b.addEventListener('click', () => {
      state.blocks.push(newBlock(k));
      renderBlocks();
      changed();
      const last = $('#blocks').lastElementChild;
      last?.querySelector('.count input')?.focus();
    });
    add.appendChild(b);
  }
}

// ------------------------------------------------------------ blocks
function el(tag, attrs = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') e.className = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (v === true) e.setAttribute(k, '');
    else if (v !== false && v != null) e.setAttribute(k, v);
  }
  for (const c of kids) if (c != null) e.append(c);
  return e;
}
function selectField(label, value, options, onChange) {
  const s = el('select', { onchange: (e) => onChange(e.target.value) });
  for (const [v, t] of options) s.add(new Option(t, v));
  s.value = value;
  return el('label', {}, label, s);
}
function checkField(label, checked, onChange) {
  return el('label', { class: 'check' }, el('input', { type: 'checkbox', checked, onchange: (e) => onChange(e.target.checked) }), label);
}

function optionsFor(b) {
  const o = b.opts;
  const set = (k, rerender = false) => (v) => { o[k] = v; if (rerender) renderBlocks(); changed(); };
  const wsSel = () => selectField('Week starts', o.weekStart, [['mon', 'Monday'], ['sun', 'Sunday']], set('weekStart'));
  switch (b.type) {
    case 'lined':
      return [selectField('Line spacing', String(o.spacing), [['5', '5 mm'], ['6', '6 mm'], ['7', '7 mm']], (v) => { o.spacing = +v; changed(); })];
    case 'weekly': {
      const f = [checkField('Dated', o.dated, set('dated', true)), wsSel()];
      if (o.dated) f.push(el('label', {}, 'First week containing', el('input', { type: 'date', value: o.start, onchange: (e) => { o.start = e.target.value; changed(); } })));
      return f;
    }
    case 'monthly': {
      const f = [checkField('Dated', o.dated, set('dated', true)), wsSel()];
      if (o.dated) f.push(el('label', {}, 'First month', el('input', { type: 'month', value: o.month, onchange: (e) => { o.month = e.target.value; changed(); } })));
      return f;
    }
    case 'comic':
      return [
        checkField('Surprise layouts', o.surprise !== false, set('surprise')),
        selectField('Start with layout', String(o.startLayout || 1), COMIC_LAYOUTS.map((l, i) => [String(i + 1), `${i + 1}. ${l[1]} (${l[0]})`]), (v) => { o.startLayout = +v; changed(); }),
      ];
    case 'wordsearch':
      return [
        selectField('Word list', o.theme, Object.keys(WORD_LISTS).map((k) => [k, k]), set('theme')),
        el('button', { type: 'button', class: 'btn', onclick: () => { o.seed = newSeed(); changed(); } }, 'New puzzles'),
      ];
    case 'sudoku':
      return [
        selectField('Difficulty', o.level, [['Easy', 'Easy'], ['Medium', 'Medium'], ['Hard', 'Hard']], set('level')),
        el('button', { type: 'button', class: 'btn', onclick: () => { o.seed = newSeed(); changed(); } }, 'New puzzles'),
      ];
    default:
      return [];
  }
}

function subtitle(b) {
  const t = BLOCK_TYPES[b.type];
  const pages = b.count * t.per;
  const extra = b.type === 'wordsearch' || b.type === 'sudoku' ? ' + answers at back' : '';
  return `${pages} page${pages === 1 ? '' : 's'}${t.per === 2 ? ' (two-page spreads)' : ''}${extra}`;
}

function renderBlocks() {
  const list = $('#blocks');
  list.textContent = '';
  state.blocks.forEach((b, i) => {
    const t = BLOCK_TYPES[b.type];
    const sub = el('small', { 'data-sub': '' }, subtitle(b));
    const countInput = el('input', {
      type: 'number', min: 1, max: t.per === 2 ? 16 : 64, value: b.count, inputmode: 'numeric',
      'aria-label': `${t.label}: number of ${t.unit}`,
      oninput: (e) => { b.count = Math.max(0, Math.min(64, parseInt(e.target.value, 10) || 0)); sub.textContent = subtitle(b); changed(); },
    });
    const move = (d) => {
      const j = i + d;
      [state.blocks[i], state.blocks[j]] = [state.blocks[j], state.blocks[i]];
      renderBlocks(); changed();
      $('#blocks').children[j]?.querySelector(d < 0 ? '[data-up]' : '[data-down]')?.focus();
    };
    const li = el('li', { class: 'block' },
      el('div', { class: 'block-head' },
        el('div', { class: 'block-title' }, `${i + 1}. ${t.label}`, sub),
        el('label', { class: 'count' }, countInput, t.unit),
        el('div', { class: 'icon-btns' },
          el('button', { type: 'button', class: 'icon', 'data-up': '', 'aria-label': `Move ${t.label} up`, disabled: i === 0, onclick: () => move(-1) }, '↑'),
          el('button', { type: 'button', class: 'icon', 'data-down': '', 'aria-label': `Move ${t.label} down`, disabled: i === state.blocks.length - 1, onclick: () => move(1) }, '↓'),
          el('button', { type: 'button', class: 'icon del', 'aria-label': `Remove ${t.label}`, onclick: () => { state.blocks.splice(i, 1); renderBlocks(); changed(); } }, '✕'),
        ),
      ),
      el('div', { class: 'block-opts' }, ...optionsFor(b)),
    );
    list.appendChild(li);
  });
  if (!state.blocks.length) list.appendChild(el('li', { class: 'hint' }, 'No blocks yet. Every page will be dot grid.'));
}

// ------------------------------------------------------------ counter + preview
let plan = null;
function updateCounter() {
  plan = buildPlan(state);
  const N = plan.N;
  const shown = plan.used + plan.pads + plan.keys;
  $('#count-num').textContent = `${shown} / ${N}`;
  $('#mini-count').textContent = plan.overflow ? `${shown} / ${N} pages: over by ${plan.overflow}` : `${shown} / ${N} pages`;
  $('.mini').classList.toggle('err', !!plan.overflow);
  const pct = (v) => `${Math.min(100, (v / N) * 100)}%`;
  $('#bar-used').style.width = pct(plan.used);
  $('#bar-pad').style.width = pct(plan.pads);
  $('#bar-key').style.width = pct(plan.keys);
  $('#bar-fill').style.width = pct(plan.fill);
  const notes = [];
  const sizeErr = sizeProblem(state);
  if (plan.overflow) notes.push(['err', `Over by ${plan.overflow} page${plan.overflow === 1 ? '' : 's'}. Remove pages${N === 32 ? ' or switch to 64 pages' : ''}.`]);
  if (plan.fill) notes.push(['', `${plan.fill} leftover page${plan.fill === 1 ? '' : 's'} will be dot grid.`]);
  if (plan.pads) notes.push(['', `${plan.pads} dot-grid page${plan.pads === 1 ? '' : 's'} added so two-page spreads open flat (they start on a left page).`]);
  if (plan.keys) notes.push(['', `${plan.keys} answer-key page${plan.keys === 1 ? '' : 's'} at the back.`]);
  if (N === 64) notes.push(['warn', '64 pages is 16 folded sheets: thick for one staple. Use 2-3 staples or thread, thin (70-80 gsm) paper, or make two 32-page inserts.']);
  const ul = $('#count-notes');
  ul.textContent = '';
  for (const [c, t] of notes) ul.appendChild(el('li', { class: c }, t));
  const se = $('#size-error');
  se.hidden = !sizeErr; se.textContent = sizeErr || '';
  $('#custom-size').hidden = state.size !== 'custom';
  const bad = !!plan.overflow || !!sizeErr;
  $('#gen').disabled = bad; $('#gen-flat').disabled = bad;
  document.querySelectorAll('[data-paper-name]').forEach((n) => { n.textContent = PAPERS[state.paper].name; });
}

let thumbTimer = 0;
function scheduleThumbs() { clearTimeout(thumbTimer); thumbTimer = setTimeout(renderThumbs, 180); }
function renderThumbs() {
  const box = $('#thumbs');
  box.textContent = '';
  if (sizeProblem(state)) return;
  const { W, H } = pageSize(state);
  const N = plan.N;
  const pages = plan.pages.slice(0, N);
  const scale = 1.55; // px per mm on screen
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const groups = [[1]];
  for (let p = 2; p < N; p += 2) groups.push([p, p + 1]);
  groups.push([N]);
  for (const g of groups) {
    const cw = W * 2, ch = H;
    const cv = document.createElement('canvas');
    cv.width = Math.round(cw * scale * dpr); cv.height = Math.round(ch * scale * dpr);
    cv.style.width = `${cw * scale}px`; cv.style.height = `${ch * scale}px`;
    const ctx = cv.getContext('2d');
    ctx.fillStyle = '#e9e5dc'; ctx.fillRect(0, 0, cv.width, cv.height);
    const r = new CanvasRenderer(ctx, scale * dpr, H);
    for (const n of g) {
      const ox = n % 2 === 0 ? 0 : W;
      ctx.fillStyle = '#fff';
      ctx.fillRect(ox * scale * dpr, 0, W * scale * dpr, H * scale * dpr);
      r.setOrigin(0, 0); r.clipStart(ox, 0, W, H); r.setOrigin(ox, 0);
      drawPage(r, pages[n - 1], { W, H, pageNum: n, total: N, pageNumbers: state.pageNumbers });
      r.setOrigin(0, 0); r.clipEnd();
    }
    ctx.strokeStyle = 'rgba(0,0,0,.12)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(W * scale * dpr, 0); ctx.lineTo(W * scale * dpr, cv.height); ctx.stroke();
    const names = g.map((n) => describe(pages[n - 1]));
    cv.setAttribute('role', 'img');
    cv.setAttribute('aria-label', g.map((n, i) => `Page ${n}: ${names[i]}`).join('; '));
    const lbl = g.length === 1 ? (g[0] === 1 ? 'p. 1 (front cover)' : `p. ${g[0]} (back cover)`) : `pp. ${g[0]}-${g[1]}`;
    box.appendChild(el('div', { class: 'spread' }, cv, el('span', { class: 'lbl' }, lbl)));
  }
}
function describe(d) {
  if (!d) return '';
  if (d.fill) return 'dot grid (fill)';
  if (d.pad) return 'dot grid (spread pad)';
  if (d.kind === 'wskey') return 'word search answers';
  if (d.kind === 'sdkey') return 'sudoku solutions';
  return BLOCK_TYPES[d.kind]?.label.toLowerCase() || d.kind;
}

function changed() { save(); updateCounter(); scheduleThumbs(); }

// ------------------------------------------------------------ generate
function download(bytes, name) {
  const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
  const a = el('a', { href: url, download: name });
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
async function generate(flat) {
  const st = $('#gen-status');
  const btns = [$('#gen'), $('#gen-flat')];
  btns.forEach((b) => { b.disabled = true; });
  st.textContent = 'Building PDF...';
  try {
    plan = buildPlan(state);
    const { W, H } = pageSize(state);
    const bytes = flat ? await buildFlatPdf(state, plan) : await buildImposedPdf(state, plan);
    const name = flat ? `insert-${plan.N}p-${W}x${H}-reading-order.pdf` : `insert-${plan.N}p-${W}x${H}-${state.paper}.pdf`;
    download(bytes, name);
    st.textContent = flat
      ? `Downloaded ${name}: ${plan.N} pages in reading order (for viewing, not for printing the booklet).`
      : `Downloaded ${name}: ${plan.N / 4} PDF pages (${plan.N / 8} sheets, duplex). Print at 100%, flip on long edge.`;
  } catch (e) {
    console.error(e);
    st.textContent = `Could not build the PDF: ${e.message}`;
  } finally {
    updateCounter();
  }
}

initSettings();
renderBlocks();
changed();
$('#gen').addEventListener('click', () => generate(false));
$('#gen-flat').addEventListener('click', () => generate(true));
window.__insertBuilder = { get state() { return state; }, buildPlan, buildImposedPdf, buildFlatPdf };
