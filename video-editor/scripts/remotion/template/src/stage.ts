/* The video display rects and the transition between them.
   The schedule comes from project.json ← stage: [{s,e,m:"FULL"|"DOWN"|"LOWER", transition?, gb?}].
   An entry's optional `transition` (shorthand string or object) overrides type/duration/easing
   for the cut INTO that entry. On the reel video only rect-morph / cut / dissolve are
   meaningful — see docs/design/transitions.md.

   R_DOWN flexes per scene, mirroring compose.reference.html's rDown(gb, caption-lines):
   the card shrinks proportionally (9:16) from the graphic bottom + the caption's line count. */
import {lerp, ez} from './util';
import {STAGE, TX, T} from './theme';
import caps from './caps.json';

export type Rect = {x:number;y:number;w:number;h:number;r:number};
export const R_FULL:  Rect = {x:0,   y:0,    w:1080, h:1920, r:0};
export const R_LOWER: Rect = {x:350, y:1370, w:380,  h:520,  r:32};
export const R_DOWN:  Rect = {x:0,   y:770,  w:1080, h:1150, r:0};   // full-width fallback; replaced per scene by rDown()
const M: Record<string,Rect> = {FULL:R_FULL, LOWER:R_LOWER, DOWN:R_DOWN};

/* caption wrap — mirror of compose.reference.html layout()/rDown()/CAPH */
const CAP_FS = 55, CAP_LH = 79, CAP_MAXW = 730, CAP_GAP = 16, CAP_PADY = 30;
type CW = {t:string; s:number; e:number};
const CARDS = ((caps as any).cards || []) as {s:number; e:number; w:CW[]}[];
const _mc: CanvasRenderingContext2D | null =
  typeof document !== 'undefined' ? document.createElement('canvas').getContext('2d') : null;
function capLines(ws: CW[]): number {
  if (!_mc || !ws.length) return 1;
  _mc.font = `800 ${CAP_FS}px ${T.font}`;
  let lines = 1, cw = 0;
  for (const wd of ws.map(w => _mc!.measureText(w.t).width)) {
    const add = cw ? wd + CAP_GAP : wd;
    if (cw + add > CAP_MAXW && cw) { lines++; cw = wd; } else cw += add;
  }
  return lines;
}
function rDown(gb: number, lines: number): Rect {
  const top = gb + 40 + (lines * CAP_LH + CAP_PADY * 2) + 50;
  return {x:0, y:top, w:1080, h:1920 - top, r:0};
}

type Spec = string | {type?:string; duration?:number; easing?:string} | undefined;
const S = (STAGE as {s:number;e:number;m:string;transition?:Spec;gb?:number}[])
  .map(x => ({s:x.s, e:x.e, m:M[x.m] || R_FULL, mode:x.m, gb:x.gb, transition:x.transition}));

/* Resolve every DOWN span to its flex rect once, lazily (fonts are loaded by then). */
let _resolved = false;
function resolveScenes() {
  if (_resolved) return;
  _resolved = true;
  for (const s of S) {
    if (s.mode !== 'DOWN') continue;
    let lines = 1;
    for (const c of CARDS) if (c.e > s.s && c.s < s.e) lines = Math.max(lines, capLines(c.w));
    s.m = rDown(s.gb ?? 500, lines);
  }
}

/* The transition INTO S[i]: the entry's `transition` overrides TX.sceneToScene. */
function vtrans(i:number) {
  const d = TX.sceneToScene, o = (S[i] && S[i].transition) || null;
  if (o && typeof o === 'object') return {type:o.type||d.type, dur:(o.duration!=null?o.duration:d.duration), easing:o.easing||d.easing};
  if (typeof o === 'string')      return {type:o, dur:d.duration, easing:d.easing};
  return {type:d.type, dur:d.duration, easing:d.easing};
}

export const vrect = (t:number):Rect => {
  resolveScenes();
  let i = S.findIndex(x => t >= x.s && t < x.e); if (i < 0) i = S.length-1;
  const tr = vtrans(i);
  let a = S[i].m, b = a, k = 1;
  if (i > 0 && tr.type !== 'cut' && t < S[i].s + tr.dur) {
    a = S[i-1].m; b = S[i].m; k = ez(tr.easing)((t - S[i].s) / tr.dur);
  }
  return {x:lerp(a.x,b.x,k), y:lerp(a.y,b.y,k), w:lerp(a.w,b.w,k), h:lerp(a.h,b.h,k), r:lerp(a.r,b.r,k)};
};

/* The video layers to render at t. One rect normally; two (cross-fading) mid-`dissolve`. */
export function videoLayers(t:number): {rect:Rect; opacity:number}[] {
  resolveScenes();
  let i = S.findIndex(x => t >= x.s && t < x.e); if (i < 0) i = S.length-1;
  const tr = vtrans(i);
  if (i > 0 && tr.type === 'dissolve' && t < S[i].s + tr.dur) {
    const k = ez(tr.easing)((t - S[i].s) / tr.dur);
    return [{rect:S[i-1].m, opacity:1-k}, {rect:S[i].m, opacity:k}];
  }
  return [{rect:vrect(t), opacity:1}];
}
