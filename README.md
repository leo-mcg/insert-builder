# Insert Builder

Build printable notebook inserts from page blocks and download a print-ready PDF.

**Live:** https://leo-mcg.github.io/insert-builder/

Everything runs in the browser (static HTML + JS, PDF drawn as vectors with
[pdf-lib](https://pdf-lib.js.org/) 1.17.1, vendored in `js/pdf-lib.min.js`, MIT).
No server, no account; your block list is saved in `localStorage`.

## What it makes

- Default page size: Traveler's Company passport, **89 × 124 mm** (custom sizes allowed if two spreads still fit on the paper).
- **32 or 64 pages**, imposed for **saddle stitch**: each Letter or A4 portrait sheet holds two 178 × 124 mm spreads stacked vertically, with crop marks and fold ticks.
  32 pages = 8 booklet sheets = 8 PDF pages (4 paper sheets, duplex). 64 pages = 16 PDF pages (8 paper sheets).
- Print duplex, **flip on long edge**, at **100% / Actual size**. A 50 mm scale-check bar sits in the top margin.
- Optional flat PDF with the pages in reading order (for viewing).

### Blocks

| Block | Count | Notes |
|---|---|---|
| Dot grid | pages | 5 mm grid, 0.30 mm dots, #999, symmetric to the page edges, gutter column dropped |
| Lined | pages | 5/6/7 mm, 0.28 mm #C8C8C8 |
| Blank | pages | |
| Weekly spread | weeks (2 pages each) | undated or dated, Monday or Sunday start |
| Monthly spread | months (2 pages each) | undated or dated, Monday or Sunday start |
| Comic panels | pages | 30 layouts ported from Leo's reference generator, mostly odd panel counts, occasional surprise layouts |
| Word search | puzzles | 12 × 12, built-in word lists, answer key at the back |
| Sudoku | puzzles | unique-solution puzzles, Easy/Medium/Hard, solutions at the back |

Page math: blocks fill the book from page 1 (front cover). Two-page spreads always
start on a left-hand page (a dot-grid page is inserted if needed). Leftover pages
become dot grid, answer keys go on the last pages. Over-full books can't be generated.

Specs: guides 0.28 mm #C8C8C8; outer margins 4.5-5 mm, gutter 8.5-9.5 mm,
mirrored for left/right pages. No circles or rounded frames (dots only).

## Print, cut, bind

1. Print on Letter or A4, portrait, 100% / Actual size, duplex, flip on long edge. Check the 50 mm bar.
2. Stack the sheets in order, sheet 1 on top, fronts up.
3. 5 stack cuts: the 4 outer crop marks, then the middle mark.
4. Put the bottom pile under the top pile.
5. Fold so page 1 is the cover, crease, staple or stitch. 64 pages is thick for one staple.

## Imposition (32 pages)

| Sheet | Front (top / bottom) | Back (top / bottom) |
|---|---|---|
| 1 | 32 \| 1 / 24 \| 9 | 2 \| 31 / 10 \| 23 |
| 2 | 30 \| 3 / 22 \| 11 | 4 \| 29 / 12 \| 21 |
| 3 | 28 \| 5 / 20 \| 13 | 6 \| 27 / 14 \| 19 |
| 4 | 26 \| 7 / 18 \| 15 | 8 \| 25 / 16 \| 17 |

## Code

- `js/plan.js` block list -> ordered pages
- `js/content.js` page drawers (dot grid, lined, weekly, monthly, comics, puzzles, keys)
- `js/puzzles.js` seeded word search and sudoku generators, word lists
- `js/impose.js` saddle-stitch imposition, crop marks, labels, ruler
- `js/render.js` one drawing API with a PDF (vector) and a canvas (preview) backend

Run locally: `python3 -m http.server` in this folder, open http://localhost:8000.

## License

MIT. Built by [Leo-McG](https://leo-mcg.github.io/).
