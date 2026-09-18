/* The video display rects and the transition between them.
   The schedule comes from timeline.json ← stage: [{s,e,m:"FULL"|"DOWN"|"LOWER", transition?, gb?}].
   An entry's optional `transition` (shorthand string or object) overrides type/duration/easing
   for the cut INTO that entry. On the reel video only rect-morph / cut / dissolve are
   meaningful — see scripts/transitions.json.

   R_DOWN flexes per scene, mirroring compose.reference.html's rDown(gb, caption-lines):
   the card shrinks proportionally (9:16) from the graphic bottom + the caption's line count. */
import {lerp, ez} from './util';
import {STAGE, TX, W, H} from './theme';
import {capPages, CAP_LH, CAP_PADY} from './capPages';
import caps from './timeline.json';

/* Every rect below was designed against a 1080x1920 canvas. SX/SY carry that design to
   whatever size the composition actually is (#136) — a horizontal recording gets the same
   relative layout instead of a canvas that no longer matches its own frame. Border radii
   and the caption/UI chrome's own literal sizing (Captions.tsx, Chrome.tsx) are NOT scaled
   here — this is about where things sit, not how big the type reads. */
const SX = W / 1080, SY = H / 1920;

export type Rect = {x:number;y:number;w:number;h:number;r:number};
export const R_FULL:  Rect = {x:0, y:0, w:W, h:H, r:0};
export const R_LOWER: Rect = {x:350*SX, y:1370*SY, w:380*SX, h:520*SY, r:32};
export const R_DOWN:  Rect = {x:0, y:770*SY, w:W, h:1150*SY, r:0};   // full-width fallback; replaced per scene by rDown()
// HIDDEN has no rect of its own (Ad.tsx never draws the video for it — Background.tsx fills
// the frame instead); R_FULL here is only a harmless placeholder for vrect()/videoLayers()
// callers that don't check the mode first.
const M: Record<string,Rect> = {FULL:R_FULL, LOWER:R_LOWER, DOWN:R_DOWN, HIDDEN:R_FULL};

/* caption wrap — capPages.ts owns the wrap (kept in lockstep with what Captions.tsx renders,
   issue #147); here we only need the tallest page overlapping this DOWN span, which is
   always <= CAP_MAX_LINES since a card is now shown one page at a time. */
type CW = {t:string; s:number; e:number};
const CARDS = ((caps as any).cards || []) as {s:number; e:number; w:CW[]}[];
function pageLines(s: number, e: number): number {
  let lines = 1;
  for (const c of CARDS) {
    if (c.e <= s || c.s >= e) continue;
    for (const pg of capPages(c.s, c.e, c.w)) {
      if (pg.e > s && pg.s < e) lines = Math.max(lines, pg.lines);
    }
  }
  return lines;
}
function rDown(gb: number, lines: number): Rect {
  // `gb` (graphic-bottom) is a motif's own "how tall is my content" declaration, designed
  // against the 1920-tall canvas like everything else in motifs/index.json — scale it with
  // the content it describes. The caption block below it is NOT scaled: Captions.tsx renders
  // it at a fixed size regardless of frame height, so the room reserved for it must match.
  const top = gb * SY + 40 + (lines * CAP_LH + CAP_PADY * 2) + 50;
  return {x:0, y:top, w:W, h:H - top, r:0};
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
    s.m = rDown(s.gb ?? 500, pageLines(s.s, s.e));
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

/* Whether the entry active at t is a face-optional (HIDDEN) span — Ad.tsx checks this
   before deciding between the video layers and Background.tsx. No transition/blend at the
   boundary: HIDDEN is a per-entry either/or, not a rect to morph into. */
export function videoHidden(t:number): boolean {
  const i = S.findIndex(x => t >= x.s && t < x.e);
  return i >= 0 && S[i].mode === 'HIDDEN';
}

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
