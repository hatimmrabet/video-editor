import type {Frame, Rect} from '../geometry.ts';

/* What a layout is handed: the frame it arranges, how tall the caption block is (asked for
   only when a layout needs it — measuring text is not free), and how far down the scene above
   the video reaches (design pixels, see constants.ts). */
export type Context = {frame: Frame; captionHeight: () => number; sceneBottom?: number};

/* Where the face should land inside `video`, and how tall: x/y are fractions of the video
   rect (0,0 = its top-left corner), `h` a fraction of the rect's own height. The compile
   (render_data.py + Footage.tsx) turns a measured face position into the zoom/anchor that
   puts it here; a segment's own hand-authored `zoom`/`anchor` overrides this outright. */
export type FaceTarget = {x: number; y: number; h: number};

/* Where the caption sits. `y` is in frame pixels: for BOTTOM, the distance up from the
   frame's bottom edge (the caption grows upward from there, as on a full screen); for SEAM,
   the absolute y of the seam it rides — 42% of the caption's own height above that line, 58%
   below, tying the graphic and the video halves together (Captions.tsx does the 42/58 split
   via a CSS transform, since only the browser knows the caption's real rendered height). */
export type CaptionPlacement = {y: number; align: 'BOTTOM' | 'SEAM'};

/* What a layout answers: where each thing goes. The compositor draws exactly this. */
export type Arrangement = {
  /* The person's video card. null = no face on screen: an ambient background is drawn instead. */
  video: Rect | null;
  /* Face framing target inside `video` — see FaceTarget. Unused when `video` is null. */
  face: FaceTarget;
  /* Where the caption sits — see CaptionPlacement. */
  caption: CaptionPlacement;
  /* Where a scene draws, in frame pixels. Always defined, even for FULL (an overlay band),
     so a scene component never needs to know which layout is active — only its own area. */
  scene: Rect;
};
