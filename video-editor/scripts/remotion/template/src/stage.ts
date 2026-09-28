/* The compositor's clock: which layout is on screen at t, and how the video card moves from one
   layout to the next. This file holds no layout and no transition of its own — those live in
   layouts/ and transitions/; here they are only looked up.

   The schedule comes from plan.json <- stage: [{s, e, layout, scene, transition}] (compiled from
   timeline.json by render_data.py). A segment's own `transition` chooses the change INTO its
   span; without one a change of layout is a RECT_MORPH. */
import {STAGE, W, H, FPS} from './theme';
import type {Rect} from './geometry.ts';
import {LAYOUTS} from './layouts/index.ts';
import type {Arrangement} from './layouts/index.ts';
import {TRANSITIONS, ease} from './transitions/index.ts';
import type {Layer} from './transitions/index.ts';

const FRAME = {w: W, h: H};

type Span = {s: number; e: number; move: ReturnType<typeof TRANSITIONS.parse>; arrangement: Arrangement};

/* Every span's choices are read, and every arrangement resolved, once on load: a bad one fails
   immediately, worded for the author. Every layout's own arrangement is a fixed geometry (frame
   dimensions only — never a scene's content or the caption's), so there is nothing to defer:
   this never changes again after this one pass. */
const SPANS: Span[] = STAGE.map(x => {
  const {option, params} = LAYOUTS.parse(x.layout);
  return {
    s: x.s, e: x.e, move: TRANSITIONS.parse(x.transition),
    arrangement: (option.arrange as (c: any, p: any) => Arrangement)({frame: FRAME}, params),
  };
});

const spanIndex = (t: number) => {
  const i = SPANS.findIndex(x => t >= x.s && t < x.e);
  return i < 0 ? SPANS.length - 1 : i;
};

/* Where things go at t: the video card and the caption. */
export function arrangementAt(t: number): Arrangement {
  return SPANS[spanIndex(t)].arrangement;
}

/* Whether the entry active at t leaves no face on screen (a HIDDEN layout) — Ad.tsx then draws
   the ambient background instead of the video. No transition at that boundary: it is a
   per-entry either/or, not a rect to morph into. */
export function videoHidden(t: number): boolean {
  const i = SPANS.findIndex(x => t >= x.s && t < x.e);
  return i >= 0 && SPANS[i].arrangement.video === null;
}

/* The video cards to draw at t: one normally, more while a transition is under way. `tick` is
   the frame number, which seeds any per-frame randomness a transition needs. */
export function layersAt(t: number, tick: number): Layer[] {
  const i = spanIndex(t);
  const span = SPANS[i];
  const to = span.arrangement.video;
  if (!to) return [];
  const from = i > 0 ? SPANS[i - 1].arrangement.video : null;
  const {option, params} = span.move;
  const duration: number = params.duration ?? 0;
  if (!from || duration <= 0 || t >= span.s + duration) return [{rect: to}];
  const k = ease(params.easing)((t - span.s) / duration);
  return (option.layers as (move: any, p: any) => Layer[])({from, to, k, frame: FRAME, tick}, params);
}

/* The video card's rectangle at t — what scenes are handed as `rect`. The tick is
   reconstructed from t (round(t * FPS)): seek-safe, and matches the real frame Ad.tsx draws,
   so a per-frame-seeded transition (GLITCH) agrees with what a scene reads here. */
export function videoRectAt(t: number): Rect {
  const layers = layersAt(t, Math.round(t * FPS));
  return layers.length ? layers[layers.length - 1].rect : {x: 0, y: 0, w: W, h: H, r: 0};
}
