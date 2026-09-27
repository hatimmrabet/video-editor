import type {Frame, Rect} from '../geometry.ts';

/* SVG filter definitions a layer points at through `filter: url(#...)` — data only, drawn
   by LayerDefs.tsx. */
export type LayerDefs = {glitch?: {seed: number; shift: number; scale: number}};

/* One video card as the compositor draws it. Every field is in frame coordinates. */
export type Layer = {
  rect: Rect;
  opacity?: number;
  transform?: string;
  origin?: string;          // CSS transform-origin
  filter?: string;
  clip?: string;            // CSS clip-path
  defs?: LayerDefs;
};

/* What a transition is handed: the layout it leaves and the one it enters (their video
   rects), how far along it is (already eased, 0..1), the frame, and the frame number. */
export type Move = {from: Rect; to: Rect; k: number; frame: Frame; tick: number};
