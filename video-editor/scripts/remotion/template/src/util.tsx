import {interpolate} from 'remotion';
import {FPS} from './theme';
import {ease as easing} from './transitions/index.ts';
import type {Rect} from './geometry.ts';

export {lerp} from './geometry.ts';

/** progress from 0 to 1 between two seconds */
export const p = (t: number, a: number, b: number) =>
  interpolate(t, [a, b], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});

/* A scene draws inside the `area` a layout hands it (scenes/index.ts's contract), never in
   absolute frame pixels: these convert a fraction of the area (0-1, same convention as the
   0-1080/0-1920 design canvas a motif used to be tuned against, just relative now) into a
   real frame position or size. `ax`/`ay` are a POINT inside the area; `aw`/`ah` a WIDTH or
   HEIGHT proportional to it — use the height helper for anything that should shrink with a
   short area (a row's own height, say), and a literal pixel count for anything that should
   not (font size, stroke width, radius — those are about how big things read, not where
   they sit). */
export const ax = (area: Rect, kx: number) => area.x + kx * area.w;
export const ay = (area: Rect, ky: number) => area.y + ky * area.h;
export const aw = (area: Rect, kx: number) => kx * area.w;
export const ah = (area: Rect, ky: number) => ky * area.h;

/* The named curves of transitions/easings.ts — one definition, read here by name. */
export const linear = easing('LINEAR');
export const ease = easing('EASE_OUT');
export const eio  = easing('EASE_IN_OUT');
export const back = easing('BACK');
export const sec  = (f: number) => f / FPS;

export const hx = (h: string) => {
  const s = h.replace('#','');
  return [parseInt(s.slice(0,2),16), parseInt(s.slice(2,4),16), parseInt(s.slice(4,6),16)];
};
export const rgba = (h: string, a: number) => { const c = hx(h); return `rgba(${c[0]},${c[1]},${c[2]},${a})`; };
export const lum = (h: string) => {
  const c = hx(h).map(v => { const x = v/255; return x <= 0.03928 ? x/12.92 : Math.pow((x+0.055)/1.055, 2.4); });
  return 0.2126*c[0] + 0.7152*c[1] + 0.0722*c[2];
};
/** text colour on top of the accent colour — computed from its luminance, never written by hand */
export const onACC = (acc: string) => (lum(acc) > 0.45 ? '#111' : '#FFF');
