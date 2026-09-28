import type {Frame, Rect} from '../geometry.ts';

/* What a layout is handed: the frame it arranges. Every layout's arrangement is a fixed
   geometry — not sized off a scene's own content or the caption's — so this is all it needs. */
export type Context = {frame: Frame};

/* Where the face should land inside `video`, and how tall. `x`/`y` are fractions of the
   video RECT (0,0 = its own top-left corner) — genuinely rect-relative, since "where within
   this rect" only means anything relative to that rect. `h` is a fraction of the FULL FRAME,
   not the rect — deliberately the odd one out, and it must stay that way: the crop math
   compares it directly against find_face.py's own measurement, itself always a fraction of
   the source frame, to get a zoom factor (Footage.tsx's resolveCrop). Were `h` rect-relative
   instead, that comparison would be silently off by exactly rect.h/frame.h on any layout
   whose rect is not the full frame — the face rendering far larger than the number written
   here ever asked for, worse the smaller the rect. Layouts wanting the same real-world face
   size (most of them) simply share the one `h` for it (layouts/constants.ts's FACE_HEIGHT);
   only `x`/`y` differ per layout. The compile (render_data.py + Footage.tsx) turns a measured
   face position into the zoom/anchor that puts it here; a segment's own hand-authored
   `zoom`/`anchor` overrides this outright. */
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
