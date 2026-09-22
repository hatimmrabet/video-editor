/* How a caption card's words are split into what actually shows on screen at once.
   A card is one whole spoken sentence (render_data.py, one per timeline.json entry) — that
   can be a dozen words, which is the montage's edit unit, not a readable caption. This
   wraps the card's words exactly like the caption box does (same font/size/width, so the
   wrap here matches the wrap the box will actually render) and groups the wrapped lines
   into pages of at most CAP_MAX_LINES lines. Captions.tsx shows one page at a time,
   switching as `t` reaches the next page's first word — never the whole sentence at once.
   stage.ts reuses the same pages to size the DOWN rect, so the two stay in lockstep — one
   wrap computation, not two hand-mirrored copies that could quietly disagree. */
import {T} from './theme';

export const CAP_FS = 55, CAP_LH = 79, CAP_MAXW = 730, CAP_GAP = 16, CAP_PADY = 30;
export const CAP_MAX_LINES = 2;   // a page never shows more than this many lines at once

type CW = {t: string; s: number; e: number};
export type Page<W extends CW = CW> = {s: number; e: number; w: W[]; lines: number};

const _mc: CanvasRenderingContext2D | null =
  typeof document !== 'undefined' ? document.createElement('canvas').getContext('2d') : null;

function widths(ws: CW[]): number[] {
  if (!_mc) return ws.map(w => w.t.length * CAP_FS * 0.55);   // no canvas at type-check/SSR time
  _mc.font = `800 ${CAP_FS}px ${T.font}`;
  return ws.map(w => _mc!.measureText(w.t).width);
}

/** How many lines `ws` wraps to at CAP_MAXW, unbounded — used only to label a finished page. */
export function capLines(ws: CW[]): number {
  if (!ws.length) return 1;
  const ww = widths(ws);
  let lines = 1, cw = 0;
  ws.forEach((w, i) => {
    const add = cw ? ww[i] + CAP_GAP : ww[i];
    if (cw + add > CAP_MAXW && cw) { lines++; cw = ww[i]; } else cw += add;
  });
  return lines;
}

/** Splits one card's words into pages of at most CAP_MAX_LINES wrapped lines each. Pages
    tile [cardS, cardE) with no gap between them — the first starts at cardS, the last ends
    at cardE, and each page in between ends exactly where the next one's first word starts. */
export function capPages<W extends CW>(cardS: number, cardE: number, ws: W[]): Page<W>[] {
  if (!ws.length) return [{s: cardS, e: cardE, w: [], lines: 1}];
  const ww = widths(ws);
  const groups: W[][] = [];
  let cur: W[] = [], cw = 0, lines = 1;
  ws.forEach((w, i) => {
    const add = cw ? ww[i] + CAP_GAP : ww[i];
    const wraps = cw + add > CAP_MAXW && cw > 0;
    if (wraps) {
      if (lines >= CAP_MAX_LINES) { groups.push(cur); cur = []; lines = 1; }
      else lines++;
      cw = ww[i];
    } else {
      cw += add;
    }
    cur.push(w);
  });
  if (cur.length) groups.push(cur);
  return groups.map((g, i) => ({
    s: i === 0 ? cardS : g[0].s,
    e: i === groups.length - 1 ? cardE : groups[i + 1][0].s,
    w: g,
    lines: capLines(g),
  }));
}
