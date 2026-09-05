/* The video display rects and the transition between them.
   The schedule comes from project.json ← stage: [{s,e,m:"FULL"|"DOWN"|"LOWER"|"STAGE"|"SIDE",
   transition?}]. An entry's optional `transition` (shorthand string or object) overrides
   type/duration/easing for the cut INTO that entry. On the reel video only
   rect-morph / cut / dissolve are meaningful — see docs/design/transitions.md. */
import {lerp, ez} from './util';
import {STAGE, TX} from './theme';

export type Rect = {x:number;y:number;w:number;h:number;r:number};
export const R_FULL:  Rect = {x:0,   y:0,   w:1080, h:1920, r:0};
export const R_STAGE: Rect = {x:190, y:660, w:700,  h:700,  r:44};
export const R_SIDE:  Rect = {x:120, y:700, w:840,  h:620,  r:44};
export const R_LOWER: Rect = {x:350, y:1370, w:380, h:520,  r:32};
export const R_DOWN:  Rect = {x:0,   y:770, w:1080, h:1150, r:0};    // the default for drawing moments: graphics on top ← caption ← full-width face below
const M: Record<string,Rect> = {FULL:R_FULL, STAGE:R_STAGE, SIDE:R_SIDE, LOWER:R_LOWER, DOWN:R_DOWN};

type Spec = string | {type?:string; duration?:number; easing?:string} | undefined;
const S = (STAGE as {s:number;e:number;m:string;transition?:Spec}[])
  .map(x => ({s:x.s, e:x.e, m:M[x.m] || R_FULL, transition:x.transition}));

/* The transition INTO S[i]: the entry's `transition` overrides TX.sceneToScene. */
function vtrans(i:number) {
  const d = TX.sceneToScene, o = (S[i] && S[i].transition) || null;
  if (o && typeof o === 'object') return {type:o.type||d.type, dur:(o.duration!=null?o.duration:d.duration), easing:o.easing||d.easing};
  if (typeof o === 'string')      return {type:o, dur:d.duration, easing:d.easing};
  return {type:d.type, dur:d.duration, easing:d.easing};
}

export const vrect = (t:number):Rect => {
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
  let i = S.findIndex(x => t >= x.s && t < x.e); if (i < 0) i = S.length-1;
  const tr = vtrans(i);
  if (i > 0 && tr.type === 'dissolve' && t < S[i].s + tr.dur) {
    const k = ez(tr.easing)((t - S[i].s) / tr.dur);
    return [{rect:S[i-1].m, opacity:1-k}, {rect:S[i].m, opacity:k}];
  }
  return [{rect:vrect(t), opacity:1}];
}
