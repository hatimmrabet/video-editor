/* The compositor's clock: which layout is on screen at t, and how the video card moves from one
   layout to the next. This file holds no layout and no transition of its own — those live in
   layouts/ and transitions/; here they are only looked up.

   The schedule comes from plan.json <- stage: [{s, e, layout, scene, transition}] (compiled from
   timeline.json by render_data.py). A segment's own `transition` chooses the change INTO its
   span; without one a change of layout is a RECT_MORPH. */
import {STAGE, W, H, FPS} from './theme';
import {capPages, fontReady, CAP_LH, CAP_PADY} from './capPages';
import caps from './plan.json';
import type {Rect} from './geometry.ts';
import type {Spec} from './options/domain.ts';
import {LAYOUTS} from './layouts/index.ts';
import type {Arrangement} from './layouts/index.ts';
import {SCENES} from './scenes/index.ts';
import {TRANSITIONS, ease} from './transitions/index.ts';
import type {Layer} from './transitions/index.ts';

const FRAME = {w: W, h: H};

/* caption wrap — capPages.ts owns the wrap (kept in lockstep with what Captions.tsx renders);
   here we only need the tallest page overlapping a span, always <= CAP_MAX_LINES since a card
   shows one page at a time. */
type CW = {t: string; s: number; e: number};
const CARDS = ((caps as any).cards || []) as {s: number; e: number; w: CW[]}[];
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

type Span = {s: number; e: number; layout: Spec | null; scene: any; move: ReturnType<typeof TRANSITIONS.parse>; arrangement?: Arrangement};

/* Every choice in the schedule is read once, on load: a bad one fails immediately, worded for
   the author. */
const SPANS: Span[] = STAGE.map(x => ({
  s: x.s, e: x.e, layout: x.layout, scene: x.scene, move: TRANSITIONS.parse(x.transition),
}));

/* How far down the span's scene reaches, in design pixels — the scene's own declaration. */
function sceneBottom(sc: {type: string; params?: any} | null): number | undefined {
  if (!sc) return undefined;
  const {option, params} = SCENES.parse({type: sc.type, ...(sc.params ?? {})});
  const bottom = (option as {bottom: number | ((p: any) => number)}).bottom;
  return typeof bottom === 'function' ? bottom(params) : bottom;
}

/* Every span's arrangement, resolved once and lazily — SPLIT's seam needs a caption line
   count, which needs the theme font (font.ts loads it). Locked in only once that font is
   confirmed ready, so a span resolved earlier (against a fallback font's line count) gets
   one more chance instead of leaving the seam wrong for the rest of the render. */
let _resolved = false;
function resolveArrangements() {
  if (_resolved) return;
  for (const span of SPANS) {
    const {option, params} = LAYOUTS.parse(span.layout);
    span.arrangement = (option.arrange as (c: any, p: any) => Arrangement)({
      frame: FRAME,
      captionHeight: () => pageLines(span.s, span.e) * CAP_LH + CAP_PADY * 2,
      sceneBottom: sceneBottom(span.scene),
    }, params);
  }
  _resolved = fontReady();
}

const spanIndex = (t: number) => {
  const i = SPANS.findIndex(x => t >= x.s && t < x.e);
  return i < 0 ? SPANS.length - 1 : i;
};

/* Where things go at t: the video card and the caption. */
export function arrangementAt(t: number): Arrangement {
  resolveArrangements();
  return SPANS[spanIndex(t)].arrangement!;
}

/* Whether the entry active at t leaves no face on screen (a HIDDEN layout) — Ad.tsx then draws
   the ambient background instead of the video. No transition at that boundary: it is a
   per-entry either/or, not a rect to morph into. */
export function videoHidden(t: number): boolean {
  resolveArrangements();
  const i = SPANS.findIndex(x => t >= x.s && t < x.e);
  return i >= 0 && SPANS[i].arrangement!.video === null;
}

/* The video cards to draw at t: one normally, more while a transition is under way. `tick` is
   the frame number, which seeds any per-frame randomness a transition needs. */
export function layersAt(t: number, tick: number): Layer[] {
  resolveArrangements();
  const i = spanIndex(t);
  const span = SPANS[i];
  const to = span.arrangement!.video;
  if (!to) return [];
  const from = i > 0 ? SPANS[i - 1].arrangement!.video : null;
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
